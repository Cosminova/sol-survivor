// The Cosminova night sky: you stand on Earth at night, a dark horizon of hills around you, the real bright stars
// above, and the clickable targets (exoplanet host stars and Solar System bodies) marked on top.
// Loaded lazily (with three.js and the star catalogue) only when the sky tab opens.
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  CircleGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { advanceDrag, clamp, easeInOut, hash2, lerp, pointerReleased } from '../outpost3d/sceneUtil.js';
import { bvToRgb, horizontalToVector, toHorizontal } from './ephemeris.js';

const STAR_RADIUS = 100;
const SKY_RADIUS = 150;
const HILL_RADIUS = 60;
const MARKER_RADIUS = 95;
const FOV_DEFAULT = 70;
const FOV_MIN = 12;
const FOV_MAX = 95;
const FOV_ARRIVE = 2.5;
const PITCH_MIN = -8;
const PITCH_MAX = 88;
const LOOK_DEG_PER_PX = 0.18;
const KEY_STEP_DEG = 5;
const PICK_RADIUS_PX = 30;
const TURN_SECONDS = 1.1;
const ZOOM_SECONDS = 1.7;
const SKYLINE_SEGMENTS = 240;

const STAR_VERT = /* glsl */ `
  attribute float size; attribute vec3 color; varying vec3 vColor; varying float vAlpha;
  uniform float zoom; uniform float pixelRatio; uniform float fade;
  void main() {
    vColor = color;
    vAlpha = fade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelRatio * zoom;
    gl_Position = projectionMatrix * mv;
  }`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    gl_FragColor = vec4(vColor * (0.6 + 0.4 * a), a * a * vAlpha);
  }`;
const SKY_VERT = /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir; uniform float fade;
  void main() {
    float t = clamp(vDir.y, 0.0, 1.0);
    vec3 horizon = vec3(0.05, 0.10, 0.20); vec3 zenith = vec3(0.004, 0.01, 0.03);
    gl_FragColor = vec4(mix(horizon, zenith, pow(t, 0.45)) * fade, 1.0);
  }`;

const starSizePx = (mag) => clamp(6.2 - mag * 0.9, 1.5, 9);

