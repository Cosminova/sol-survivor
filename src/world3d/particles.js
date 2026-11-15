// Ambient and feedback particles: drifting dust motes, fading footprints and spark/dust bursts. Worlds with a
// look (everything but the Moon and Mars) also get methane drizzle and distant plumes when their hazards say so.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { hexToRgb } from '../render/color.js';

const RAIN_BOX = { half: 26, height: 22 };
const RAIN_FALL_MS = 1.6; // Titan's fat raindrops drift down about as fast as snow
const PLUME_PARTICLES = 260;
const PLUME_HEIGHT_M = 420;
const PLUME_CYCLE_S = 14;

// Slow drizzle in a box that follows the camera.
function createRain({ count, color, dot }) {
  const pos = new Float32Array(count * 3);
  const rng = makeRng(911);
  for (let i = 0; i < count; i += 1) pos.set([rng.range(-RAIN_BOX.half, RAIN_BOX.half), rng.range(0, RAIN_BOX.height), rng.range(-RAIN_BOX.half, RAIN_BOX.half)], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: dot, color, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  function update(dt, camera) {
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (let i = 0; i < count; i += 1) {
      let x = pos[i * 3];
      let y = pos[i * 3 + 1] - RAIN_FALL_MS * dt;
      let z = pos[i * 3 + 2];
      if (y < 0) y += RAIN_BOX.height;
      if (x - cx > RAIN_BOX.half) x -= RAIN_BOX.half * 2; else if (x - cx < -RAIN_BOX.half) x += RAIN_BOX.half * 2;
      if (z - cz > RAIN_BOX.half) z -= RAIN_BOX.half * 2; else if (z - cz < -RAIN_BOX.half) z += RAIN_BOX.half * 2;
      pos.set([x, y, z], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { points, update, dispose() { geo.dispose(); mat.dispose(); } };
}

// A fountain on the horizon: an ice geyser (cryovolcanism) or a sulfur plume above a volcano.
function createPlume({ at, color, dot, still }) {
  const pos = new Float32Array(PLUME_PARTICLES * 3);
  const rng = makeRng(Math.round(at.x * 7 + at.z * 13) >>> 0);
  const seeds = Array.from({ length: PLUME_PARTICLES }, () => ({ phase: rng.next(), angle: rng.range(0, Math.PI * 2), spread: rng.next() ** 0.6 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: dot, color, size: 26, transparent: true, opacity: 0.32, depthWrite: false, fog: false });
  const points = new THREE.Points(geo, mat);
  points.position.set(at.x, at.y, at.z);
  points.frustumCulled = false;
  function place(time) {
    for (let i = 0; i < PLUME_PARTICLES; i += 1) {
      const sd = seeds[i];
      const k = (sd.phase + time / PLUME_CYCLE_S) % 1; // 0 at the vent, 1 falling back at the edge of the umbrella
      const out = sd.spread * PLUME_HEIGHT_M * 0.55 * k;
      pos.set([Math.cos(sd.angle) * out, PLUME_HEIGHT_M * 4 * k * (1 - k), Math.sin(sd.angle) * out], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
  }
  place(0);
  return { points, update: (time) => { if (!still) place(time); }, dispose() { geo.dispose(); mat.dispose(); } };
}

function plumeSites(look, surface) {
  if (!look?.particles.plumes || !surface) return [];
  if (surface.cones.length) return surface.cones.slice(0, 1).map((c) => ({ x: c.x, z: c.z, y: surface.heightAt(c.x, c.z) }));
  const rng = makeRng((look.seed ^ 0x9106) >>> 0);
  return Array.from({ length: 2 }, () => {
    const a = rng.range(-Math.PI, Math.PI);
    const d = rng.range(1400, 2400);
    return { x: Math.sin(a) * d, z: Math.cos(a) * d, y: surface.heightAt(Math.sin(a) * d, Math.cos(a) * d) };
  });
}

function softDot() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// look / surface: world look and its ground for worlds other than the Moon and Mars (null keeps their particles as they were).
export function createParticles({ body, high, reducedMotion, look = null, surface = null }) {
  const group = new THREE.Group();
  const dot = softDot();
  const dusty = look ? look.particles.dust : body === 'mars';
  const airless = look ? look.airless : body === 'moon';
  const moteCount = dusty ? (high ? (reducedMotion ? 120 : 420) : 0) : 0;
  const rain = look?.particles.methaneRain ? createRain({ count: reducedMotion ? 90 : high ? 420 : 160, color: '#e9c48a', dot }) : null;
  if (rain) group.add(rain.points);
  const plumes = plumeSites(look, surface).map((at) => createPlume({ at, color: look.particles.plumeColor, dot, still: reducedMotion }));
  plumes.forEach((p) => group.add(p.points));

  // Dust motes live in a box around the camera and wrap as it moves.
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i += 1) motePos.set([Math.random() * 60 - 30, Math.random() * 12, Math.random() * 60 - 30], i * 3);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ map: dot, color: look ? look.particles.dustColor : '#e8b98d', size: 0.12, transparent: true, opacity: 0.55, depthWrite: false });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.visible = moteCount > 0;
  group.add(motes);

  // Footprints: multiply-blended ovals that brighten back to white (no effect) as they fade.
  const prints = 90;
  const printMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const printGeo = new THREE.CircleGeometry(0.11, 10);
  printGeo.scale(1, 1.7, 1);
  printGeo.rotateX(-Math.PI / 2);
  const footprints = new THREE.InstancedMesh(printGeo, printMat, prints);
  footprints.frustumCulled = false;
  const printAge = new Float32Array(prints).fill(999);
  const white = new THREE.Color(1, 1, 1);
  const tmpC = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < prints; i += 1) {
    footprints.setMatrixAt(i, m4.makeScale(0, 0, 0));
    footprints.setColorAt(i, white);
  }
  group.add(footprints);
  let printIdx = 0;
  const printDark = new THREE.Color(body === 'moon' ? 0.55 : 0.62, body === 'moon' ? 0.55 : 0.5, body === 'moon' ? 0.55 : 0.45);
  if (look) printDark.setRGB(...hexToRgb(look.groundColors.light).map((v) => 0.45 + v * 0.2));

  function footprint(x, y, z, heading, side) {
    const ox = Math.cos(heading) * 0.13 * side;
    const oz = -Math.sin(heading) * 0.13 * side;
    q.setFromAxisAngle(up, heading);
    m4.compose(new THREE.Vector3(x + ox, y + 0.02, z + oz), q, new THREE.Vector3(1, 1, 1));
    footprints.setMatrixAt(printIdx, m4);
    footprints.setColorAt(printIdx, printDark);
    printAge[printIdx] = 0;
    printIdx = (printIdx + 1) % prints;
    footprints.instanceMatrix.needsUpdate = true;
    footprints.instanceColor.needsUpdate = true;
  }

  // Bursts: pooled points with velocity and life.
  const maxBurst = high ? 500 : 160;
  const bPos = new Float32Array(maxBurst * 3);
  const bCol = new Float32Array(maxBurst * 3);
  const bVel = new Float32Array(maxBurst * 3);
  const bLife = new Float32Array(maxBurst);
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  const bMat = new THREE.PointsMaterial({ map: dot, size: 0.25, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const bursts = new THREE.Points(bGeo, bMat);
  bursts.frustumCulled = false;
  group.add(bursts);
  const dustMat = new THREE.PointsMaterial({ map: dot, size: 0.9, color: look ? look.groundColors.dust : body === 'moon' ? '#b9b5ad' : '#c58c5c', transparent: true, opacity: 0.6, depthWrite: false });
  const dPos = new Float32Array(maxBurst * 3);
  const dVel = new Float32Array(maxBurst * 3);
  const dLife = new Float32Array(maxBurst);
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dGeo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);
  for (let i = 0; i < maxBurst; i += 1) { bPos[i * 3 + 1] = -999; dPos[i * 3 + 1] = -999; }
  let bIdx = 0;
  let dIdx = 0;
  const g = look ? look.gravityMs2 : body === 'moon' ? 1.62 : 3.71;

  function burst(at, { count = 30, color = '#ffd36b', speed = 4, up: upBias = 2 } = {}) {
    const n = Math.min(count, reducedMotion ? Math.ceil(count / 3) : count);
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k += 1) {
      const i = bIdx;
      bIdx = (bIdx + 1) % maxBurst;
      bPos.set([at.x, at.y, at.z], i * 3);
      bVel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.5 + upBias, (Math.random() - 0.5) * speed], i * 3);
      bCol.set([c.r, c.g, c.b], i * 3);
      bLife[i] = 0.6 + Math.random() * 0.6;
    }
  }

  function dustCloud(at, { count = 40, speed = 3, radius = 1 } = {}) {
    const n = Math.min(count, reducedMotion ? Math.ceil(count / 3) : count);
    for (let k = 0; k < n; k += 1) {
      const i = dIdx;
      dIdx = (dIdx + 1) % maxBurst;
      const a = Math.random() * Math.PI * 2;
      dPos.set([at.x + Math.cos(a) * radius, at.y + 0.1, at.z + Math.sin(a) * radius], i * 3);
      dVel.set([Math.cos(a) * speed * (0.5 + Math.random()), Math.random() * speed * 0.3, Math.sin(a) * speed * (0.5 + Math.random())], i * 3);
      dLife[i] = 1.5 + Math.random() * 1.5;
    }
  }

  let clock = 0;
  function update(dt, { camera, wind = { x: 0.6, z: 0.2 } }) {
    clock += dt;
    rain?.update(dt, camera);
    plumes.forEach((p) => p.update(clock));
    if (motes.visible) {
      const cx = camera.position.x;
      const cz = camera.position.z;
      for (let i = 0; i < moteCount; i += 1) {
        let x = motePos[i * 3] + wind.x * dt * 2;
        let y = motePos[i * 3 + 1] + Math.sin((i + performance.now() * 0.0005) * 1.3) * dt * 0.2;
        let z = motePos[i * 3 + 2] + wind.z * dt * 2;
        if (x - cx > 30) x -= 60; else if (x - cx < -30) x += 60;
        if (z - cz > 30) z -= 60; else if (z - cz < -30) z += 60;
        if (y > 12) y = 0; else if (y < 0) y = 12;
        motePos.set([x, y, z], i * 3);
      }
      moteGeo.attributes.position.needsUpdate = true;
    }
    for (let i = 0; i < prints; i += 1) {
      if (printAge[i] > 40) continue;
      printAge[i] += dt;
      tmpC.copy(printDark).lerp(white, Math.min(1, printAge[i] / 40));
      footprints.setColorAt(i, tmpC);
    }
    footprints.instanceColor.needsUpdate = true;
    for (let i = 0; i < maxBurst; i += 1) {
      if (bLife[i] > 0) {
        bLife[i] -= dt;
        bVel[i * 3 + 1] -= g * dt;
        bPos[i * 3] += bVel[i * 3] * dt;
        bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt;
        bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
        if (bLife[i] <= 0) bPos[i * 3 + 1] = -999;
      }
      if (dLife[i] > 0) {
        dLife[i] -= dt;
        const drag = airless ? 1 : 0.97; // no air on the Moon: dust flies in clean arcs
        dVel[i * 3] *= drag; dVel[i * 3 + 2] *= drag;
        dVel[i * 3 + 1] -= (airless ? g : g * 0.15) * dt;
        dPos[i * 3] += dVel[i * 3] * dt;
        dPos[i * 3 + 1] = Math.max(0, dPos[i * 3 + 1] + dVel[i * 3 + 1] * dt);
        dPos[i * 3 + 2] += dVel[i * 3 + 2] * dt;
        if (dLife[i] <= 0) dPos[i * 3 + 1] = -999;
      }
    }
    bGeo.attributes.position.needsUpdate = true;
    bGeo.attributes.color.needsUpdate = true;
    dGeo.attributes.position.needsUpdate = true;
  }

  function setMoteDensity(k) {
    moteMat.opacity = Math.min(0.9, 0.35 + k * 0.5);
    moteMat.size = 0.1 + k * 0.12;
  }

  return {
    group, footprint, burst, dustCloud, update, setMoteDensity,
    dispose() {
      [moteGeo, printGeo, bGeo, dGeo].forEach((x) => x.dispose());
      [moteMat, printMat, bMat, dustMat].forEach((x) => x.dispose());
      footprints.dispose();
      rain?.dispose();
      plumes.forEach((p) => p.dispose());
      dot.dispose();
    },
  };
}
