// Greenhouse domes (plants grow with greenhouse.growth), ISRU plants, ice drill and storm shelter.
import * as THREE from 'three';
import { M, mat, box, cyl, sphere, mesh, regolith, signMesh } from './kit.js';
import { makeRng } from '../rng.js';

const GROW_SOLS = 25;

export function buildGreenhouse(station, { high }) {
  const g = new THREE.Group();
  const plantGeo = new THREE.ConeGeometry(0.18, 0.5, 6);
  const fruitGeo = new THREE.SphereGeometry(0.07, 6, 5);
  const plants = [];
  const fruits = [];
  const rng = makeRng(17);
  station.units.forEach((u) => {
    const ug = new THREE.Group();
    ug.position.set(u.x - station.x, 0, u.z - station.z);
    ug.add(cyl(3.1, 3.2, 0.35, M.panel(), { y: 0.17 }, high ? 32 : 18));
    const dome = mesh(new THREE.SphereGeometry(3, high ? 28 : 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass(), { y: 0.3, shadow: false });
    ug.add(dome);
    const ribs = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(3.02, 1)),
      new THREE.LineBasicMaterial({ color: '#dfe7ef', transparent: true, opacity: 0.55 }),
    );
    ribs.position.y = 0.3; // the lower half is hidden by the ground
    ug.add(ribs);
    ug.add(box(2.6, 0.08, 0.5, M.glowPink(), { y: 2.3, shadow: false }));
    for (let row = -1; row <= 1; row += 1) {
      ug.add(box(3.6, 0.35, 0.6, M.dark(), { y: 0.5, z: row * 1.0 }));
      for (let i = 0; i < 6; i += 1) {
        const p = mesh(plantGeo, M.plant(), { x: -1.5 + i * 0.6, y: 0.7, z: row * 1.0 + rng.range(-0.1, 0.1), shadow: false });
        ug.add(p);
        plants.push(p);
        const f = mesh(fruitGeo, M.red(), { x: p.position.x + 0.1, y: 0.95, z: p.position.z + 0.1, shadow: false });
        f.visible = false;
        ug.add(f);
        fruits.push(f);
      }
    }
    g.add(ug);
  });

  function update({ growth = 0, disabled = false, time = 0 }) {
    const k = Math.min(1, growth / GROW_SOLS);
    plants.forEach((p, i) => {
      const s = 0.25 + 0.75 * k * (0.85 + 0.15 * Math.sin(i * 2.1));
      p.scale.set(s, s * (1 + 0.04 * Math.sin(time * 1.5 + i)), s);
      p.position.y = 0.68 + 0.25 * s;
    });
    fruits.forEach((f, i) => { f.visible = k >= 1 && i % 2 === 0; });
    M.glowPink().emissiveIntensity = disabled ? 0 : 1.4;
  }
  return { group: g, update };
}

function tankUnit(color) {
  const g = new THREE.Group();
  g.add(box(1.2, 0.9, 0.9, M.panel(), { y: 0.45 }));
  g.add(cyl(0.3, 0.3, 1.3, mat(`tank-${color}`, { color, roughness: 0.4, metalness: 0.3 }), { x: 0.85, y: 0.65 }, 12));
  g.add(sphere(0.3, mat(`tank-${color}`, { color }), { x: 0.85, y: 1.3 }, 12, 8));
  g.add(box(0.5, 0.05, 0.02, M.ledGreen(), { y: 0.7, z: 0.46, shadow: false }));
  return g;
}

export function buildIsru(station) {
  const g = new THREE.Group();
  const spin = [];
  const kind = station.kind;
  if (kind === 'recycler') g.add(tankUnit('#4da3ff'));
  if (kind === 'oxygen') g.add(tankUnit('#e8f1ff'));
  if (kind === 'moxie') {
    g.add(box(1.1, 0.8, 0.9, M.gold(), { y: 0.55 }));
    g.add(box(1.2, 0.15, 1.0, M.dark(), { y: 0.1 }));
    const fan = cyl(0.32, 0.32, 0.12, M.dark(), { y: 0.6, z: 0.5, rx: Math.PI / 2 }, 12);
    g.add(fan);
    const blades = box(0.55, 0.04, 0.06, M.metal(), { y: 0.6, z: 0.57, rx: Math.PI / 2 });
    g.add(blades);
    spin.push({ o: blades, axis: 'z', rate: 9 });
  }
  if (kind === 'regolithO2') {
    g.add(mesh(new THREE.ConeGeometry(0.8, 1.1, 8, 1, true), M.grey(), { y: 1.7, rx: Math.PI }));
    g.add(box(1.4, 1.0, 1.0, M.panel(), { y: 0.5 }));
    g.add(box(0.6, 0.15, 0.04, M.glowOrange(), { y: 0.7, z: 0.52, shadow: false }));
  }
  g.add(cyl(0.06, 0.06, 2.2, M.grey(), { x: -0.5, y: 0.25, z: -1, rx: Math.PI / 2 }, 6)); // pipe to habitat
  g.rotation.y = station.angle + Math.PI;
  function update({ disabled = false, dt = 0 }) {
    if (disabled) return;
    for (const s of spin) s.o.rotation[s.axis] += s.rate * dt;
  }
  return { group: g, update };
}

export function buildIceDrill(station) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.06, 0.06, 4.2, M.metal(), { x: Math.sin(a) * 0.9, y: 2, z: Math.cos(a) * 0.9 }, 6);
    leg.rotation.set(Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22);
    g.add(leg);
  }
  g.add(box(0.5, 0.5, 0.5, M.orange(), { y: 3.9 }));
  const rod = new THREE.Group();
  rod.add(cyl(0.07, 0.07, 3.6, M.metal(), { y: 1.9 }, 8));
  rod.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 10), M.dark(), { y: 1.2, rx: Math.PI / 2 }));
  g.add(rod);
  g.add(cyl(0.45, 0.45, 1.1, M.white(), { x: 1.6, y: 0.55 }, 14));
  g.add(signMesh('H₂O', { w: 0.6, h: 0.22, bg: '#4da3ff', fg: '#fff' }));
  g.children.at(-1).position.set(1.6, 0.8, 0.47);
  function update({ disabled = false, dt = 0, broken = false }) {
    if (!disabled && !broken) rod.rotation.y += dt * 4;
  }
  return { group: g, update };
}

export function buildShelter(station, { body }) {
  const g = new THREE.Group();
  const mound = mesh(new THREE.SphereGeometry(2.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), regolith(body), {});
  mound.scale.y = 0.75;
  g.add(mound);
  const toHab = Math.atan2(-station.x, -station.z);
  const door = new THREE.Group();
  door.rotation.y = toHab;
  door.add(box(1.3, 1.6, 0.9, M.panel(), { y: 0.8, z: 2.3 }));
  door.add(box(0.9, 1.3, 0.05, M.dark(), { y: 0.75, z: 2.76 }));
  const s = signMesh('STORM SHELTER', { w: 1.3, h: 0.3, bg: '#ffd23f', fg: '#111' });
  s.position.set(0, 1.8, 2.76);
  door.add(s);
  g.add(door);
  return { group: g, update: () => {} };
}
