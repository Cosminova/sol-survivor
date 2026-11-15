// Sky dome, sun disk, stars and Earth. Mars: butterscotch sky with a blue glow around a low Sun.
// Moon: black sky, stars and a phase-correct Earth lit by the same Sun direction.
import * as THREE from 'three';
import { makeRng } from './rng.js';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uSunDir, uZenith, uHorizon, uGround, uHalo, uSunColor, uFlash;
  uniform float uHaloStrength, uSunCos, uSunGlow, uDust;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float s = max(dot(d, uSunDir), 0.0);
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
    col = mix(col, uGround, smoothstep(0.0, -0.08, h));
    // Mars dust scatters blue light forward, so the sky right around the Sun turns blue.
    col = mix(col, uHalo, clamp(pow(s, 18.0) * uHaloStrength, 0.0, 1.0));
    col += uHalo * pow(s, 4.0) * uHaloStrength * 0.12;
    col += uSunColor * (pow(s, 260.0) * 0.8 + pow(s, 2400.0) * 2.0) * uSunGlow;
    float disk = smoothstep(uSunCos - 0.000015, uSunCos + 0.000015, dot(d, uSunDir));
    col += uSunColor * disk * 18.0 * (1.0 - uDust * 0.85);
    col += uFlash;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vN;
  varying vec3 vP;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += w * noise(p); p *= 2.1; w *= 0.5; } return a; }
  void main() {
    vec3 n = normalize(vN);
    float land = smoothstep(0.52, 0.56, fbm(vP * 2.2 + 3.0));
    float ice = smoothstep(0.78, 0.9, abs(vP.y));
    vec3 col = mix(vec3(0.02, 0.09, 0.32), mix(vec3(0.12, 0.3, 0.08), vec3(0.55, 0.45, 0.25), fbm(vP * 6.0)), land);
    col = mix(col, vec3(0.95), ice);
    float cloud = smoothstep(0.55, 0.75, fbm(vP * 3.5 + 11.0));
    col = mix(col, vec3(1.0), cloud * 0.85);
    float lit = smoothstep(-0.05, 0.25, dot(n, uSunDir));
    float rim = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 3.0);
    col = col * lit * 1.6 + vec3(0.25, 0.5, 1.0) * rim * (0.2 + 0.8 * lit);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const EARTH_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  void main() {
    vP = normalize(position);
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Stars and Earth sit beyond the farthest terrain (30 km) so mountains correctly hide them.
const SKY_R = 38000;

function starField(count, seed) {
  const rng = makeRng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const u = rng.range(0.015, 1); // upper hemisphere only: stars never show below the horizon line
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * r * SKY_R, u * SKY_R, Math.sin(a) * r * SKY_R], i * 3);
    const warm = rng.next();
    const b = 0.4 + rng.next() ** 3 * 1.6;
    col.set([b * (0.85 + warm * 0.25), b * 0.92, b * (1.1 - warm * 0.3)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

export function createSky({ body, high }) {
  const group = new THREE.Group();
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uHalo: { value: new THREE.Color('#7fa3d6') },
    uSunColor: { value: new THREE.Color('#fff1dc') },
    uFlash: { value: new THREE.Color(0, 0, 0) },
    uHaloStrength: { value: 0 },
    uSunCos: { value: Math.cos((body === 'moon' ? 0.4 : 0.32) * (Math.PI / 180)) },
    uSunGlow: { value: 1 },
    uDust: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1000, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  const stars = starField(high ? 1800 : 700, 42);
  group.add(stars);

  let earth = null;
  if (body === 'moon') {
    earth = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_R * 0.0175, 48, 32), // about 2 degrees across, as seen from the Moon
      new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, uniforms: { uSunDir: uniforms.uSunDir }, fog: false }),
    );
    earth.rotation.z = 0.41;
    group.add(earth);
  }

  function setEarthDirection(dir) {
    if (earth) earth.position.set(dir.x * SKY_R, dir.y * SKY_R, dir.z * SKY_R);
  }

  function apply(look, sunDir, flash = 0) {
    uniforms.uSunDir.value.set(sunDir.x, sunDir.y, sunDir.z).normalize();
    uniforms.uZenith.value.copy(look.zenith);
    uniforms.uHorizon.value.copy(look.horizon);
    uniforms.uGround.value.copy(look.ground);
    uniforms.uHalo.value.copy(look.halo);
    uniforms.uHaloStrength.value = look.haloStrength;
    uniforms.uSunGlow.value = look.sunGlow;
    uniforms.uDust.value = look.dust;
    uniforms.uFlash.value.setRGB(flash * 0.9, flash * 0.35, flash * 0.6);
    stars.material.opacity = look.stars;
    stars.visible = look.stars > 0.01;
  }

  // Temporarily lends the dome to a bake scene for the reflection environment map.
  function bakeInto(stage) {
    const bake = new THREE.Scene();
    group.remove(dome);
    bake.add(dome);
    if (earth) bake.add(earth.clone());
    stage.bakeEnvironment(bake);
    bake.remove(dome);
    group.add(dome);
  }

  return { group, apply, setEarthDirection, bakeInto, follow: (p) => group.position.copy(p) };
}

