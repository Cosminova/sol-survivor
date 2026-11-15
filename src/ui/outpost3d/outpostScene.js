// The living 3D outpost: real Trek terrain under the base, a sky that follows tau and the time of sol, one stylised
// mesh per packed module, dust storms, radiation storms, EVA walks and a slow orbiting camera. Reads only the plain
// model from outpostModel.js. Target: 60 fps on a laptop, 30+ on a phone (pixel ratio <= 1.5, one shadow light,
// shared materials, <= 300 particles, loop paused when hidden).
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Sphere,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTerrainTexture } from './mosaic.js';
import { polarGeometry } from '../../world3d/terrain.js';
import { clamp, DEG, easeInOut, fbm, hash2, lerp, smoothstep, UI } from './sceneUtil.js';
import { lookFor } from '../../render/worldLook.js';
import { outpostPalette, outpostStar, outpostHaze, outpostGround, outpostFixedStar, outpostParentDirection } from '../../render/outpostLook.js';
import { dataTexture, createParentBody, createPoolMaterial } from '../../render/threeLook.js';

const ZOOM_MIN_DISTANCE = 9; // close enough to read a module up close
const ZOOM_MAX_BACKDROP = 120;
const ZOOM_MAX_PANEL = 75;
const ZOOM_STEP = 1.25; // one press of + or - changes the distance by this factor
const CAMP_FRAME_MARGIN = 1.2; // a little room around the whole camp when framing it

const TERRAIN_SIZE = 260;
const TERRAIN_SEGS = 128;
// Far ground: a ring of terrain from just inside the textured square out to the horizon haze, so the edge of the
// scene never shows when zooming out.
const SKIRT_R0 = 126;
const SKIRT_RMAX = 4000;
const SKIRT_SEGS = 160;
const SKIRT_SINK = 0.3; // sits just under the textured square where the two overlap
const CAMERA_FAR = 6000;
const RELIEF_FADE_R = [95, 125]; // the near square's own bumps fade out before the far ground takes over
const RIM_HILLS_FADE_R = [250, 700]; // the rim hills fade into open plains further out
const SKY_RADIUS = 420;
const SOL_PASS_SECONDS = 1.8;
const ROCK_CAPACITY = 80;
const LOOK_MAP_SIZE = 512; // generated ground colour map for worlds other than the Moon and Mars
const POOL_TILES = 10; // lava pattern repeats across the ground plane
const PARENT_DISTANCE = SKY_RADIUS * 0.94;
const SUN_DISC_COS = 0.99955;

/* ---------- palettes (linear-ish hex, tone-mapped by ACES) ---------- */
const PALETTE = {
  mars: {
    dayZenith: '#8c5a3c',
    dayHorizon: '#d9a071',
    duskZenith: '#3a2230',
    duskHorizon: '#e07a3c',
    nightZenith: '#07060c',
    nightHorizon: '#1a100c',
    stormZenith: '#4a230f',
    stormHorizon: '#8a4a1c',
    below: '#6a3a22',
    sunDay: '#ffe2c4',
    sunLow: '#ffa060',
    rim: '#ffb080',
    hemiSky: '#c9a07a',
    hemiGround: '#4a2a1a',
    regolith: '#9a573a',
  },
  moon: {
    dayZenith: '#000003',
    dayHorizon: '#06060a',
    duskZenith: '#000003',
    duskHorizon: '#0a0a10',
    nightZenith: '#000002',
    nightHorizon: '#030306',
    stormZenith: '#000003',
    stormHorizon: '#06060a',
    below: '#09090c',
    sunDay: '#ffffff',
    sunLow: '#fff2dc',
    rim: '#8fb3ff',
    hemiSky: '#1a1c24',
    hemiGround: '#111114',
    regolith: '#7c7c80',
  },
};

/* ---------- sky shader ---------- */
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uBelow; uniform vec3 uSunDir; uniform vec3 uSunColor;
  uniform float uSunDisc; uniform float uDiscCos; uniform float uDiscSolid; uniform float uGlow; uniform float uStars; uniform float uAurora; uniform float uTime; uniform float uHaze;
  varying vec3 vDir;
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55 - uHaze * 0.25, h));
    col = mix(uBelow, col, smoothstep(-0.14, 0.015, h));
    float s = max(dot(d, uSunDir), 0.0);
    float sunUp = smoothstep(-0.12, 0.04, uSunDir.y);
    col += uSunColor * (pow(s, 22.0) * 0.55 + pow(s, 3.0) * 0.10) * uGlow * sunUp;
    float disc = smoothstep(uDiscCos - 0.0002, uDiscCos + 0.0002, s);
    vec3 discCol = uSunColor * uSunDisc * 3.0;
    float limb = 0.62 + 0.38 * smoothstep(uDiscCos, 1.0, s);
    col = mix(col + discCol * disc, mix(col, discCol * limb, disc * smoothstep(-0.03, 0.0, h)), uDiscSolid); // wide cool stars keep their colour as a solid disc
    // Stars via stereographic cells so they stay round everywhere above the horizon.
    if (uStars > 0.001 && h > -0.02) {
      vec2 p = d.xz / (1.0 + max(h, 0.0)) * 70.0;
      vec2 cell = floor(p);
      vec2 f = fract(p);
      float r1 = hash21(cell);
      float r2 = hash21(cell + 17.3);
      vec2 c = vec2(r1, r2) * 0.8 + 0.1;
      float dist = length(f - c);
      float bright = step(0.86, hash21(cell + 3.7));
      float tw = 0.75 + 0.25 * sin(uTime * 1.7 + r1 * 40.0);
      float star = smoothstep(0.075, 0.0, dist) * bright * tw;
      col += vec3(star) * uStars * smoothstep(-0.02, 0.12, h) * (0.8 + 0.4 * r2);
    }
    if (uAurora > 0.001) {
      float a = uAurora * smoothstep(0.03, 0.3, h) * (1.0 - smoothstep(0.45, 0.9, h));
      float band = sin(d.x * 6.0 + uTime * 0.55 + sin(d.z * 4.0 + uTime * 0.31) * 1.6) * 0.5 + 0.5;
      band *= sin(d.z * 9.0 - uTime * 0.42 + d.x * 2.0) * 0.5 + 0.5;
      float curtain = smoothstep(0.1, 0.9, band);
      col += a * curtain * vec3(0.25, 0.95, 0.55) * 0.42 + a * curtain * curtain * vec3(0.6, 0.2, 0.9) * 0.25;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* ---------- module slot layout (metres, x east, z toward the default camera) ---------- */
const SLOTS = {
  solar: (i) => [15 + (i % 3) * 5.4, -7 + Math.floor(i / 3) * 5.6],
  fission: (i) => [-5 + i * 4.5, -21],
  battery: (i) => [7.2 + i * 2.4, 4.6],
  recycler: (i) => [-7.8 - i * 2.6, 2.2],
  oxygen: (i) => [-7.6 - i * 2.4, -3.2],
  moxie: (i) => [-9.5 - i * 3, -8.2],
  regolithO2: (i) => [-9.5 - i * 3, -8.2],
  iceDrill: (i) => [-17 - i * 5, -15],
  greenhouse: (i) => [9.5 + i * 8, 9],
  shelter: (i) => [-13 - i * 5, 9.5],
  rover: (i) => [10 + i * 4.2, 14.5],
  relay: (i) => [-3 - i * 3, -12.5],
  spares: (i) => [5.2 + i * 1.6, 7.6],
};

/** A few bowl-shaped craters with raised rims, deterministic, kept away from the base. */
const CRATERS = Array.from({ length: 7 }, (_, i) => {
  const a = hash2(i, 31) * Math.PI * 2;
  const r = 50 + hash2(i, 32) * 60;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, R: 6 + hash2(i, 33) * 14, depth: 1.5 + hash2(i, 34) * 3 };
});
function craterField(x, z) {
  let h = 0;
  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z) / c.R;
    if (d > 1.4) continue;
    const bowl = -c.depth * (1 - smoothstep(0.55, 1, d)) * (1 - d * d * 0.3);
    const rim = c.depth * 0.45 * (1 - smoothstep(0.0, 0.4, Math.abs(d - 1))) ;
    h += bowl + rim;
  }
  return h;
}

function makeSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class OutpostScene {
  constructor() {
    this.container = null;
    this.renderer = null;
    this.model = null;
    this.phase = 0.3; // time of sol actually drawn
    this.solAnim = null;
    this.vis = { tau: 0.5, dust: 0, storm: 0, sep: 0, night: 0 };
    this.clockLast = 0;
    this.elapsed = 0;
    this.running = false;
    this.visible = true;
    this.hidden = false;
    this.paused = false;
    this.autoRotateResume = 0;
    this.lastTap = 0;
    this.hud = null;
    this.hudLast = 0;
    this.terrainKey = null;
    this.moduleMeshes = new Map();
    this.disposables = [];
    this.fps = { frames: 0, t: 0, value: 0 };
    this._raf = this._raf.bind(this);
    this._onVisibility = () => { this.hidden = document.hidden; this._tick(); };
  }

  /* ================= lifecycle ================= */
  /** @param {HTMLElement} container holds the canvas. @param {{ hudContainer?: HTMLElement }} [opts] where the labels go (defaults to the container). */
  mount(container, { hudContainer, zoom = true, backdrop = false } = {}) {
    this.container = container;
    this.hudContainer = hudContainer ?? container;
    const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.quality = 1;
    renderer.setPixelRatio(this.basePixelRatio);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.domElement.className = 'outpost3d-canvas';
    renderer.domElement.setAttribute('aria-label', '3D view of your outpost');
    renderer.domElement.setAttribute('role', 'img');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(42, 1, 0.5, CAMERA_FAR);
    // As a page backdrop only a window of the canvas is clear of panels, so stand further back and higher up:
    // the whole base fits in that window and more of the real terrain shows.
    if (backdrop) this.camera.position.set(36, 30, 43);
    else this.camera.position.set(23, 11, 27);
    this.cameraHome = this.camera.position.clone();

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.target.set(0, 2.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = ZOOM_MIN_DISTANCE;
    controls.maxDistance = backdrop ? ZOOM_MAX_BACKDROP : ZOOM_MAX_PANEL;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.44;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.32;
    // The wheel zooms only over the open outpost: HUD panels sit above the canvas, so the wheel still scrolls them.
    controls.enableZoom = zoom;
    controls.zoomSpeed = 0.7;
    controls.rotateSpeed = 0.7;
    controls.addEventListener('start', () => { controls.autoRotate = false; this.autoRotateResume = this.elapsed + 7; });
    renderer.domElement.style.touchAction = 'pan-y';
    renderer.domElement.addEventListener('pointerdown', () => this.hint?.classList.add('gone'), { passive: true });
    renderer.domElement.addEventListener('dblclick', () => this.resetCamera());
    renderer.domElement.addEventListener('touchend', (ev) => {
      const now = performance.now();
      if (now - this.lastTap < 320 && ev.touches.length === 0) this.resetCamera();
      this.lastTap = now;
    }, { passive: true });
    this.controls = controls;

    this._buildStatic();
    this._buildHud();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersection = new IntersectionObserver((entries) => { this.visible = entries.some((e) => e.isIntersecting); this._tick(); }, { threshold: 0.02 });
    this.intersection.observe(container);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.hidden = document.hidden;
    this.resize();
    this._tick();
  }

  resize() {
    if (!this.renderer || !this.container) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < 520 ? 50 : 42;
    this._applyFocus(w, h);
    this._render();
  }

  /**
   * Aim the camera so the base sits at this point of the canvas (CSS px) instead of its centre: the play screen
   * passes the middle of its clear stage window. Null restores the centre.
   */
  setFocus(point) {
    const same = point && this.focus && Math.abs(point.x - this.focus.x) < 0.5 && Math.abs(point.y - this.focus.y) < 0.5;
    if (same || (!point && !this.focus)) return;
    this.focus = point ? { x: point.x, y: point.y } : null;
    if (!this.renderer || !this.container) return;
    this._applyFocus(Math.max(1, this.container.clientWidth), Math.max(1, this.container.clientHeight));
    if (!this.running) this._render();
  }

  _applyFocus(w, h) {
    if (this.focus) this.camera.setViewOffset(w, h, w / 2 - this.focus.x, h / 2 - this.focus.y, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** Zoom in (factor < 1) or out (factor > 1) along the current view, within the zoom limits. */
  zoomBy(factor) {
    if (!this.controls) return;
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const dist = clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this._moveCameraTo(target.clone().add(offset.setLength(dist)));
  }

  zoomIn() { this.zoomBy(1 / ZOOM_STEP); }

  zoomOut() { this.zoomBy(ZOOM_STEP); }

  /** Back far enough to see every module of the camp, from the current direction. */
  showWholeCamp() {
    if (!this.controls || !this.modulesGroup) return;
    const sphere = new Box3().setFromObject(this.modulesGroup).getBoundingSphere(new Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) { this.resetCamera(); return; }
    const vFov = this.camera.fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const need = (sphere.radius * CAMP_FRAME_MARGIN) / Math.sin(Math.min(vFov, hFov) / 2);
    this.controls.maxDistance = Math.max(this.controls.maxDistance, need); // the whole camp always fits
    const offset = this.camera.position.clone().sub(this.controls.target);
    this._moveCameraTo(this.controls.target.clone().add(offset.setLength(need)));
  }

  _moveCameraTo(to) {
    this.camAnim = { from: this.camera.position.clone(), to, start: this.elapsed };
    this.controls.autoRotate = false;
    this.autoRotateResume = this.elapsed + 7;
  }

  resetCamera() {
    this.camAnim = { from: this.camera.position.clone(), to: this.cameraHome.clone(), start: this.elapsed };
    this.controls.autoRotate = !this.model?.reducedMotion;
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.resizeObserver?.disconnect();
    this.intersection?.disconnect();
    this.controls?.dispose();
    this.scene?.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
    });
    for (const d of this.disposables) d.dispose?.();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
    this.hud?.remove();
    this.hint?.remove();
    this.renderer = null;
    this.container = null;
  }

  /* ================= model updates ================= */
  update(model, { animate = true } = {}) {
    const prev = this.model;
    this.model = model;
    if (!model) return;
    const bodyChanged = !prev || prev.body !== model.body || prev.worldId !== model.worldId || prev.site?.id !== model.site?.id;
    if (bodyChanged) this._loadTerrain(model);
    if (model.lockTime) {
      this.phase = model.timeOfSol;
      this.solAnim = null;
    } else if (animate && !model.reducedMotion && prev && !prev.lockTime && prev.sol !== model.sol && prev.body === model.body) {
      const from = this.phase;
      const to = from + 1 + (((model.timeOfSol - from) % 1) + 1) % 1;
      this.solAnim = { from, to, start: this.elapsed };
    } else if (!prev || bodyChanged) {
      this.phase = model.timeOfSol;
      this.vis.tau = model.tau;
      this.vis.dust = model.dust;
      this.vis.storm = model.stormActive ? 1 : 0;
      this.vis.sep = model.sepActive ? 1 : 0;
    }
    this._syncModules(model);
    this._syncShield(model);
    this.controls.autoRotate = !model.pendingCard && !model.reducedMotion && this.elapsed > this.autoRotateResume;
    this._updateHud(true);
    this._tick();
  }

  /* ================= static scene ================= */
  _buildStatic() {
    const scene = this.scene;
    const pal = PALETTE.mars;

    // Sky dome
    this.skyUniforms = {
      uZenith: { value: new Color(pal.dayZenith) },
      uHorizon: { value: new Color(pal.dayHorizon) },
      uBelow: { value: new Color(pal.below) },
      uSunDir: { value: new Vector3(0, 1, 0) },
      uSunColor: { value: new Color(pal.sunDay) },
      uSunDisc: { value: 1 },
      uDiscCos: { value: SUN_DISC_COS },
      uDiscSolid: { value: 0 },
      uGlow: { value: 1 },
      uStars: { value: 0 },
      uAurora: { value: 0 },
      uTime: { value: 0 },
      uHaze: { value: 0 },
    };
    const skyMat = new ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: BackSide, depthWrite: false, fog: false });
    this.sky = new Mesh(new SphereGeometry(SKY_RADIUS, 40, 24), skyMat);
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    scene.fog = new Fog(new Color(pal.dayHorizon), 80, 300);

    // Lights: one shadow-casting sun, a soft sky/ground hemisphere, a cool rim light and two habitat lamps.
    this.sun = new DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.camera.left = -42;
    this.sun.shadow.camera.right = 42;
    this.sun.shadow.camera.top = 42;
    this.sun.shadow.camera.bottom = -42;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun, this.sun.target);
    this.hemi = new HemisphereLight(new Color(pal.hemiSky), new Color(pal.hemiGround), 0.6);
    scene.add(this.hemi);
    this.rim = new DirectionalLight(new Color(pal.rim), 0.35);
    scene.add(this.rim);
    this.lamp = new PointLight(0xffc98a, 0, 26, 1.6);
    this.lamp.position.set(2.5, 3.6, 5.5);
    scene.add(this.lamp);
    this.beacon = new PointLight(0xff3b3b, 0, 40, 1.2);
    this.beacon.position.set(0, 7.5, 0);
    scene.add(this.beacon);

    // Shared materials
    const m = (opts) => { const mat = new MeshStandardMaterial(opts); this.disposables.push(mat); return mat; };
    this.mats = {
      hull: m({ color: 0xdfe3ea, roughness: 0.55, metalness: 0.15 }),
      hullDark: m({ color: 0x5c6472, roughness: 0.6, metalness: 0.4 }),
      metal: m({ color: 0x8e96a3, roughness: 0.35, metalness: 0.7 }),
      frame: m({ color: 0x2b3140, roughness: 0.6, metalness: 0.5 }),
      accent: m({ color: new Color(UI.accent), roughness: 0.5, metalness: 0.1 }),
      panel: m({ color: 0x18285c, roughness: 0.25, metalness: 0.6 }),
      glass: m({ color: 0x9fd8c8, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.45, emissive: 0x2f8f5f, emissiveIntensity: 0 }),
      plant: m({ color: 0x3cae4e, roughness: 0.8 }),
      window: m({ color: 0x1b2230, emissive: 0xffd08a, emissiveIntensity: 0.1, roughness: 0.3 }),
      glow: m({ color: 0x7fd0ff, emissive: 0x6fc8ff, emissiveIntensity: 0, roughness: 0.3 }),
      led: m({ color: 0x224433, emissive: new Color(UI.good), emissiveIntensity: 1.2, roughness: 0.4 }),
      blink: m({ color: 0x551111, emissive: 0xff2a2a, emissiveIntensity: 0, roughness: 0.4 }),
      strobe: m({ color: 0x331111, emissive: 0xff2a2a, emissiveIntensity: 0, roughness: 0.4 }),
      regolith: m({ color: new Color(pal.regolith), roughness: 1, metalness: 0 }),
      rock: m({ color: 0x7a4a33, roughness: 0.95, metalness: 0 }),
      suit: m({ color: 0xf4f6fa, roughness: 0.7 }),
      visor: m({ color: 0xffc14a, roughness: 0.1, metalness: 0.9 }),
      tire: m({ color: 0x1a1d24, roughness: 0.95 }),
    };

    // Terrain placeholder (real texture arrives async)
    const geo = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
    geo.rotateX(-Math.PI / 2);
    this.terrain = new Mesh(geo, m({ color: new Color(pal.regolith), roughness: 1, metalness: 0 }));
    this.terrain.receiveShadow = true;
    scene.add(this.terrain);

    // Rocks (one instanced mesh)
    this.rocks = new InstancedMesh(new DodecahedronGeometry(1, 0), this.mats.rock, ROCK_CAPACITY);
    this.rocks.castShadow = true;
    this.rocks.receiveShadow = true;
    scene.add(this.rocks);

    // Habitat
    this.habitat = this._buildHabitat();
    scene.add(this.habitat);
    this.berms = new Group();
    scene.add(this.berms);
    this.modulesGroup = new Group();
    scene.add(this.modulesGroup);

    // Dust storm particles
    const N = 300;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (hash2(i, 1) - 0.5) * 120;
      pos[i * 3 + 1] = hash2(i, 2) * 22 + 0.5;
      pos[i * 3 + 2] = (hash2(i, 3) - 0.5) * 120;
    }
    const pg = new BufferGeometry();
    pg.setAttribute('position', new BufferAttribute(pos, 3));
    this.dustSprite = makeSpriteTexture();
    this.disposables.push(this.dustSprite);
    this.dustMat = new PointsMaterial({ color: 0xd8a070, size: 2.6, map: this.dustSprite, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    this.dust = new Points(pg, this.dustMat);
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    // SEP sky sparkle (fewer, additive, high up)
    const S = 120;
    const sp = new Float32Array(S * 3);
    for (let i = 0; i < S; i++) {
      const a = hash2(i, 7) * Math.PI * 2;
      const r = 60 + hash2(i, 8) * 160;
      sp[i * 3] = Math.cos(a) * r;
      sp[i * 3 + 1] = 25 + hash2(i, 9) * 90;
      sp[i * 3 + 2] = Math.sin(a) * r;
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(sp, 3));
    this.sparkMat = new PointsMaterial({ color: 0x9cffd0, size: 3.5, map: this.dustSprite, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
    this.sparks = new Points(sg, this.sparkMat);
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);

    // EVA astronaut
    this.astronaut = this._buildAstronaut();
    this.astronaut.visible = false;
    scene.add(this.astronaut);
  }

  _buildHabitat() {
    const g = new Group();
    const { hull, hullDark, metal, frame, window: win, accent, strobe } = this.mats;
    const cyl = new CylinderGeometry(2.5, 2.5, 7.5, 28, 1);
    cyl.rotateZ(Math.PI / 2);
    const cap = new SphereGeometry(2.5, 24, 16);
    const addModule = (x, z, rotY) => {
      const sub = new Group();
      const body = new Mesh(cyl, hull);
      body.castShadow = body.receiveShadow = true;
      sub.add(body);
      for (const sx of [-3.75, 3.75]) {
        const c = new Mesh(cap, hull);
        c.position.x = sx;
        c.scale.set(0.5, 1, 1);
        c.castShadow = true;
        sub.add(c);
      }
      // ribs
      for (let i = -2; i <= 2; i++) {
        const rib = new Mesh(new TorusGeometry(2.55, 0.09, 8, 36), hullDark);
        rib.rotation.y = Math.PI / 2;
        rib.position.x = i * 1.6;
        sub.add(rib);
      }
      // windows along the side
      for (let i = -1; i <= 1; i++) {
        const w = new Mesh(new BoxGeometry(0.9, 0.55, 0.12), win);
        w.position.set(i * 2.2, 0.8, 2.42);
        sub.add(w);
        const w2 = w.clone();
        w2.position.z = -2.42;
        sub.add(w2);
      }
      // legs
      for (const lx of [-2.6, 2.6]) for (const lz of [-1.6, 1.6]) {
        const leg = new Mesh(new CylinderGeometry(0.16, 0.22, 1.4, 8), frame);
        leg.position.set(lx, -2.2, lz);
        sub.add(leg);
        const foot = new Mesh(new CylinderGeometry(0.5, 0.6, 0.18, 10), frame);
        foot.position.set(lx, -2.85, lz);
        sub.add(foot);
      }
      sub.position.set(x, 2.9, z);
      sub.rotation.y = rotY;
      g.add(sub);
      return sub;
    };
    addModule(-2.2, -1.2, 0);
    addModule(2.2, 2.4, Math.PI / 2);
    // node joining them
    const node = new Mesh(new CylinderGeometry(2.1, 2.1, 5.2, 20), hull);
    node.position.set(2.2, 2.6, -1.2);
    node.castShadow = true;
    g.add(node);
    const nodeTop = new Mesh(new SphereGeometry(2.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hullDark);
    nodeTop.position.set(2.2, 5.2, -1.2);
    g.add(nodeTop);
    // airlock toward the camera
    const lock = new Mesh(new CylinderGeometry(1.3, 1.3, 3.2, 18), hullDark);
    lock.rotation.x = Math.PI / 2;
    lock.position.set(-2.2, 1.6, 2.6);
    lock.castShadow = true;
    g.add(lock);
    const door = new Mesh(new CylinderGeometry(1.0, 1.0, 0.2, 18), accent);
    door.rotation.x = Math.PI / 2;
    door.position.set(-2.2, 1.6, 4.25);
    g.add(door);
    const ramp = new Mesh(new BoxGeometry(2.4, 0.2, 3.2), frame);
    ramp.position.set(-2.2, 0.35, 5.6);
    ramp.rotation.x = -0.18;
    g.add(ramp);
    // mast with strobe
    const mast = new Mesh(new CylinderGeometry(0.08, 0.1, 3, 8), metal);
    mast.position.set(2.2, 6.6, -1.2);
    g.add(mast);
    this.strobeMesh = new Mesh(new SphereGeometry(0.42, 12, 8), strobe);
    this.strobeMesh.position.set(2.2, 8.2, -1.2);
    g.add(this.strobeMesh);
    // porch lamp fixture
    const lampBox = new Mesh(new BoxGeometry(0.4, 0.25, 0.3), win);
    lampBox.position.set(-2.2, 3.4, 4.1);
    g.add(lampBox);
    return g;
  }

  _buildAstronaut() {
    const g = new Group();
    const { suit, visor, frame, accent } = this.mats;
    const torso = new Mesh(new CapsuleGeometry(0.34, 0.6, 6, 12), suit);
    torso.position.y = 1.05;
    torso.castShadow = true;
    g.add(torso);
    const helmet = new Mesh(new SphereGeometry(0.3, 16, 12), suit);
    helmet.position.y = 1.75;
    g.add(helmet);
    const vis = new Mesh(new SphereGeometry(0.22, 12, 8, 0, Math.PI), visor);
    vis.position.set(0, 1.75, 0.12);
    g.add(vis);
    const pack = new Mesh(new BoxGeometry(0.5, 0.6, 0.3), frame);
    pack.position.set(0, 1.15, -0.4);
    g.add(pack);
    const stripe = new Mesh(new BoxGeometry(0.6, 0.08, 0.6), accent);
    stripe.position.y = 1.3;
    g.add(stripe);
    this.legs = [];
    for (const sx of [-0.18, 0.18]) {
      const leg = new Mesh(new CapsuleGeometry(0.13, 0.5, 4, 8), suit);
      leg.position.set(sx, 0.45, 0);
      g.add(leg);
      this.legs.push(leg);
    }
    this.arms = [];
    for (const sx of [-0.45, 0.45]) {
      const arm = new Mesh(new CapsuleGeometry(0.11, 0.5, 4, 8), suit);
      arm.position.set(sx, 1.1, 0);
      g.add(arm);
      this.arms.push(arm);
    }
    return g;
  }

  /* ================= terrain ================= */
  /** Ground, pools, star and giant planet for a world with a look: all generated, no imagery. */
  _loadLookTerrain(look) {
    const ground = outpostGround(look, { size: LOOK_MAP_SIZE, extentM: TERRAIN_SIZE });
    const t = dataTexture(ground.map, { anisotropy: Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() ?? 1) });
    t.wrapS = t.wrapT; // the map covers the ground once, edge to edge
    t.repeat.y = -1; // the plane's UVs run south to north, the map's rows north to south
    t.offset.y = 1;
    const old = this.terrain.material;
    this.terrain.material = new MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.4, roughness: look.ground === 'ice-shell' ? 0.6 : 1, metalness: 0 });
    old.map?.dispose?.();
    old.dispose();
    this._displace(null, 'mars', ground.heightAt);
    this._buildSkirt(ground.heightAt, look.groundColors.base ?? look.groundColors.rock);
    this.rocks.count = Math.min(ROCK_CAPACITY, Math.round(ROCK_CAPACITY * look.rockDensity * 1.5));
    this._scatterRocks('mars');
    if (ground.poolLevel !== null) {
      const mat = createPoolMaterial(look, { tiles: POOL_TILES });
      const geo = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE);
      geo.rotateX(-Math.PI / 2);
      const mesh = new Mesh(geo, mat.material);
      mesh.position.y = ground.poolLevel;
      mesh.receiveShadow = !mat.glow;
      this.scene.add(mesh);
      this.pool = { mesh, mat, geo };
    }
    if (look.parent?.visible) {
      this.parentBody = createParentBody(look.parent, { distance: PARENT_DISTANCE, sunDir: this.skyUniforms.uSunDir.value });
      this.parentBody.setDirection(outpostParentDirection(this.model?.site));
      this.scene.add(this.parentBody.group);
    }
    this._render();
  }

  _clearLookExtras() {
    if (this.pool) { this.scene.remove(this.pool.mesh); this.pool.geo.dispose(); this.pool.mat.dispose(); this.pool = null; }
    if (this.parentBody) { this.scene.remove(this.parentBody.group); this.parentBody.dispose(); this.parentBody = null; }
  }

  async _loadTerrain(model) {
    const key = `${model.worldId ?? model.body}:${model.site?.id}`;
    if (this.terrainKey === key) return;
    this.terrainKey = key;
    // Worlds other than the Moon and Mars are painted from their look; those two keep the NASA Trek terrain.
    const look = lookFor(model.worldId, model.site);
    this.look = look;
    this.lookPal = look ? outpostPalette(look) : null;
    this._clearLookExtras();
    const star = look ? outpostStar(look) : null;
    this.skyUniforms.uDiscCos.value = star ? star.discCos : SUN_DISC_COS;
    this.skyUniforms.uDiscSolid.value = star ? star.solid : 0;
    this.rocks.count = ROCK_CAPACITY;
    const pal = this.lookPal ?? PALETTE[model.body] ?? PALETTE.mars;
    this.mats.regolith.color.set(pal.regolith);
    this.mats.rock.color.set(look ? look.groundColors.rock : model.body === 'moon' ? 0x6d6d70 : 0x7a4a33);
    this.hemi.color.set(pal.hemiSky);
    this.hemi.groundColor.set(pal.hemiGround);
    this.rim.color.set(pal.rim);
    if (look) { this._loadLookTerrain(look); return; }
    if (this.terrain.material.map) { // coming back from a generated world: start again from the plain placeholder
      const old = this.terrain.material;
      this.terrain.material = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
      old.map.dispose();
      old.dispose();
    }
    this.terrain.material.color.set(pal.regolith);
    this._displace(null, model.body);
    this._buildSkirt(this._bodyHeight(model.body), pal.regolith);
    this._scatterRocks(model.body);
    let tex;
    try {
      tex = await buildTerrainTexture(model.body, model.site, { size: 1024, radiusDeg: model.body === 'moon' ? 10 : 14 });
    } catch {
      tex = null;
    }
    if (this.terrainKey !== key || !this.renderer) return;
    if (tex) {
      const t = new CanvasTexture(tex.canvas);
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() ?? 1);
      const old = this.terrain.material;
      this.terrain.material = new MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: model.body === 'moon' ? 0.5 : 0.35, roughness: 1, metalness: 0 });
      old.map?.dispose?.();
      old.dispose();
      this._displace(tex, model.body);
      this._scatterRocks(model.body);
    }
    this._render();
  }

  _heightAt(x, z) {
    const h = this.heightField;
    if (!h) return 0;
    const u = x / TERRAIN_SIZE + 0.5;
    const v = z / TERRAIN_SIZE + 0.5;
    const i = clamp(Math.round(u * TERRAIN_SEGS), 0, TERRAIN_SEGS);
    const j = clamp(Math.round(v * TERRAIN_SEGS), 0, TERRAIN_SEGS);
    return h[j * (TERRAIN_SEGS + 1) + i];
  }

  /**
   * The ground height of a Moon or Mars site: the small Trek-driven bumps near the camp and rim hills that fade
   * into open plains. Returns (x, z, lum) -> metres; lum is the Trek image brightness under the point (0.5 when unknown).
   */
  _bodyHeight(body) {
    const amp = body === 'moon' ? 1.25 : 1;
    return (x, z, lum = 0.5) => {
      const d = Math.hypot(x, z);
      const flat = smoothstep(26, 48, d) * (1 - smoothstep(RELIEF_FADE_R[0], RELIEF_FADE_R[1], d));
      const relief = d < RELIEF_FADE_R[1]
        ? (lum - 0.5) * 6 + (fbm(x * 0.012 + 3, z * 0.012 + 9, 4) - 0.5) * 5 + (fbm(x * 0.06, z * 0.06, 3) - 0.5) * 1.2 + craterField(x, z)
        : 0;
      const hills = smoothstep(80, 128, d) * (1 - smoothstep(RIM_HILLS_FADE_R[0], RIM_HILLS_FADE_R[1], d)) * (10 + fbm(x * 0.025, z * 0.025, 3) * 16) * amp;
      return relief * flat * amp + hills;
    };
  }

  /** heightFn: when given (worlds with a look) it sets the height directly; otherwise _bodyHeight(body). */
  _displace(tex, body, heightFn = null) {
    const geo = this.terrain.geometry;
    const pos = geo.attributes.position;
    const n = TERRAIN_SEGS + 1;
    const heights = new Float32Array(n * n);
    const bodyHeight = heightFn ? null : this._bodyHeight(body);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        const x = pos.getX(idx);
        const z = pos.getZ(idx);
        let lum = 0.5;
        if (!heightFn && tex) {
          const ti = clamp(Math.floor((i / TERRAIN_SEGS) * (tex.size - 1)), 0, tex.size - 1);
          const tj = clamp(Math.floor((j / TERRAIN_SEGS) * (tex.size - 1)), 0, tex.size - 1);
          lum = tex.lum[tj * tex.size + ti] - tex.meanLum + 0.5;
        }
        heights[idx] = (heightFn ? heightFn(x, z) : bodyHeight(x, z, lum)) - 0.02;
        pos.setY(idx, heights[idx]);
      }
    }
    this.heightField = heights;
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /** The far ground ring. heightAt in metres; colour a CSS/hex colour, varied a little so it does not look flat. */
  _buildSkirt(heightAt, color) {
    this._clearSkirt();
    const geo = polarGeometry((x, z) => heightAt(x, z) - SKIRT_SINK, { segs: SKIRT_SEGS, r0: SKIRT_R0, rMax: SKIRT_RMAX });
    const pos = geo.attributes.position;
    const base = new Color(color);
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i += 1) {
      const k = 0.82 + 0.3 * fbm(pos.getX(i) * 0.004 + 5, pos.getZ(i) * 0.004 + 7, 3);
      c.copy(base).multiplyScalar(k);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    this.skirt = new Mesh(geo, mat);
    this.skirt.receiveShadow = false;
    this.scene.add(this.skirt);
  }

  _clearSkirt() {
    if (!this.skirt) return;
    this.scene.remove(this.skirt);
    this.skirt.geometry.dispose();
    this.skirt.material.dispose();
    this.skirt = null;
  }

  _scatterRocks(body) {
    const dummy = new Object3D();
    let k = 0;
    for (let i = 0; i < this.rocks.count; i++) {
      const a = hash2(i, 11) * Math.PI * 2;
      const r = 22 + Math.pow(hash2(i, 12), 0.7) * 95;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const s = 0.25 + Math.pow(hash2(i, 13), 2.2) * (body === 'moon' ? 3.2 : 2.4);
      dummy.position.set(x, this._heightAt(x, z) - s * 0.35, z);
      dummy.rotation.set(hash2(i, 14) * 3, hash2(i, 15) * 3, hash2(i, 16) * 3);
      dummy.scale.set(s * (0.8 + hash2(i, 17) * 0.6), s * (0.5 + hash2(i, 18) * 0.5), s);
      dummy.updateMatrix();
      this.rocks.setMatrixAt(k++, dummy.matrix);
    }
    this.rocks.instanceMatrix.needsUpdate = true;
  }

  /* ================= modules ================= */
  _syncModules(model) {
    const wanted = new Set();
    for (const [id, info] of Object.entries(model.modules ?? {})) {
      const slot = SLOTS[id];
      if (!slot) continue;
      for (let i = 0; i < Math.min(info.count, 9); i++) {
        const key = `${id}#${i}`;
        wanted.add(key);
        let entry = this.moduleMeshes.get(key);
        if (!entry) {
          const mesh = this._buildModule(id, i, model);
          if (!mesh) continue;
          const [x, z] = slot(i);
          mesh.position.set(x, this._heightAt(x, z), z);
          const light = new Mesh(new SphereGeometry(0.3, 10, 8), this.mats.blink);
          light.position.set(0, mesh.userData.top ?? 3, 0);
          light.visible = false;
          mesh.add(light);
          this.modulesGroup.add(mesh);
          entry = { mesh, light, id };
          this.moduleMeshes.set(key, entry);
        }
        entry.light.visible = !info.online;
        entry.online = info.online;
      }
    }
    for (const [key, entry] of this.moduleMeshes) {
      if (!wanted.has(key)) {
        this.modulesGroup.remove(entry.mesh);
        entry.mesh.traverse((o) => o.geometry?.dispose?.());
        this.moduleMeshes.delete(key);
      }
    }
    this.mats.glass.emissiveIntensity = model.modules?.greenhouse?.online ? 0.45 : 0;
  }

  _buildModule(id, index, model) {
    const M = this.mats;
    const g = new Group();
    const shadow = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
    const towardSun = (model.site?.lat ?? 0) >= 0 ? 1 : -1;
    switch (id) {
      case 'solar': {
        for (const dz of [-1.2, 1.2]) {
          const post = new Mesh(new CylinderGeometry(0.1, 0.12, 1.2, 8), M.frame);
          post.position.set(0, 0.6, dz);
          g.add(post);
        }
        const panel = shadow(new Mesh(new BoxGeometry(4.4, 0.08, 2.6), M.panel));
        panel.position.y = 1.35;
        panel.rotation.z = -0.5 * towardSun;
        g.add(panel);
        const grid = new Mesh(new BoxGeometry(4.5, 0.02, 2.7), M.frame);
        grid.position.y = 1.3;
        grid.rotation.z = panel.rotation.z;
        g.add(grid);
        g.userData.top = 2.6;
        break;
      }
      case 'fission': {
        const base = shadow(new Mesh(new CylinderGeometry(1.5, 1.7, 0.6, 16), M.frame));
        base.position.y = 0.3;
        g.add(base);
        const tower = shadow(new Mesh(new CylinderGeometry(0.75, 0.9, 4.2, 16), M.metal));
        tower.position.y = 2.7;
        g.add(tower);
        for (let i = 0; i < 6; i++) {
          const fin = shadow(new Mesh(new BoxGeometry(0.08, 3.2, 2.2), M.hullDark));
          fin.position.set(0, 3, 0);
          fin.rotation.y = (i / 6) * Math.PI;
          fin.translateZ(1.5);
          g.add(fin);
        }
        const core = new Mesh(new SphereGeometry(0.55, 16, 12), M.glow);
        core.position.y = 5.3;
        g.add(core);
        g.userData.glow = core;
        g.userData.top = 6.1;
        break;
      }
      case 'battery': {
        for (let i = 0; i < 3; i++) {
          const box = shadow(new Mesh(new BoxGeometry(1.5, 0.9, 1), M.hullDark));
          box.position.set(0, 0.45 + i * 0.95, 0);
          g.add(box);
          const led = new Mesh(new BoxGeometry(0.12, 0.12, 0.05), M.led);
          led.position.set(0.5, 0.45 + i * 0.95, 0.53);
          g.add(led);
        }
        g.userData.top = 3.1;
        break;
      }
      case 'recycler': {
        const tank = shadow(new Mesh(new CylinderGeometry(0.85, 0.85, 2.6, 18), M.hull));
        tank.rotation.z = Math.PI / 2;
        tank.position.y = 1.1;
        g.add(tank);
        for (const sx of [-1.3, 1.3]) {
          const c = new Mesh(new SphereGeometry(0.85, 16, 10), M.hull);
          c.position.set(sx, 1.1, 0);
          c.scale.x = 0.4;
          g.add(c);
        }
        const pipe = new Mesh(new CylinderGeometry(0.1, 0.1, 2.2, 8), M.metal);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(0, 0.35, 0.7);
        g.add(pipe);
        const cradle = new Mesh(new BoxGeometry(2.4, 0.3, 1.6), M.frame);
        cradle.position.y = 0.15;
        g.add(cradle);
        g.userData.top = 2.2;
        break;
      }
      case 'oxygen': {
        for (const sx of [-0.7, 0.7]) {
          const t = shadow(new Mesh(new CapsuleGeometry(0.55, 1.6, 6, 14), M.hull));
          t.position.set(sx, 1.4, 0);
          g.add(t);
          const band = new Mesh(new TorusGeometry(0.58, 0.05, 6, 20), M.accent);
          band.rotation.x = Math.PI / 2;
          band.position.set(sx, 1.4, 0);
          g.add(band);
        }
        const base = new Mesh(new BoxGeometry(2.2, 0.3, 1.4), M.frame);
        base.position.y = 0.15;
        g.add(base);
        g.userData.top = 2.9;
        break;
      }
      case 'moxie':
      case 'regolithO2': {
        const box = shadow(new Mesh(new BoxGeometry(1.8, 1.4, 1.8), M.hullDark));
        box.position.y = 0.7;
        g.add(box);
        const vent = shadow(new Mesh(new CylinderGeometry(0.22, 0.28, 1.6, 10), M.metal));
        vent.position.set(0.5, 2.1, -0.4);
        g.add(vent);
        const hood = new Mesh(new ConeGeometry(0.42, 0.35, 10), M.metal);
        hood.position.set(0.5, 3.0, -0.4);
        g.add(hood);
        if (id === 'regolithO2') {
          const hopper = shadow(new Mesh(new ConeGeometry(0.9, 1.2, 4), M.frame));
          hopper.rotation.y = Math.PI / 4;
          hopper.position.set(-1.3, 1.6, 0);
          g.add(hopper);
        }
        const stripe = new Mesh(new BoxGeometry(1.82, 0.18, 1.82), M.accent);
        stripe.position.y = 1.2;
        g.add(stripe);
        g.userData.top = 3.5;
        break;
      }
      case 'iceDrill': {
        for (let i = 0; i < 3; i++) {
          const leg = shadow(new Mesh(new CylinderGeometry(0.1, 0.14, 6, 8), M.frame));
          const a = (i / 3) * Math.PI * 2;
          leg.position.set(Math.cos(a) * 1.4, 2.9, Math.sin(a) * 1.4);
          leg.lookAt(0, 6.2, 0);
          leg.rotateX(Math.PI / 2);
          g.add(leg);
        }
        const head = shadow(new Mesh(new BoxGeometry(1.2, 0.8, 1.2), M.metal));
        head.position.y = 6.2;
        g.add(head);
        const drill = new Mesh(new CylinderGeometry(0.14, 0.14, 5.6, 8), M.metal);
        drill.position.y = 3;
        g.add(drill);
        const bit = new Mesh(new ConeGeometry(0.3, 0.6, 8), M.accent);
        bit.position.y = 0.3;
        g.add(bit);
        const housing = shadow(new Mesh(new BoxGeometry(2.2, 1, 1.4), M.hullDark));
        housing.position.set(0, 0.5, -1.9);
        g.add(housing);
        g.userData.top = 7;
        break;
      }
      case 'greenhouse': {
        const dome = new Mesh(new SphereGeometry(3.3, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
        dome.position.y = 0.3;
        dome.castShadow = false;
        dome.renderOrder = 5;
        g.add(dome);
        const ring = shadow(new Mesh(new CylinderGeometry(3.4, 3.5, 0.4, 28), M.hullDark));
        ring.position.y = 0.2;
        g.add(ring);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const r = 1 + (i % 3) * 0.8;
          const plant = new Mesh(new SphereGeometry(0.45 + (i % 2) * 0.2, 8, 6), M.plant);
          plant.position.set(Math.cos(a) * r, 0.75, Math.sin(a) * r);
          plant.scale.y = 1.3;
          g.add(plant);
        }
        const tube = shadow(new Mesh(new CylinderGeometry(0.9, 0.9, 5.5, 14), M.hull));
        tube.rotation.z = Math.PI / 2;
        tube.rotation.y = 0.75;
        tube.position.set(-3.6, 1, -3.3);
        g.add(tube);
        g.userData.top = 3.9;
        break;
      }
      case 'shelter': {
        const bunker = shadow(new Mesh(new BoxGeometry(4.6, 1.5, 3.4), M.regolith));
        bunker.position.y = 0.6;
        g.add(bunker);
        const roof = shadow(new Mesh(new CylinderGeometry(1.7, 1.7, 4.6, 16, 1, false, 0, Math.PI), M.regolith));
        roof.rotation.z = Math.PI / 2;
        roof.rotation.y = Math.PI / 2;
        roof.position.y = 1.3;
        g.add(roof);
        const door = new Mesh(new BoxGeometry(1.1, 1.3, 0.2), M.hullDark);
        door.position.set(0, 0.7, 1.75);
        g.add(door);
        const sign = new Mesh(new BoxGeometry(0.5, 0.5, 0.06), M.accent);
        sign.position.set(1, 1.2, 1.78);
        g.add(sign);
        g.userData.top = 3.2;
        break;
      }
      case 'rover': {
        const body = shadow(new Mesh(new BoxGeometry(2.8, 1.1, 1.7), M.hull));
        body.position.y = 1.15;
        g.add(body);
        const cab = shadow(new Mesh(new BoxGeometry(1.2, 0.8, 1.5), M.hullDark));
        cab.position.set(1, 1.95, 0);
        g.add(cab);
        const screen = new Mesh(new BoxGeometry(0.1, 0.5, 1.2), M.visor);
        screen.position.set(1.62, 2.0, 0);
        g.add(screen);
        for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
          const wheel = shadow(new Mesh(new CylinderGeometry(0.42, 0.42, 0.35, 14), M.tire));
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(sx * 1.05, 0.42, sz * 1.0);
          g.add(wheel);
        }
        const mast = new Mesh(new CylinderGeometry(0.05, 0.05, 1.2, 6), M.metal);
        mast.position.set(-1, 2.3, 0.5);
        g.add(mast);
        g.userData.top = 3.1;
        break;
      }
      case 'relay': {
        const mast = shadow(new Mesh(new CylinderGeometry(0.1, 0.14, 4.2, 8), M.metal));
        mast.position.y = 2.1;
        g.add(mast);
        const dish = shadow(new Mesh(new SphereGeometry(1.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3.2), M.hull));
        dish.position.set(0, 4.6, 0);
        dish.rotation.x = -Math.PI / 2 + 0.75;
        dish.scale.y = 0.45;
        g.add(dish);
        const feed = new Mesh(new CylinderGeometry(0.04, 0.04, 1.1, 6), M.metal);
        feed.position.set(0, 4.9, 0.55);
        feed.rotation.x = 0.75;
        g.add(feed);
        const light = new Mesh(new SphereGeometry(0.13, 8, 6), M.led);
        light.position.set(0, 4.35, 0);
        g.add(light);
        g.userData.relayLight = light;
        const feet = new Mesh(new CylinderGeometry(0.9, 1.1, 0.3, 10), M.frame);
        feet.position.y = 0.15;
        g.add(feet);
        g.userData.top = 5.6;
        break;
      }
      case 'spares': {
        for (let i = 0; i < 2; i++) {
          const crate = shadow(new Mesh(new BoxGeometry(0.9, 0.7, 0.9), M.accent));
          crate.position.set(i * 0.5, 0.35 + i * 0.7, i * 0.3);
          crate.rotation.y = i * 0.4;
          g.add(crate);
        }
        g.userData.top = 1.9;
        break;
      }
      default:
        return null;
    }
    g.rotation.y = hash2(index, 21) * 0.3 - 0.15;
    return g;
  }

  _syncShield(model) {
    const level = model.shieldLevel ?? 0;
    if (this.bermLevel === level) return;
    this.bermLevel = level;
    for (const c of [...this.berms.children]) { this.berms.remove(c); c.geometry?.dispose?.(); }
    if (level <= 0) return;
    const mat = this.mats.regolith;
    const mk = (geo, x, y, z, sx, sy, sz) => {
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = mesh.receiveShadow = true;
      this.berms.add(mesh);
    };
    const tube = level === 1 ? 1.6 : 2.6;
    // berm rings around each cylinder (two cylinders of the habitat)
    mk(new TorusGeometry(4.4, tube, 10, 36), -2.2, 0, -1.2, 1.25, 0.55 + level * 0.12, 0.95);
    mk(new TorusGeometry(4.4, tube, 10, 36), 2.2, 0, 2.4, 0.95, 0.55 + level * 0.12, 1.25);
    if (level >= 3) {
      // buried base: a soft regolith shell over the modules; the airlock and node still poke out
      mk(new SphereGeometry(1, 28, 18), -2.2, 0.4, -1.2, 6.2, 4.6, 4.3);
      mk(new SphereGeometry(1, 28, 18), 2.2, 0.4, 2.4, 4.3, 4.6, 6.2);
    }
  }

  /* ================= HUD ================= */
  _buildHud() {
    const hud = document.createElement('div');
    hud.className = 'outpost3d-hud';
    hud.innerHTML = '<div class="o3d-sol"></div><div class="o3d-time"></div><div class="o3d-tags"></div><div class="o3d-credit"></div>';
    this.hudContainer.appendChild(hud);
    const hint = document.createElement('div');
    hint.className = 'outpost3d-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Drag to look around · scroll or + − to zoom · double-tap to reset';
    this.hudContainer.appendChild(hint);
    this.hud = hud;
    this.hint = hint;
    this.hudSol = hud.querySelector('.o3d-sol');
    this.hudTime = hud.querySelector('.o3d-time');
    this.hudTags = hud.querySelector('.o3d-tags');
    this.hudCredit = hud.querySelector('.o3d-credit');
  }

  /** The overlay mirrors what the scene is actually drawing (sun height, storm, radiation, blackout). */
  _updateHud(force = false) {
    const m = this.model;
    if (!m || !this.hud) return;
    if (!force && this.elapsed - this.hudLast < 0.25) return;
    this.hudLast = this.elapsed;
    const sunY = this._sunDir().y;
    const isMoon = m.body === 'moon';
    let when;
    if (isMoon && !m.lit) when = 'Lunar night';
    else if (sunY < -0.03) when = 'Night';
    else if (sunY < 0.08) when = this.phase < 0.5 ? 'Sunrise' : 'Sunset';
    else when = this.phase < 0.42 ? 'Morning' : this.phase < 0.58 ? 'Midday' : 'Afternoon';
    const solLabel = m.hasMission ? `${isMoon ? 'Day' : 'Sol'} ${m.sol} · ${when}` : m.site?.name ?? '';
    const timeLabel = `${m.site?.name ?? ''}${m.tempC != null ? ` · ${Math.round(m.tempC)} °C` : ''}`;
    const credit = this.look ? 'Ground: generated from world facts' : `Terrain: NASA ${isMoon ? 'Moon' : 'Mars'} Trek`;
    if (this.hudCredit.textContent !== credit) this.hudCredit.textContent = credit;
    if (this.hudSol.textContent !== solLabel) this.hudSol.textContent = solLabel;
    if (this.hudTime.textContent !== timeLabel) this.hudTime.textContent = timeLabel;
    const tags = [];
    if (m.stormActive) tags.push(['danger', 'Dust storm']);
    if (m.sepActive) tags.push(['danger', 'Radiation storm']);
    if (m.blackout) tags.push(['warn', 'Comms blackout']);
    if (isMoon && !m.lit) tags.push(['warn', 'Night: no solar']);
    if (m.crewOutside) tags.push(['good', `${m.crewOutside} on EVA`]);
    const key = tags.map(([tone, text]) => `${tone}:${text}`).join('|');
    if (this.hudTagsKey !== key) {
      this.hudTagsKey = key;
      this.hudTags.replaceChildren(...tags.map(([tone, text]) => {
        const tag = document.createElement('span');
        tag.className = `o3d-tag ${tone}`;
        tag.textContent = text; // crew names are player input: text only, never HTML
        return tag;
      }));
    }
  }

  /* ================= per-frame ================= */
  _sunDir() {
    const m = this.model;
    if (this.look?.starFixed) { // tidally locked: the star never moves
      const d = outpostFixedStar(this.look, m?.site);
      return new Vector3(d.x, d.y, d.z);
    }
    const lat = (m?.site?.lat ?? 0) * DEG;
    // phase is a whole sol: 0 midnight, 0.25 sunrise (east), 0.5 noon, 0.75 sunset (west)
    const theta = (this.phase - 0.25) * Math.PI * 2;
    // tilt the arc toward the equator; polar sites get a sun that skims the horizon all sol long
    const tilt = clamp(lat, -1.52, 1.52);
    const seasonLift = ((m?.daylightFraction ?? 0.5) - 0.5) * 0.7; // long summer days keep the sun up longer
    let x = Math.cos(theta);
    let y = Math.sin(theta) * Math.cos(tilt) + seasonLift * Math.cos(tilt);
    let z = Math.sin(theta) * Math.sin(tilt);
    if (Math.abs(tilt) > 1.45) y = Math.max(y, 0.2); // drawn higher than the real 1.5 degrees so the ground reads // polar day: the sun never quite sets while the site is lit
    if ((this.look || m?.body === 'moon') && m && !m.lit) y = -0.35;
    const v = new Vector3(x, y, z);
    if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
    return v.normalize();
  }

  _tick() {
    const shouldRun = !!this.renderer && this.visible && !this.hidden && !this.paused;
    if (shouldRun && !this.running) {
      this.running = true;
      this.clockLast = performance.now();
      this.rafId = requestAnimationFrame(this._raf);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    }
  }

  /** Slow device (no GPU, old Chromebook): render fewer pixels rather than drop frames. Only ever steps down. */
  _adaptQuality() {
    if (this.fps.value >= 24) { this.slowSeconds = 0; return; }
    this.slowSeconds = (this.slowSeconds ?? 0) + 1;
    if (this.slowSeconds < 2 || this.quality <= 0.5) return;
    this.slowSeconds = 0;
    this.quality -= 0.25;
    this.renderer.setPixelRatio(this.basePixelRatio * this.quality);
    if (this.quality <= 0.5) { this.renderer.shadowMap.enabled = false; this.sun.castShadow = false; this.noShadows = true; }
    this.resize();
  }

  /** Stops the render loop (another view is in front) without throwing the scene away. */
  setPaused(paused) {
    this.paused = Boolean(paused);
    this._tick();
  }

  _raf(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.clockLast) / 1000);
    this.clockLast = now;
    this.elapsed += dt;
    this.fps.frames++;
    this.fps.t += dt;
    if (this.fps.t >= 1) { this.fps.value = this.fps.frames / this.fps.t; this.fps.frames = 0; this.fps.t = 0; this._adaptQuality(); }
    this._step(dt);
    this._render();
    this.rafId = requestAnimationFrame(this._raf);
  }

  _step(dt) {
    const m = this.model;
    const t = this.elapsed;
    if (!m) return;
    // sol phase: either a 1.8 s arc across a whole sol, or a slow drift toward the model's time
    if (this.solAnim) {
      const k = clamp((t - this.solAnim.start) / SOL_PASS_SECONDS, 0, 1);
      this.phase = lerp(this.solAnim.from, this.solAnim.to, easeInOut(k)) % 1;
      if (k >= 1) this.solAnim = null;
    } else if (!m.lockTime) {
      this.phase += (m.timeOfSol - this.phase) * (1 - Math.exp(-dt * 0.6));
    }
    // smooth visual scalars toward the model
    const s = 1 - Math.exp(-dt * 2.5);
    this.vis.tau += (m.tau - this.vis.tau) * s;
    this.vis.dust += (m.dust - this.vis.dust) * s;
    this.vis.storm += ((m.stormActive ? 1 : 0) - this.vis.storm) * s;
    this.vis.sep += ((m.sepActive ? 1 : 0) - this.vis.sep) * s;

    const look = this.look ?? null;
    const pal = this.lookPal ?? PALETTE[m.body] ?? PALETTE.mars;
    const isMoon = look ? look.airless : m.body === 'moon'; // airless: black sky, hard light, no dust
    const sunDir = this._sunDir();
    const sunY = sunDir.y;
    const day = smoothstep(-0.04, 0.05, sunY) * (0.55 + 0.45 * smoothstep(0.05, 0.3, sunY)); // 0 night .. 1 full day; a grazing sun still lights the ground
    const low = 1 - smoothstep(0.02, 0.35, sunY); // sun near the horizon
    const night = 1 - smoothstep(-0.12, 0.02, sunY);
    const dustK = clamp(this.vis.tau / 4.5, 0, 1); // 0 clear .. 1 thick storm
    // Worlds with a look: dust only where the world has dust storms, plus the standing haze of its air.
    const tauK = look ? Math.max(look.particles.dust ? dustK : 0, outpostHaze(look)) : dustK;
    const star = look ? outpostStar(look) : null;
    const lightScale = look ? look.lightScale : 1;
    this.vis.night = night;

    // --- sky ---
    const u = this.skyUniforms;
    const zen = new Color(pal.nightZenith).lerp(new Color(pal.duskZenith), smoothstep(-0.1, 0.05, sunY)).lerp(new Color(pal.dayZenith), smoothstep(0.03, 0.3, sunY));
    const hor = new Color(pal.nightHorizon).lerp(new Color(pal.duskHorizon), smoothstep(-0.1, 0.03, sunY)).lerp(new Color(pal.dayHorizon), smoothstep(0.08, 0.35, sunY));
    if (!isMoon) {
      zen.lerp(new Color(pal.stormZenith).multiplyScalar(0.3 + 0.7 * day), tauK * 0.9);
      hor.lerp(new Color(pal.stormHorizon).multiplyScalar(0.3 + 0.7 * day), tauK * 0.9);
    }
    u.uZenith.value.copy(zen);
    u.uHorizon.value.copy(hor);
    u.uBelow.value.copy(hor).multiplyScalar(0.8);
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.set(pal.sunDay).lerp(new Color(pal.sunLow), star?.solid ? 1 : low * 0.8);
    u.uSunDisc.value = (isMoon ? 1.6 : 1 - tauK * 0.95) * (star ? star.disc / 1.4 : 1);
    u.uGlow.value = isMoon ? 0.15 : 1 - tauK * 0.6;
    u.uStars.value = isMoon ? 0.9 : night * (1 - tauK) * 0.9;
    u.uAurora.value = this.vis.sep * (isMoon ? 0.7 : 0.75 + night * 0.35);
    u.uHaze.value = tauK;
    u.uTime.value = t;

    // --- fog ---
    const fog = this.scene.fog;
    fog.color.copy(hor);
    if (isMoon) { fog.near = 900; fog.far = 2000; }
    else {
      fog.near = lerp(90, 12, tauK);
      fog.far = lerp(320, 60, tauK);
    }

    // --- lights ---
    this.sun.position.copy(sunDir).multiplyScalar(90);
    const sunStrength = (isMoon ? 3.6 : 3.0 * (1 - tauK * 0.85)) * lightScale;
    this.sun.intensity = sunStrength * day;
    this.sun.color.set(pal.sunDay).lerp(new Color(pal.sunLow), low * 0.9);
    this.sun.castShadow = !this.noShadows && this.sun.intensity > 0.05;
    const dusk = 1 - day;
    this.hemi.intensity = isMoon
      ? 0.2 + 0.4 * day * (m.lit ? 1 : 0) // earthshine keeps the terrain readable through the lunar night // only a whisper of earthshine at lunar night
      : lerp(0.05, 0.75, day) * (1 - tauK * 0.4) + tauK * 0.35 * day;
    this.hemi.color.set(pal.hemiSky).lerp(hor, isMoon ? 0 : 0.5);
    if (look && !isMoon) this.hemi.intensity += look.haze * 0.9 * day * lightScale; // thick air glows from every side
    if (isMoon && look) {
      this.hemi.color.set(pal.rim).lerp(new Color(0x5a6276), 0.6);
      this.hemi.groundColor.set(0x2a2c33);
      this.hemi.intensity = m.lit ? (0.35 + 0.35 * day) * lightScale : 1.2;
    } else if (isMoon) {
      // Earthshine: a cool fill so the real terrain still reads in shadow and through the two-week night.
      this.hemi.color.set(m.lit ? 0x5a6276 : 0x6f86b8);
      this.hemi.groundColor.set(m.lit ? 0x2a2c33 : 0x2a3552);
      this.hemi.intensity = m.lit ? 0.35 + 0.35 * day : 1.9;
    }
    if (look?.lava > 0) { // molten ground lights the base from below, day or night
      this.hemi.groundColor.set(pal.hemiGround);
      this.hemi.intensity += look.lava * 1.6;
    }
    this.rim.position.copy(sunDir).multiplyScalar(-1).setY(0.35).normalize().multiplyScalar(60);
    this.rim.intensity = isMoon ? 0.3 : 0.25 + 0.25 * dusk;
    // habitat lights come on as the sun goes down
    const lampOn = clamp(dusk * 1.2 + tauK * 0.5, 0, 1);
    this.lamp.intensity = 120 * lampOn;
    this.mats.window.emissiveIntensity = 0.15 + 2.2 * lampOn;
    this.renderer.toneMappingExposure = isMoon ? 1.0 : lerp(1.05, 0.9, tauK);

    // --- module states ---
    const blink = m.reducedMotion ? 1 : Math.sin(t * 7) > 0 ? 1.3 : 0.05;
    this.mats.blink.emissiveIntensity = blink;
    this.mats.glow.emissiveIntensity = m.fissionOn ? 1.6 + 0.6 * Math.sin(t * 2.2) : 0;
    this.mats.panel.color.set(0x18285c).lerp(new Color(pal.regolith), this.vis.dust * 0.85);
    this.mats.panel.roughness = 0.25 + this.vis.dust * 0.6;
    this.mats.panel.metalness = 0.6 - this.vis.dust * 0.5;
    for (const entry of this.moduleMeshes.values()) {
      const rl = entry.mesh.userData.relayLight;
      if (rl) {
        rl.material = m.blackout ? this.mats.blink : this.mats.led;
        if (m.blackout) rl.scale.setScalar(Math.sin(t * 9) > 0 ? 1.8 : 1);
        else rl.scale.setScalar(1);
      }
    }
    // SEP strobe on the habitat mast
    const strobe = this.vis.sep > 0.05 && Math.sin(t * 5) > 0.2 ? 4 : 0;
    this.mats.strobe.emissiveIntensity = strobe * this.vis.sep;
    this.beacon.intensity = strobe * 90 * this.vis.sep;
    this.sparkMat.opacity = this.vis.sep * (0.45 + 0.25 * Math.sin(t * 3));
    this.sparks.rotation.y = t * 0.05;

    // --- dust storm particles ---
    this.pool?.mat.update(t);
    const dustAmount = isMoon || (look && !look.particles.dust) ? 0 : clamp(this.vis.storm * 0.8 + smoothstep(1.2, 4, this.vis.tau) * 0.6, 0, 1);
    this.dustMat.opacity = dustAmount * 0.55;
    this.dustMat.color.copy(hor).lerp(new Color(pal.stormHorizon), 0.3).multiplyScalar(1.2);
    if (dustAmount > 0.01) {
      const pos = this.dust.geometry.attributes.position;
      const target = this.controls.target;
      const wind = 18 + 26 * dustAmount;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) - wind * dt;
        let y = pos.getY(i) + Math.sin(t * 1.3 + i) * dt * 2.5;
        let z = pos.getZ(i) + Math.cos(t * 0.7 + i * 0.3) * dt * 3;
        if (x < target.x - 60) x += 120;
        if (y < 0.3) y = 20;
        if (y > 24) y = 0.5;
        if (z < target.z - 60) z += 120;
        if (z > target.z + 60) z -= 120;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    // --- EVA astronaut walking between the airlock and a rock ---
    if (m.crewOutside) {
      this.astronaut.visible = true;
      const k = (t * 0.045) % 1;
      const leg = k < 0.5 ? k * 2 : (1 - k) * 2; // 0 at the airlock, 1 at the rock
      const ax = lerp(-2.2, -14, leg);
      const az = lerp(7, 17, leg);
      const walking = Math.abs(((k * 2) % 1) - 0.5) > 0.06;
      this.astronaut.position.set(ax, this._heightAt(ax, az) + Math.abs(Math.sin(t * 6)) * 0.05 * (walking ? 1 : 0), az);
      this.astronaut.rotation.y = k < 0.5 ? Math.atan2(-11.8, -10) + Math.PI / 2 : Math.atan2(11.8, 10) + Math.PI / 2;
      const swing = walking ? Math.sin(t * 6) * 0.5 : 0;
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.arms[0].rotation.x = -swing * 0.7;
      this.arms[1].rotation.x = swing * 0.7;
    } else this.astronaut.visible = false;

    // --- camera ---
    if (this.camAnim) {
      const k = clamp((t - this.camAnim.start) / 0.9, 0, 1);
      this.camera.position.lerpVectors(this.camAnim.from, this.camAnim.to, easeInOut(k));
      if (k >= 1) this.camAnim = null;
    }
    if (!this.controls.autoRotate && !m.pendingCard && !m.reducedMotion && t > this.autoRotateResume) this.controls.autoRotate = true;
    if (m.pendingCard || m.reducedMotion) this.controls.autoRotate = false;
    this.controls.update();
    this._updateHud();
  }

  _render() {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }
}
