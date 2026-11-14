// Hazard visuals: wandering dust devils, an approaching dust-storm wall and micrometeoroid streaks.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { WORLD_LIMIT } from './layout.js';

const WALL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const WALL_FRAG = /* glsl */ `
  uniform float uTime, uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += w * noise(p); p *= 2.0; w *= 0.5; } return a; }
  void main() {
    vec2 p = vec2(vUv.x * 14.0 + uTime * 0.05, vUv.y * 3.0 - uTime * 0.12);
    float n = fbm(p + fbm(p * 1.7 + uTime * 0.03));
    float top = smoothstep(1.0, 0.35 + n * 0.3, vUv.y);
    float a = top * (0.55 + 0.45 * n) * uOpacity;
    gl_FragColor = vec4(uColor * (0.7 + 0.5 * n), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function devilColumn(dot, high) {
  const n = high ? 420 : 160;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i += 1) seed[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: dot, size: 0.8, color: '#c99569', transparent: true, opacity: 0.5, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  function animate(t) {
    for (let i = 0; i < n; i += 1) {
      const h = ((seed[i] + t * 0.15) % 1);
      const y = h * 26;
      const r = 0.6 + y * 0.12 + Math.sin(seed[i] * 40) * 0.4;
      const a = seed[i] * 60 + t * (4 - h * 2);
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { pts, animate, geo, mat };
}

export function createHazardFx({ body, high, heightAt }) {
  const group = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const dot = new THREE.CanvasTexture(c);

  const devils = new Map();

  function spawnDevil(hazard, near) {
    const rng = makeRng(hazard.seed ?? 1);
    const a = rng.range(-Math.PI, Math.PI);
    const start = { x: near.x + Math.sin(a) * 45, z: near.z + Math.cos(a) * 45 };
    const col = devilColumn(dot, high);
    col.pts.position.set(start.x, heightAt(start.x, start.z), start.z);
    group.add(col.pts);
    devils.set(hazard.id, { col, x: start.x, z: start.z, heading: a + Math.PI + rng.range(-0.5, 0.5), rng, t: 0, fade: 0, ending: false });
  }

  function endDevil(id) {
    const d = devils.get(id);
    if (d) d.ending = true;
  }

  // Storm wall: a tall curved band on the horizon that rolls in towards the outpost.
  const wallMat = new THREE.ShaderMaterial({
    vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#a8683a') } },
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true, -0.9, 1.8), wallMat);
  wall.visible = false;
  group.add(wall);
  let wallState = null;

  function startStormWall(leadSeconds, dir = Math.random() * Math.PI * 2) {
    wallState = { t: 0, lead: Math.max(5, leadSeconds), dir };
    wall.visible = true;
    wall.rotation.y = dir;
  }

  // Meteor streak: a bright line that falls from the sky to the impact point.
  const streakMat = new THREE.LineBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0 });
  const streakGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const streak = new THREE.Line(streakGeo, streakMat);
  streak.frustumCulled = false;
  group.add(streak);
  let meteor = null;

  function meteorStrike(target, onImpact) {
    meteor = { target: target.clone(), from: target.clone().add(new THREE.Vector3(40, 90, -30)), t: 0, onImpact };
  }

  // Returns the push vector a dust devil applies at (x, z), for gameplay.
  function devilPushAt(x, z) {
    let px = 0;
    let pz = 0;
    for (const d of devils.values()) {
      const dx = x - d.x;
      const dz = z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6 && dist > 0.01) {
        const k = (1 - dist / 6) * 5 * d.fade;
        px += (-dz / dist + dx / dist * 0.4) * k;
        pz += (dx / dist + dz / dist * 0.4) * k;
      }
    }
    return { x: px, z: pz };
  }

  function update(dt, { time, focus }) {
    for (const [id, d] of devils) {
      d.t += dt;
      d.fade = d.ending ? Math.max(0, d.fade - dt * 0.5) : Math.min(1, d.fade + dt * 0.4);
      d.heading += d.rng.range(-0.6, 0.6) * dt;
      const toCentre = Math.atan2(focus.x - d.x, focus.z - d.z);
      d.heading += Math.sin(toCentre - d.heading) * dt * 0.15;
      d.x += Math.sin(d.heading) * 3.2 * dt;
      d.z += Math.cos(d.heading) * 3.2 * dt;
      const r = Math.hypot(d.x, d.z);
      if (r > WORLD_LIMIT + 20) d.heading += Math.PI * dt;
      d.col.pts.position.set(d.x, heightAt(d.x, d.z), d.z);
      d.col.mat.opacity = 0.5 * d.fade;
      d.col.animate(time);
      if (d.ending && d.fade <= 0) {
        group.remove(d.col.pts);
        d.col.geo.dispose();
        d.col.mat.dispose();
        devils.delete(id);
      }
    }
    if (wallState) {
      wallState.t += dt;
      wallMat.uniforms.uTime.value = time;
      const k = Math.min(1, wallState.t / wallState.lead);
      const radius = 420 - k * 380;
      wall.scale.set(radius, 90 + k * 40, radius);
      wall.position.set(focus.x, 40, focus.z);
      wallMat.uniforms.uOpacity.value = Math.min(1, wallState.t / 3) * (k < 1 ? 0.95 : Math.max(0, 1 - (wallState.t - wallState.lead) / 6));
      if (k >= 1 && wallState.t > wallState.lead + 6) { wall.visible = false; wallState = null; }
    }
    if (meteor) {
      meteor.t += dt / 0.7;
      const head = meteor.from.clone().lerp(meteor.target, Math.min(1, meteor.t));
      const tail = meteor.from.clone().lerp(meteor.target, Math.max(0, meteor.t - 0.25));
      streakGeo.setFromPoints([tail, head]);
      streakMat.opacity = 1;
      if (meteor.t >= 1) {
        streakMat.opacity = 0;
        const cb = meteor.onImpact;
        meteor = null;
        cb?.();
      }
    }
  }

  return {
    group, spawnDevil, endDevil, startStormWall, meteorStrike, devilPushAt, update,
    devilPositions: () => [...devils.values()].map((d) => ({ x: d.x, z: d.z })),
    stormArrived: () => Boolean(wallState && wallState.t >= wallState.lead),
    dispose() {
      for (const d of devils.values()) { d.col.geo.dispose(); d.col.mat.dispose(); }
      devils.clear();
      wall.geometry.dispose();
      wallMat.dispose();
      streakGeo.dispose();
      streakMat.dispose();
      dot.dispose();
    },
  };
}
