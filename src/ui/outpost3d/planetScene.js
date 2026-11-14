// Site-picker globe: Mars or the Moon wrapped in the full 8 x 4 Trek mosaic, axial tilt, glowing site pins.
// Click a pin to select that site (dispatches 'select-site' on the container); the globe turns to face the chosen site.
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { SITES } from '../../data/sites.js';
import { loadMosaicCanvas } from './mosaic.js';
import { clamp, DEG, easeInOut, hash2, lerp, UI } from './sceneUtil.js';

const TILT = { mars: 25.19 * DEG, moon: 6.68 * DEG };
const SPIN = 0.07; // rad/s idle spin

const GLOW_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const GLOW_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uPower;
  varying vec3 vN; varying vec3 vV;
  void main() {
    // back-side shell: bright against the planet's limb, fading to nothing at the shell's outer edge
    float d = clamp(-dot(vN, vV), 0.0, 1.0);
    float f = pow(smoothstep(0.0, 0.42, d), uPower) * 0.55;
    gl_FragColor = vec4(uColor, f);
  }
`;

/** Position on the unit sphere matching three's SphereGeometry UVs with u=0 at 180°W. */
export function latLonToVec(lat, lon, r = 1) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
}

export class PlanetScene {
  constructor() {
    this.body = null;
    this.siteId = null;
    this.pins = [];
    this.spin = 0;
    this.spinVel = 0;
    this.spinAnim = null;
    this.camLat = 0.2;
    this.camLatTarget = 0.2;
    this.running = false;
    this.visible = true;
    this.hidden = false;
    this.elapsed = 0;
    this.textureKey = null;
    this.disposables = [];
    this._raf = this._raf.bind(this);
    this._onVisibility = () => { this.hidden = document.hidden; this._tick(); };
  }

  mount(container) {
    this.container = container;
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'outpost3d-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Spinning globe with landing sites. Tap a pin to choose a site.');
    renderer.domElement.style.touchAction = 'pan-y';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(32, 1, 0.1, 200);
    this.camera.position.set(0, 0.6, 3.6);

    // stars
    const N = 900;
    const sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = hash2(i, 1) * 2 - 1;
      const a = hash2(i, 2) * Math.PI * 2;
      const r = Math.sqrt(1 - u * u) * 60;
      sp[i * 3] = Math.cos(a) * r;
      sp[i * 3 + 1] = u * 60;
      sp[i * 3 + 2] = Math.sin(a) * r;
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(sp, 3));
    this.stars = new Points(sg, new PointsMaterial({ color: 0xdfe6ff, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
    this.scene.add(this.stars);

    // lights
    this.sun = new DirectionalLight(0xfff3e0, 3.2);
    this.sun.position.set(-4, 2.2, 3);
    this.scene.add(this.sun);
    this.scene.add(new AmbientLight(0x6070a0, 0.25));
    const rim = new DirectionalLight(0x8fb3ff, 0.5);
    rim.position.set(4, -1, -3);
    this.scene.add(rim);

    // globe hierarchy: tilt group -> spin group -> globe + pins
    this.tiltGroup = new Group();
    this.spinGroup = new Group();
    this.tiltGroup.add(this.spinGroup);
    this.scene.add(this.tiltGroup);
    this.globeMat = new MeshStandardMaterial({ color: 0x8a6a55, roughness: 0.95, metalness: 0 });
    this.globe = new Mesh(new SphereGeometry(1, 72, 48), this.globeMat);
    this.spinGroup.add(this.globe);
    this.glowMat = new ShaderMaterial({ uniforms: { uColor: { value: new Color(0xd9a071) }, uPower: { value: 1.4 } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, side: BackSide, depthWrite: false, blending: AdditiveBlending });
    this.glow = new Mesh(new SphereGeometry(1.09, 48, 32), this.glowMat);
    this.scene.add(this.glow);
    this.pinGroup = new Group();
    this.spinGroup.add(this.pinGroup);
    this.pinMats = {
      idle: new MeshBasicMaterial({ color: new Color(UI.text) }),
      selected: new MeshBasicMaterial({ color: new Color(UI.pin) }),
      ring: new MeshBasicMaterial({ color: new Color(UI.pin), transparent: true, opacity: 0.9, side: 2 }),
      halo: new MeshBasicMaterial({ color: new Color(UI.pin), transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }),
      hit: new MeshBasicMaterial({ visible: false }),
    };

    // label for the selected site
    this.label = document.createElement('div');
    this.label.className = 'globe3d-label';
    container.appendChild(this.label);
    const hint = document.createElement('div');
    hint.className = 'outpost3d-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Tap a pin to pick a landing site';
    container.appendChild(hint);
    this.hint = hint;

    // pointer: drag spins, tap selects
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    const el = renderer.domElement;
    this.drag = null;
    el.addEventListener('pointerdown', (ev) => { this.drag = { x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId }; this.spinAnim = null; });
    el.addEventListener('pointermove', (ev) => {
      if (!this.drag || ev.pointerId !== this.drag.id) return;
      const dx = ev.clientX - this.drag.x;
      if (Math.abs(dx) > 4 || Math.abs(ev.clientY - this.drag.y) > 4) this.drag.moved = true;
      if (this.drag.moved) {
        this.spin += dx * 0.008;
        this.spinVel = dx * 0.008 * 30;
        this.drag.x = ev.clientX;
        this.idleUntil = this.elapsed + 4;
      }
    });
    const end = (ev) => {
      if (!this.drag) return;
      const wasTap = !this.drag.moved;
      this.drag = null;
      if (wasTap) this._pick(ev);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { this.drag = null; });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersection = new IntersectionObserver((entries) => { this.visible = entries.some((e) => e.isIntersecting); this._tick(); }, { threshold: 0.02 });
    this.intersection.observe(container);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.hidden = document.hidden;
    this.resize();
  }

  resize() {
    if (!this.renderer || !this.container) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < 520 ? 40 : 32;
    this.camera.updateProjectionMatrix();
    this._render();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.resizeObserver?.disconnect();
    this.intersection?.disconnect();
    this.scene?.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
    });
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
    this.label?.remove();
    this.hint?.remove();
    this.renderer = null;
    this.container = null;
  }

  /** @param {{ body: 'mars'|'moon', siteId: string|null }} sel */
  update(sel) {
    const body = sel?.body === 'moon' ? 'moon' : 'mars';
    const bodyChanged = body !== this.body;
    const siteChanged = sel?.siteId !== this.siteId;
    this.body = body;
    this.siteId = sel?.siteId ?? null;
    if (bodyChanged) {
      this.tiltGroup.rotation.z = -(TILT[body] ?? 0);
      this.glow.visible = body === 'mars';
      this.globeMat.color.set(body === 'moon' ? 0xbcbcc0 : 0xd4987a);
      this._loadTexture(body);
      this._buildPins(body);
    }
    if (bodyChanged || siteChanged) this._facePin();
    for (const p of this.pins) {
      const sel2 = p.site.id === this.siteId;
      p.dot.material = sel2 ? this.pinMats.selected : this.pinMats.idle;
      p.ring.visible = sel2;
      p.halo.visible = sel2;
    }
    this._tick();
  }

  async _loadTexture(body) {
    this.textureKey = body;
    let canvas;
    try {
      canvas = await loadMosaicCanvas(body);
    } catch {
      canvas = null;
    }
    if (this.textureKey !== body || !this.renderer || !canvas) return;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() ?? 1);
    this.globeMat.map?.dispose?.();
    this.globeMat.bumpMap?.dispose?.();
    this.globeMat.map = t;
    this.globeMat.bumpMap = t;
    this.globeMat.bumpScale = body === 'moon' ? 0.012 : 0.006;
    this.globeMat.color.set(0xffffff);
    this.globeMat.needsUpdate = true;
    this._render();
  }

  _buildPins(body) {
    for (const p of this.pins) { this.pinGroup.remove(p.group); p.group.traverse((o) => o.geometry?.dispose?.()); }
    this.pins = [];
    const dotGeo = new SphereGeometry(0.022, 12, 8);
    const ringGeo = new RingGeometry(0.045, 0.06, 32);
    const haloGeo = new SphereGeometry(0.06, 12, 8);
    const hitGeo = new SphereGeometry(0.11, 8, 6);
    for (const site of SITES.filter((s) => s.body === body)) {
      const group = new Group();
      const pos = latLonToVec(site.lat, site.lon, 1.012);
      group.position.copy(pos);
      group.lookAt(pos.clone().multiplyScalar(2));
      const dot = new Mesh(dotGeo, this.pinMats.idle);
      const ring = new Mesh(ringGeo, this.pinMats.ring);
      const halo = new Mesh(haloGeo, this.pinMats.halo);
      const hit = new Mesh(hitGeo, this.pinMats.hit);
      hit.userData.siteId = site.id;
      group.add(dot, ring, halo, hit);
      this.pinGroup.add(group);
      this.pins.push({ site, group, dot, ring, halo, hit });
    }
  }

  _facePin() {
    const site = SITES.find((s) => s.id === this.siteId);
    if (!site) return;
    // rotation about Y that brings the site's longitude to +z (facing the camera)
    const target = -Math.PI / 2 - site.lon * DEG;
    let delta = ((target - this.spin) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.spinAnim = { from: this.spin, to: this.spin + delta, start: this.elapsed };
    this.camLatTarget = clamp(site.lat * DEG, -1.05, 1.05) * 0.85;
    this.idleUntil = this.elapsed + 3.5;
  }

  _pick(ev) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.globe, ...this.pins.map((p) => p.hit)], false);
    const first = hits.find((h) => h.object.userData.siteId);
    if (!first) return;
    // only pins in front of the globe surface count
    if (hits[0].object !== first.object && hits[0].distance < first.distance - 0.15) return;
    this.container.dispatchEvent(new CustomEvent('select-site', { detail: { siteId: first.object.userData.siteId }, bubbles: true }));
  }

  _tick() {
    const shouldRun = !!this.renderer && this.visible && !this.hidden;
    if (shouldRun && !this.running) {
      this.running = true;
      this.clockLast = performance.now();
      this.rafId = requestAnimationFrame(this._raf);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    }
  }

  _raf(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.clockLast) / 1000);
    this.clockLast = now;
    this.elapsed += dt;
    this._step(dt);
    this._render();
    this.rafId = requestAnimationFrame(this._raf);
  }

  _step(dt) {
    const t = this.elapsed;
    if (this.spinAnim) {
      const k = clamp((t - this.spinAnim.start) / 1.3, 0, 1);
      this.spin = lerp(this.spinAnim.from, this.spinAnim.to, easeInOut(k));
      if (k >= 1) this.spinAnim = null;
    } else if (this.drag?.moved) {
      /* user is dragging */
    } else {
      this.spinVel *= Math.exp(-dt * 3);
      const idle = t > (this.idleUntil ?? 0) ? SPIN : 0;
      this.spin += (idle + this.spinVel) * dt;
    }
    this.spinGroup.rotation.y = this.spin;
    this.camLat += (this.camLatTarget - this.camLat) * (1 - Math.exp(-dt * 2.5));
    const d = 3.6;
    this.camera.position.set(0, Math.sin(this.camLat) * d, Math.cos(this.camLat) * d);
    this.camera.lookAt(0, 0, 0);
    this.stars.rotation.y = t * 0.004;
    const pulse = 0.9 + 0.25 * Math.sin(t * 3);
    for (const p of this.pins) {
      if (p.ring.visible) { p.ring.scale.setScalar(pulse); p.halo.scale.setScalar(1 + 0.3 * Math.sin(t * 3 + 1)); }
    }
    this._placeLabel();
  }

  _placeLabel() {
    const sel = this.pins.find((p) => p.site.id === this.siteId);
    if (!sel || !this.label) return;
    const world = sel.group.getWorldPosition(new Vector3());
    const toCam = this.camera.position.clone().sub(world).normalize();
    const facing = world.clone().normalize().dot(toCam);
    if (facing < 0.1) { this.label.style.opacity = '0'; return; }
    const p = world.clone().project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.label.style.opacity = String(clamp((facing - 0.1) * 3, 0, 1));
    if (this.label.textContent !== sel.site.name) this.label.textContent = sel.site.name;
    const px = ((p.x + 1) / 2) * w;
    const lw = this.label.offsetWidth;
    const x = px + 12 + lw > w - 8 ? Math.max(8, px - 12 - lw) : px + 12; // flip to the left of the pin near the edge
    this.label.style.transform = `translate(${x}px, ${((1 - p.y) / 2) * h - 14}px)`;
  }

  _render() {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }
}