const C = (hex) => new THREE.Color(hex);
const PAL = {
  mars: {
    dayZenith: C('#8e5d3f'), dayHorizon: C('#ddb08a'), dustZenith: C('#7d4c2e'), dustHorizon: C('#b97c4c'),
    duskZenith: C('#2e2430'), duskHorizon: C('#c08560'), nightZenith: C('#04050b'), nightHorizon: C('#110c0c'),
    ground: C('#5e3826'), halo: C('#86a9dc'), storm: C('#9a6438'),
  },
  // Below the horizon the dome is painted like distant regolith, so any gap past the terrain edge reads as ground, not space.
  moon: { black: C('#000000'), ground: C('#6d6a66'), groundNight: C('#191c24') },
};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Pure-ish palette for the current conditions (returns fresh Colors).
export function skyLook({ body, sunElev, tau = 0.5, lit = true, stormActive = false }) {
  if (body === 'moon') {
    const up = lit && sunElev > -1 ? 1 : 0;
    // A grazing polar Sun barely lights flat ground, so sunlit slopes bouncing light back in do the filling;
    // near noon the Sun does the work and both are eased down so the regolith does not burn out to white.
    const high = sstep(8, 55, sunElev);
    return {
      zenith: PAL.moon.black.clone(), horizon: PAL.moon.black.clone(), ground: (up ? PAL.moon.ground : PAL.moon.groundNight).clone(), halo: C('#000'),
      haloStrength: 0, sunGlow: up ? 0.6 : 0, dust: 0, stars: up ? 0.5 : 1,
      sunIntensity: up ? 4.4 - 1.9 * high : 0, sunColor: C('#ffffff'),
      // Night keeps the Sun off: blue-white earthshine (about 40x a full Moon on Earth) plus the lamps light the base.
      hemiSky: up ? C('#9a9da6') : C('#6f83ad'), hemiGround: C('#6a6762'),
      hemiIntensity: up ? 2.1 - 1.55 * high : 0.4, fogColor: C('#000000'), fogDensity: 0,
      exposure: up ? 1.35 - 0.2 * high : 1.3, fill: up ? 0.8 - 0.65 * high : 0.7, fillColor: C('#9fb8ff'),
    };
  }
  const day = sstep(-8, 5, sunElev); // dusty Mars air keeps the sky bright through a long twilight
  const low = 1 - sstep(4, 30, sunElev);
  const dustK = Math.min(1, Math.max(0, (tau - 0.5) / 2.5)) + (stormActive ? 0.7 : 0);
  const d = Math.min(1, dustK);
  const zenithDay = PAL.mars.dayZenith.clone().lerp(PAL.mars.dustZenith, d);
  const horizonDay = PAL.mars.dayHorizon.clone().lerp(PAL.mars.dustHorizon, d);
  const zenithLow = zenithDay.clone().lerp(PAL.mars.duskZenith, low * 0.8);
  const horizonLow = horizonDay.clone().lerp(PAL.mars.duskHorizon, low * 0.7);
  const zenith = PAL.mars.nightZenith.clone().lerp(zenithLow, day);
  const horizon = PAL.mars.nightHorizon.clone().lerp(horizonLow, day);
  const transmission = Math.max(0.12, Math.exp(-0.35 * Math.max(0, tau - 0.5)) * (stormActive ? 0.35 : 1));
  const fogColor = horizon.clone().lerp(PAL.mars.storm, stormActive ? 0.6 * day : 0).multiplyScalar(0.92);
  return {
    zenith, horizon, ground: PAL.mars.ground.clone().multiplyScalar(0.3 + 0.7 * day),
    halo: PAL.mars.halo.clone(), haloStrength: (0.35 + low * 1.4) * day * (1 - d * 0.7),
    sunGlow: day * (1 - d * 0.6), dust: d, stars: (1 - day) * 0.9,
    sunIntensity: 3.2 * transmission * sstep(-3, 5, sunElev), sunColor: C('#fff0da').lerp(C('#ffb27a'), low * 0.6),
    hemiSky: zenith.clone().lerp(horizon, 0.5).multiplyScalar(1.6), hemiGround: C('#5a3220'),
    hemiIntensity: 0.4 + day * (0.7 + d * 0.5), fogColor,
    // Exp2 haze tuned so tau 0.5 still shows crater rims ~20 km away; a storm cuts it to ~1 km.
    fogDensity: (0.00004 + 0.000025 * tau) * (stormActive ? 22 : 1) + (1 - day) * 0.00002,
    exposure: 1 + (1 - day) * 0.3, fill: 0.15 + (1 - day) * 0.4, fillColor: C('#ffd9b4').lerp(C('#aebbe0'), 1 - day),
  };
}
