// Rover, relay dish, spare-parts crates, berm work pile, science outcrops and collectibles.
import * as THREE from 'three';
import { M, mat, box, cyl, sphere, mesh, regolith } from './kit.js';
import { makeRng } from '../rng.js';

export function buildRover() {
  const g = new THREE.Group();
  g.add(box(2.2, 0.35, 3.6, M.grey(), { y: 0.75 }));
  g.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.6, 16, 1, false, 0, Math.PI), M.white(), { y: 1.0, z: -0.2, rx: Math.PI / 2, rz: Math.PI / 2 }));
  g.add(box(1.5, 0.55, 0.08, M.window(), { y: 1.45, z: 1.12, rx: -0.35 }));
  g.add(box(1.9, 0.1, 0.25, M.orange(), { y: 0.95, z: 1.85 }));
  const lampMat = mat('roverLamp', { color: '#fff', emissive: '#fff8e0', emissiveIntensity: 0.4 });
  for (const x of [-0.7, 0.7]) g.add(box(0.25, 0.12, 0.05, lampMat, { x, y: 0.9, z: 1.83, shadow: false }));
  const wheels = [];
  for (const z of [-1.3, 0, 1.3]) {
    for (const x of [-1.2, 1.2]) {
      const w = cyl(0.45, 0.45, 0.3, M.dark(), { x, y: 0.45, z, rz: Math.PI / 2 }, 14);
      g.add(w);
      wheels.push(w);
    }
  }
  g.add(cyl(0.03, 0.03, 1.2, M.grey(), { x: 0.8, y: 1.9, z: -1.2 }, 6));
  function spinWheels(distance) {
    for (const w of wheels) w.rotation.x += distance / 0.45;
  }
  return { group: g, wheels, spinWheels, lampMat, update: () => {} };
}

export function buildRelay() {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.2, 3.4, M.metal(), { y: 1.7 }, 10));
  const head = new THREE.Group();
  head.position.y = 3.5;
  g.add(head);
  const dishMat = mat('dish', { color: '#f1f1f1', roughness: 0.5, side: THREE.DoubleSide });
  head.add(mesh(new THREE.SphereGeometry(1.3, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), dishMat, { rx: -Math.PI / 2 - 0.6 }));
  head.add(cyl(0.03, 0.03, 1.1, M.grey(), { y: 0.35, z: 0.45, rx: 0.9 }, 6));
  head.add(sphere(0.07, M.ledRed(), { y: 0.75, z: 0.9, shadow: false }, 8, 6));
  function update({ disabled = false, dt = 0 }) {
    if (!disabled) head.rotation.y += dt * 0.12;
  }
  return { group: g, update };
}

export function buildSpares() {
  const g = new THREE.Group();
  const crate = mat('crate', { color: '#d8cfb8', roughness: 0.8 });
  [[0, 0.3, 0], [0.75, 0.3, 0.1], [0.35, 0.9, 0.05], [-0.7, 0.25, 0.2]].forEach(([x, y, z], i) => {
    g.add(box(i === 3 ? 0.5 : 0.7, i === 3 ? 0.5 : 0.6, 0.6, i === 2 ? M.orange() : crate, { x, y, z, ry: i * 0.3 }));
  });
  return { group: g, update: () => {} };
}

export function buildBermPile(station, { body }) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(1.5, 1.2, 9), regolith(body), { y: 0.55 }));
  const shovel = new THREE.Group();
  shovel.add(cyl(0.025, 0.025, 1.2, M.grey(), { y: 0.6 }, 6));
  shovel.add(box(0.24, 0.3, 0.03, M.metal(), { y: 0.05 }));
  shovel.position.set(0.5, 0.75, 0.6);
  shovel.rotation.set(0.3, 0, -0.35);
  g.add(shovel);
  g.add(box(0.8, 0.35, 0.55, M.orange(), { x: -1.4, y: 0.35, z: 0.6, ry: 0.4 })); // regolith cart
  return { group: g, update: () => {} };
}

export function buildOutcrop(station, { body }) {
  const g = new THREE.Group();
  const rng = makeRng(1000 + station.index * 37);
  const rockMat = mat(`outcrop-${body}`, { color: body === 'moon' ? '#8f8b85' : '#8a5a3e', roughness: 0.9, flatShading: true });
  const layerMat = mat(`outcrop-layer-${body}`, { color: body === 'moon' ? '#b5b0a8' : '#b98a62', roughness: 0.95, flatShading: true });
  for (let i = 0; i < 5; i += 1) {
    const r = rng.range(0.5, 1.2);
    const rock = mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? layerMat : rockMat, { x: rng.range(-1, 1), y: r * 0.45, z: rng.range(-0.9, 0.9), ry: rng.range(0, 6) });
    rock.scale.y = body === 'mars' ? 0.55 : 0.8; // flat sedimentary slabs on Mars
    g.add(rock);
  }
  const flagMat = new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.6, side: THREE.DoubleSide });
  g.add(cyl(0.025, 0.025, 1.6, M.grey(), { x: 1.4, y: 0.8, z: 0.4 }, 6));
  const flag = mesh(new THREE.PlaneGeometry(0.45, 0.3), flagMat, { x: 1.62, y: 1.45, z: 0.4, shadow: false });
  g.add(flag);
  function update({ sampled = false, time = 0 }) {
    flagMat.color.set(sampled ? '#3ddc84' : '#ff7a1a');
    flagMat.emissive.set(sampled ? '#0a7a3a' : '#ff5a00');
    flag.rotation.y = Math.sin(time * 2 + station.index) * 0.15;
  }
  return { group: g, update };
}

export function buildCollectible(kind) {
  const g = new THREE.Group();
  const item = new THREE.Group();
  g.add(item);
  if (kind === 'meteorite') {
    item.add(mesh(new THREE.DodecahedronGeometry(0.28, 0), mat('meteorite', { color: '#3b3634', roughness: 0.35, metalness: 0.8 }), { y: 0.4 }));
  } else if (kind === 'patch') {
    item.add(cyl(0.3, 0.3, 0.04, mat('patch', { color: '#1d3f8f', emissive: '#14306a', emissiveIntensity: 0.6 }), { y: 0.5, rx: Math.PI / 2 }, 20));
    item.add(mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 20), M.gold(), { y: 0.5 }));
  } else {
    item.add(mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 16), M.metal(), { y: 0.45 }));
    item.add(box(0.06, 0.4, 0.06, M.grey(), { y: 0.45 }));
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = mesh(new THREE.RingGeometry(0.45, 0.6, 32), ringMat, { y: 0.03, rx: -Math.PI / 2, shadow: false });
  g.add(ring);
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 8, 1, true), ringMat, { y: 3, shadow: false }));
  function update({ time = 0 }) {
    item.rotation.y = time * 1.4;
    item.position.y = Math.sin(time * 2.2) * 0.08;
    ring.scale.setScalar(1 + 0.15 * Math.sin(time * 3));
  }
  return { group: g, update };
}
