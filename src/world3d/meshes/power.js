// Solar arrays (dust overlay per panel), battery bank and fission reactor with keep-out ring.
import * as THREE from 'three';
import { M, mat, box, cyl, sphere, signMesh } from './kit.js';
import { FISSION_KEEP_OUT } from '../layout.js';

function cellTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = '#9aa7c7';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 256; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 160); ctx.stroke(); }
  for (let y = 0; y <= 160; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSolar(station, { body, lat = 0 }) {
  const g = new THREE.Group();
  const cellMat = new THREE.MeshStandardMaterial({ color: '#2a4f9e', map: cellTexture(), roughness: 0.22, metalness: 0.6, envMapIntensity: 1.5 });
  const panels = station.panels.map((p) => {
    const pg = new THREE.Group();
    pg.position.set(p.x - station.x, 0, p.z - station.z);
    const moon = body === 'moon';
    pg.add(cyl(0.08, 0.1, moon ? 3.4 : 1.3, M.grey(), { y: moon ? 1.7 : 0.65 }, 8));
    const pivot = new THREE.Group();
    pivot.position.y = moon ? 2.6 : 1.3;
    pg.add(pivot);
    const tilt = new THREE.Group();
    // Face the Sun: towards the equator on Mars, vertical and sun-tracking on the polar Moon.
    tilt.rotation.x = moon ? -Math.PI / 2 + 0.05 : (lat >= 0 ? 0.45 : -0.45);
    pivot.add(tilt);
    tilt.add(box(4.2, 0.08, 2.6, M.metal(), {}));
    tilt.add(box(4.0, 0.02, 2.4, cellMat, { y: 0.05 }));
    const dustMat = new THREE.MeshStandardMaterial({ color: body === 'moon' ? '#9d9a95' : '#b9845a', roughness: 1, transparent: true, opacity: 0, depthWrite: false });
    const dust = box(4.0, 0.01, 2.4, dustMat, { y: 0.07, shadow: false });
    tilt.add(dust);
    g.add(pg);
    return { group: pg, pivot, dustMat, cleanT: 1 };
  });

  // dust 0..0.9 from env, per-panel wipe animates the overlay clear then slowly back.
  function update({ dust = 0, sunAzimuth = 0, broken = false, dt = 0 }) {
    panels.forEach((p, i) => {
      p.cleanT = Math.min(1, p.cleanT + dt / 90);
      p.dustMat.opacity = Math.min(0.92, dust * 1.1) * p.cleanT;
      if (body === 'moon') p.pivot.rotation.y = sunAzimuth;
      p.group.rotation.z = broken && i === 0 ? 0.12 : 0;
    });
  }

  function wipe(index, amount = 1) {
    const p = panels[index] ?? panels[0];
    if (p) p.cleanT = Math.max(0, 1 - amount);
  }

  return { group: g, update, wipe, panels };
}

export function buildBattery(station) {
  const g = new THREE.Group();
  const leds = [];
  station.units.forEach((u) => {
    const ug = new THREE.Group();
    ug.position.set(u.x - station.x, 0, u.z - station.z);
    ug.rotation.y = station.angle;
    ug.add(box(1.3, 1.1, 0.9, M.panel(), { y: 0.55 }));
    ug.add(box(1.32, 0.12, 0.92, M.dark(), { y: 1.05 }));
    const led = box(0.8, 0.06, 0.02, M.ledGreen(), { y: 0.8, z: 0.46, shadow: false });
    ug.add(led);
    leds.push(led);
    g.add(ug);
  });
  function update({ disabled = false, time = 0 }) {
    leds.forEach((l, i) => { l.scale.x = disabled ? 0.1 : 0.4 + 0.6 * ((Math.sin(time * 0.8 + i) + 1) / 2); });
  }
  return { group: g, update };
}

export function buildFission(station) {
  const g = new THREE.Group();
  const glowMat = mat('fissionGlow', { color: '#ffb36b', emissive: '#ff8a2a', emissiveIntensity: 1.2, roughness: 0.4 });
  station.units.forEach((u) => {
    const ug = new THREE.Group();
    ug.position.set(u.x - station.x, 0, u.z - station.z);
    ug.add(cyl(0.9, 1.1, 2.4, M.panel(), { y: 1.2 }, 16));
    ug.add(cyl(0.55, 0.55, 0.6, M.dark(), { y: 2.7 }, 16));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      ug.add(box(0.06, 2.6, 1.8, M.metal(), { x: Math.sin(a) * 1.9, y: 2, z: Math.cos(a) * 1.9, ry: a }));
      ug.add(box(0.08, 2.4, 0.08, glowMat, { x: Math.sin(a) * 2.8, y: 2, z: Math.cos(a) * 2.8, shadow: false }));
    }
    g.add(ug);
  });
  // Keep-out ring of marker posts and a radiation sign at the work spot.
  const posts = 18;
  for (let i = 0; i < posts; i += 1) {
    const a = (i / posts) * Math.PI * 2;
    g.add(cyl(0.05, 0.05, 1, M.grey(), { x: Math.sin(a) * FISSION_KEEP_OUT, y: 0.5, z: Math.cos(a) * FISSION_KEEP_OUT }, 6));
    g.add(sphere(0.09, mat('postTop', { color: '#ffd23f', emissive: '#6a4a00', emissiveIntensity: 0.5 }), { x: Math.sin(a) * FISSION_KEEP_OUT, y: 1.05, z: Math.cos(a) * FISSION_KEEP_OUT, shadow: false }, 8, 6));
  }
  const toHab = Math.atan2(-station.x, -station.z);
  const sign = signMesh('☢ KEEP OUT 7 m', { w: 1.6, h: 0.45, bg: '#ffd23f', fg: '#111' });
  sign.position.set(Math.sin(toHab) * (FISSION_KEEP_OUT - 0.1), 1.3, Math.cos(toHab) * (FISSION_KEEP_OUT - 0.1));
  sign.rotation.y = toHab;
  g.add(sign);
  g.add(cyl(0.04, 0.04, 1.3, M.grey(), { x: sign.position.x, y: 0.65, z: sign.position.z }, 6));
  function update({ disabled = false, time = 0 }) {
    glowMat.emissiveIntensity = disabled ? 0.1 : 1 + 0.25 * Math.sin(time * 2);
  }
  return { group: g, update };
}
