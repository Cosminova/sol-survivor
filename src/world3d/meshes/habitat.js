// Habitat with airlock, regolith berm ring and floodlights; plus the lander used in the intro.
import * as THREE from 'three';
import { M, mat, box, cyl, sphere, mesh, regolith, signMesh } from './kit.js';

export function buildHabitat({ body, high }) {
  const g = new THREE.Group();
  const legs = 6;
  for (let i = 0; i < legs; i += 1) {
    const a = (i / legs) * Math.PI * 2;
    g.add(cyl(0.12, 0.16, 0.5, M.grey(), { x: Math.sin(a) * 3.4, y: 0.25, z: Math.cos(a) * 3.4 }, 8));
  }
  g.add(cyl(4, 4, 2.8, M.white(), { y: 1.9 }, high ? 40 : 20));
  g.add(cyl(4.03, 4.03, 0.22, M.orange(), { y: 2.6 }, high ? 40 : 20));
  g.add(cyl(4.05, 4.05, 0.12, M.panel(), { y: 0.55 }, high ? 40 : 20));
  const dome = mesh(new THREE.SphereGeometry(4, high ? 40 : 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.white(), { y: 3.3 });
  dome.scale.y = 0.42;
  g.add(dome);
  g.add(cyl(0.06, 0.06, 2.2, M.grey(), { x: 1.2, y: 5.1, z: -1 }, 6));
  g.add(sphere(0.25, M.white(), { x: 1.2, y: 6.2, z: -1 }, 10, 8));
  // Windows glow warm at night.
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    g.add(box(0.9, 0.5, 0.08, M.window(), { x: Math.sin(a) * 4.02, y: 2.05, z: Math.cos(a) * 4.02, ry: a, shadow: false }));
  }
  // Airlock tunnel and door on the +z side.
  g.add(mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.2, 20), M.panel(), { y: 1.55, z: 4.7, rx: Math.PI / 2 }));
  g.add(mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), M.orange(), { y: 1.55, z: 5.82 }));
  const door = cyl(0.92, 0.92, 0.08, M.dark(), { y: 1.55, z: 5.8, rx: Math.PI / 2 }, 20);
  g.add(door);
  const doorLight = sphere(0.1, M.ledGreen(), { y: 2.75, z: 5.75, shadow: false }, 8, 6);
  g.add(doorLight);
  g.add(box(1.2, 0.12, 1.2, M.grey(), { y: 0.42, z: 6.3 }));
  for (let i = 0; i < 3; i += 1) g.add(box(1.0, 0.06, 0.25, M.grey(), { y: 0.5 + i * 0.3, z: 5.95 }));
  const sign = signMesh('AIRLOCK', { w: 1.2, h: 0.3, bg: '#ffffff', fg: '#c23a1a' });
  sign.position.set(0, 2.95, 5.6);
  g.add(sign);

  // Regolith berm: segments around the back of the habitat that grow with shielding.
  const berm = new THREE.Group();
  const segs = 16;
  const bermMat = regolith(body);
  const segGeo = new THREE.BoxGeometry(2.2, 1, 1.4);
  for (let i = 0; i < segs; i += 1) {
    const a = Math.PI * 0.28 + (i / (segs - 1)) * Math.PI * 1.44;
    berm.add(mesh(segGeo, bermMat, { x: Math.sin(a) * 5.4, y: 0.5, z: Math.cos(a) * 5.4, ry: a }));
  }
  g.add(berm);

  // Floodlights for night work.
  const lampMat = mat('lamp', { color: '#ddd', emissive: '#fff4d6', emissiveIntensity: 0 });
  for (const x of [-3.8, 3.8]) {
    g.add(cyl(0.07, 0.09, 4.2, M.grey(), { x, y: 2.1, z: 6.6 }, 8));
    g.add(box(0.6, 0.3, 0.3, lampMat, { x, y: 4.2, z: 6.7, rx: 0.5 }));
  }
  const flood = new THREE.SpotLight('#fff1d6', 0, 70, 1.1, 0.7, 1.2);
  flood.position.set(0, 4.4, 6.8);
  flood.target.position.set(0, 0, 18);
  g.add(flood, flood.target);

  let bermH = -1;
  function update({ shieldLevel = 0, shieldWork = 0, night = false, time = 0 }) {
    const h = 0.35 + shieldLevel * 0.75 + Math.min(1, shieldWork / 8) * 0.7;
    if (Math.abs(h - bermH) > 0.001) {
      bermH = bermH < 0 ? h : bermH + (h - bermH) * 0.08;
      berm.children.forEach((s, i) => {
        s.scale.y = bermH * (0.9 + 0.15 * Math.sin(i * 1.7));
        s.position.y = s.scale.y / 2 - 0.1;
      });
    }
    M.window().emissiveIntensity = night ? 1.8 : 0.15;
    lampMat.emissiveIntensity = night ? 4 : 0;
    flood.intensity = night ? 32 : 0;
    doorLight.scale.setScalar(1 + 0.15 * Math.sin(time * 3));
  }

  return { group: g, update, door };
}

export function buildLander({ high }) {
  const g = new THREE.Group();
  g.add(cyl(1.7, 1.7, 1.1, M.foil(), { y: 1.5 }, 8));
  g.add(cyl(1.0, 1.25, 1.4, M.white(), { y: 2.75 }, 8));
  g.add(cyl(0.65, 0.4, 0.9, M.dark(), { y: 0.7 }, 12));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = cyl(0.07, 0.07, 2.2, M.metal(), { x: Math.sin(a) * 1.9, y: 0.95, z: Math.cos(a) * 1.9 }, 6);
    leg.rotation.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
    g.add(leg);
    g.add(cyl(0.35, 0.4, 0.08, M.metal(), { x: Math.sin(a) * 2.35, y: 0.04, z: Math.cos(a) * 2.35 }, 10));
  }
  g.add(box(0.5, 0.7, 0.05, M.window(), { y: 2.9, z: 1.1 }));
  const flame = mesh(new THREE.ConeGeometry(0.55, 2.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), { y: -1.1, rx: Math.PI, shadow: false });
  flame.visible = false;
  g.add(flame);
  if (!high) g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: g, flame };
}