function discTexture(color, { ring = false } = {}) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;
  if (ring) {
    g.strokeStyle = color;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(mid, mid, mid - 10, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = color;
    g.beginPath();
    g.arc(mid, mid, 7, 0, Math.PI * 2);
    g.fill();
  } else {
    const grad = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.28, color);
    grad.addColorStop(0.42, color);
    grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A ring of dark hills with a few trees and a radio dish, so the first view is "standing on the ground". */
function skylineMesh() {
  const heightAt = (i) => {
    const u = i / SKYLINE_SEGMENTS;
    const hills = 2.2 + 2.4 * Math.sin(u * Math.PI * 6 + 1.3) * Math.sin(u * Math.PI * 2 + 0.4) + 1.6 * hash2(Math.floor(u * 40), 7);
    const tree = hash2(i, 3) > 0.93 ? 2.5 + 3 * hash2(i, 9) : 0;
    const dish = i > 150 && i < 156 ? 7 - Math.abs(i - 153) * 1.2 : 0;
    return Math.max(1, hills) + tree + Math.max(0, dish);
  };
  const pos = [];
  const idx = [];
  for (let i = 0; i <= SKYLINE_SEGMENTS; i += 1) {
    const az = (i / SKYLINE_SEGMENTS) * 360;
    const top = horizontalToVector(heightAt(i % SKYLINE_SEGMENTS), az).map((v) => v * HILL_RADIUS);
    const bottom = horizontalToVector(-60, az).map((v) => v * HILL_RADIUS);
    pos.push(...top, ...bottom);
    if (i < SKYLINE_SEGMENTS) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  const group = new Group();
  group.add(new Mesh(geo, new MeshBasicMaterial({ color: 0x03050a, side: DoubleSide, transparent: true })));
  const ground = new Mesh(new CircleGeometry(HILL_RADIUS + 1, 64), new MeshBasicMaterial({ color: 0x020307, side: DoubleSide, transparent: true }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.2;
  group.add(ground);
  return group;
}

export class SkyScene {
  constructor() {
    this.yaw = 180; // facing south
    this.pitch = 22;
    this.fov = FOV_DEFAULT;
    this.targets = [];
    this.markers = new Map();
    this.labels = new Map();
    this.flight = null;
    this.paused = false;
    this.running = false;
    this.drag = null;
    this.onPick = null;
    this.reducedMotion = false;
    this._raf = this._raf.bind(this);
    this._onVisibility = () => { this.hidden = document.hidden; this._tick(); };
  }

  /**
   * @param {HTMLElement} container
   * @param {{ stars: number[][], names: Record<string,string>, onPick: (id: string) => void }} opts
   */
  mount(container, { stars, names, onPick }) {
    this.container = container;
    this.onPick = onPick;
    const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'wp-sky-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('tabindex', '0');
    container.append(renderer.domElement);
    this.renderer = renderer;
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'wp-sky-labels';
    container.append(this.labelLayer);

    this.scene = new Scene();
    this.scene.background = new Color(0x000000);
    this.camera = new PerspectiveCamera(this.fov, 1, 0.1, 400);
    this.skyMat = new ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: BackSide, depthWrite: false, uniforms: { fade: { value: 1 } } });
    this.scene.add(new Mesh(new SphereGeometry(SKY_RADIUS, 32, 16), this.skyMat));
    this.starRows = stars;
    this.starNames = names;
    this._buildStars();
    this.skyline = skylineMesh();
    this.scene.add(this.skyline);
    this._bindInput(renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersection = new IntersectionObserver((entries) => { this.visible = entries.some((e) => e.isIntersecting); this._tick(); }, { threshold: 0.02 });
    this.intersection.observe(container);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.hidden = document.hidden;
    this.resize();
  }

  _buildStars() {
    const n = this.starRows.length;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(this.starRows.flatMap(([, , , bv]) => bvToRgb(bv))), 3));
    geo.setAttribute('size', new BufferAttribute(new Float32Array(this.starRows.map(([, , mag]) => starSizePx(mag))), 1));
    this.starMat = new ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { zoom: { value: 1 }, pixelRatio: { value: this.renderer.getPixelRatio() }, fade: { value: 1 } },
    });
    this.stars = new Points(geo, this.starMat);
    this.stars.frustumCulled = false; // positions are filled in later; the whole sphere surrounds the camera anyway
    this.scene.add(this.stars);
  }

  /** Re-places the stars and markers for a date and observer, and rebuilds the target markers. */
  update({ date, observer, targets, selectedId }) {
    if (!this.renderer) return;
    const pos = this.stars.geometry.getAttribute('position');
    this.starAlt = this.starRows.map(([ra, dec], i) => {
      const { alt, az } = toHorizontal({ ra, dec }, observer, date);
      const [x, y, z] = horizontalToVector(alt, az);
      pos.setXYZ(i, x * STAR_RADIUS, y * STAR_RADIUS, z * STAR_RADIUS);
      return { alt, az };
    });
    pos.needsUpdate = true;
    this._setTargets(targets, selectedId);
    this._render();
  }

  _setTargets(targets, selectedId) {
    for (const m of this.markers.values()) { this.scene.remove(m); m.material.map?.dispose(); m.material.dispose(); }
    this.markers.clear();
    this.labelLayer.replaceChildren();
    this.labels.clear();
    this.targets = targets;
    for (const t of targets) {
      const isStar = t.kind === 'star';
      const color = isStar ? '#5eead4' : t.color;
      const sprite = new Sprite(new SpriteMaterial({ map: discTexture(color, { ring: isStar }), transparent: true, depthWrite: false, depthTest: true, sizeAttenuation: false }));
      const [x, y, z] = horizontalToVector(t.alt, t.az);
      sprite.position.set(x * MARKER_RADIUS, y * MARKER_RADIUS, z * MARKER_RADIUS);
      const base = isStar ? 0.05 : t.id === 'moon' ? 0.07 : 0.04;
      sprite.userData = { id: t.id, base };
      sprite.scale.setScalar(base * (t.id === selectedId ? 1.35 : 1));
      this.scene.add(sprite);
      this.markers.set(t.id, sprite);
      const label = document.createElement('button');
      label.type = 'button';
      label.tabIndex = -1; // the keyboard list beside the sky is the focusable way in
      label.className = `wp-sky-label${isStar ? ' is-star' : ''}${t.gateway ? ' is-gateway' : ''}${t.id === selectedId ? ' is-selected' : ''}`;
      label.textContent = isStar && !t.nakedEye ? `${t.name} (too faint to see)` : t.name;
      label.dataset.target = t.id;
      label.addEventListener('click', () => this.onPick?.(t.id));
      this.labelLayer.append(label);
      this.labels.set(t.id, label);
    }
    this.starNameLabels = Object.entries(this.starNames ?? {}).map(([i, name]) => {
      const span = document.createElement('span');
      span.className = 'wp-sky-starname';
      span.textContent = name;
      this.labelLayer.append(span);
      const { alt, az } = this.starAlt?.[Number(i)] ?? { alt: -90, az: 0 };
      return { span, alt, vec: new Vector3(...horizontalToVector(alt, az)).multiplyScalar(STAR_RADIUS) };
    });
  }

  /** Turns the view to face a target without flying. */
  lookAt(id) {
    const t = this.targets.find((x) => x.id === id);
    if (!t) return;
    this.yaw = t.az;
    this.pitch = clamp(t.alt, PITCH_MIN, PITCH_MAX);
    this._render();
  }

  /** Faces a target while keeping the horizon in view (used to open the sky on something worth clicking). */
  frameTarget(id) {
    const t = this.targets.find((x) => x.id === id);
    if (!t) return;
    this.yaw = t.az;
    this.pitch = clamp(t.alt - 20, 12, 35);
    this._render();
  }

  /**
   * Turns to the target, then zooms in until it fills the view. Resolves when the flight is over.
   * @param {string} id
   * @param {{ reducedMotion?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  flyTo(id, { reducedMotion = false } = {}) {
    const t = this.targets.find((x) => x.id === id);
    if (!t || !this.renderer || reducedMotion) return Promise.resolve();
    let dYaw = ((t.az - this.yaw + 540) % 360) - 180;
    if (!Number.isFinite(dYaw)) dYaw = 0;
    return new Promise((resolve) => {
      this.flight = { id, start: performance.now(), fromYaw: this.yaw, toYaw: this.yaw + dYaw, fromPitch: this.pitch, toPitch: clamp(t.alt, -60, PITCH_MAX), fromFov: this.fov, resolve };
      this.container.classList.add('is-flying');
      this._tick(true);
    });
  }

  /** Back to standing on the ground after a flight. */
  resetView() {
    this.fov = FOV_DEFAULT;
    this.flight?.resolve();
    this.flight = null;
    this.container?.classList.remove('is-flying');
    this._applyFlightLook(0);
    for (const m of this.markers.values()) m.scale.setScalar(m.userData.base);
    this._render();
  }

  setPaused(on) {
    this.paused = Boolean(on);
    this._tick();
  }

  resize() {
    if (!this.renderer || !this.container) return;
    const w = Math.max(1, this.container.clientWidth);
    const hgt = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    this._render();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.flight?.resolve();
    this.flight = null;
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.resizeObserver?.disconnect();
    this.intersection?.disconnect();
    this.scene?.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
    });
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.renderer?.domElement?.remove();
    this.labelLayer?.remove();
    this.renderer = null;
    this.container = null;
  }

  /* ---------- input ---------- */

  _bindInput(el) {
    el.addEventListener('pointerdown', (ev) => {
      if (this.flight || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      this.drag = { x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId };
      try { el.setPointerCapture(ev.pointerId); } catch { /* pointer already gone */ }
    });
    el.addEventListener('pointermove', (ev) => {
      if (!this.drag || ev.pointerId !== this.drag.id) return;
      if (pointerReleased(ev)) { this.drag = null; return; }
      const prev = this.drag;
      const step = advanceDrag(prev, { x: ev.clientX, y: ev.clientY });
      if (step.drag.moved && step.drag !== prev) {
        const k = LOOK_DEG_PER_PX * (this.fov / FOV_DEFAULT);
        this.yaw -= (ev.clientX - prev.x) * k;
        this.pitch = clamp(this.pitch + (ev.clientY - prev.y) * k, PITCH_MIN, PITCH_MAX);
        this._render();
      }
      this.drag = step.drag;
    });
    el.addEventListener('pointerup', (ev) => {
      if (!this.drag || ev.pointerId !== this.drag.id) return;
      const tapped = !this.drag.moved;
      this.drag = null;
      if (tapped) this._pickAt(ev);
    });
    const drop = (ev) => { if (this.drag?.id === ev.pointerId) this.drag = null; };
    el.addEventListener('pointercancel', drop);
    el.addEventListener('lostpointercapture', drop);
    el.addEventListener('wheel', (ev) => {
      if (this.flight) return;
      ev.preventDefault();
      this.fov = clamp(this.fov * (ev.deltaY > 0 ? 1.08 : 0.92), FOV_MIN, FOV_MAX);
      this._render();
    }, { passive: false });
    el.addEventListener('keydown', (ev) => {
      const moves = { ArrowLeft: [-KEY_STEP_DEG, 0], ArrowRight: [KEY_STEP_DEG, 0], ArrowUp: [0, KEY_STEP_DEG], ArrowDown: [0, -KEY_STEP_DEG] };
      const mv = moves[ev.key];
      if (!mv || this.flight) return;
      ev.preventDefault();
      this.yaw += mv[0];
      this.pitch = clamp(this.pitch + mv[1], PITCH_MIN, PITCH_MAX);
      this._render();
    });
  }

  _pickAt(ev) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    let best = null;
    for (const t of this.targets) {
      if (!t.aboveHorizon) continue;
      const s = this._screen(this.markers.get(t.id).position);
      if (!s) continue;
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < PICK_RADIUS_PX && (!best || d < best.d)) best = { id: t.id, d };
    }
    if (best) this.onPick?.(best.id);
  }

  _screen(vec) {
    const v = vec.clone().project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    const w = this.renderer.domElement.clientWidth;
    const hgt = this.renderer.domElement.clientHeight;
    return { x: (v.x + 1) * 0.5 * w, y: (1 - v.y) * 0.5 * hgt, inView: Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  }

  /* ---------- frame loop ---------- */

  _tick(force = false) {
    const shouldRun = Boolean(this.renderer) && (this.flight || force || (!this.paused && this.visible !== false && !this.hidden));
    if (shouldRun && !this.running) {
      this.running = true;
      this.rafId = requestAnimationFrame(this._raf);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    }
  }

  _raf(now) {
    if (!this.running) return;
    if (this.flight) this._stepFlight(now);
    this._render();
    if (!this.flight && this.paused) { this.running = false; return; }
    this.rafId = requestAnimationFrame(this._raf);
  }

  _stepFlight(now) {
    const f = this.flight;
    const s = (now - f.start) / 1000;
    const turn = easeInOut(clamp(s / TURN_SECONDS, 0, 1));
    this.yaw = lerp(f.fromYaw, f.toYaw, turn);
    this.pitch = lerp(f.fromPitch, f.toPitch, turn);
    const zoom = easeInOut(clamp((s - TURN_SECONDS) / ZOOM_SECONDS, 0, 1));
    this.fov = lerp(f.fromFov, FOV_ARRIVE, zoom);
    this._applyFlightLook(zoom);
    const marker = this.markers.get(f.id);
    if (marker) marker.scale.setScalar(marker.userData.base * lerp(1.35, 9, zoom));
    if (zoom >= 1) {
      this.flight = null;
      this.container.classList.remove('is-flying');
      f.resolve();
    }
  }

  // Leaving the ground: the hills sink away and the sky glow fades to black space.
  _applyFlightLook(k) {
    this.skyline.position.y = -k * 80;
    for (const child of this.skyline.children) child.material.opacity = 1 - k;
    this.skyMat.uniforms.fade.value = 1 - k;
  }

  _render() {
    if (!this.renderer) return;
    const dir = new Vector3(...horizontalToVector(this.pitch, this.yaw));
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(dir);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.starMat.uniforms.zoom.value = Math.sqrt(FOV_DEFAULT / this.fov);
    this.renderer.render(this.scene, this.camera);
    this._placeLabels();
  }

  _placeLabels() {
    const flying = Boolean(this.flight);
    for (const t of this.targets) {
      const label = this.labels.get(t.id);
      const marker = this.markers.get(t.id);
      const s = t.aboveHorizon || flying ? this._screen(marker.position) : null;
      marker.visible = t.aboveHorizon || this.flight?.id === t.id;
      const show = Boolean(s?.inView) && (!flying || this.flight.id === t.id);
      label.hidden = !show;
      if (show) label.style.transform = `translate(${s.x.toFixed(1)}px, ${(s.y + 14).toFixed(1)}px) translateX(-50%)`;
    }
    for (const n of this.starNameLabels ?? []) {
      const s = n.alt > 0 && !flying ? this._screen(n.vec) : null;
      n.span.hidden = !s?.inView;
      if (s?.inView) n.span.style.transform = `translate(${(s.x + 6).toFixed(1)}px, ${(s.y - 6).toFixed(1)}px)`;
    }
  }
}
