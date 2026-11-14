// Lightweight procedural astronaut (used in low quality mode and as a fallback if the NASA model
// fails to load). Animation comes from suitAnimator.js so both rigs move the same way.
import * as THREE from 'three';
import { M, mat, box, cyl, sphere, mesh, textTexture } from './meshes/kit.js';
import { createAnimator } from './suitAnimator.js';
import { addStripes } from './stripes.js';

const cap = (r, len, material, opts) => mesh(new THREE.CapsuleGeometry(r, len, 4, 10), material, opts);

function limb(upperLen, lowerLen, r, suit, end) {
  const root = new THREE.Group();
  root.add(cap(r, upperLen, suit, { y: -upperLen / 2 - r * 0.4 }));
  const joint = new THREE.Group();
  joint.position.y = -upperLen - r * 0.8;
  root.add(joint);
  joint.add(cap(r * 0.92, lowerLen, suit, { y: -lowerLen / 2 - r * 0.3 }));
  joint.add(end);
  end.position.y = -lowerLen - r * 0.7;
  return { root, joint };
}

function buildTools(parent) {
  const shovel = new THREE.Group();
  shovel.add(cyl(0.02, 0.02, 1.0, M.grey(), { y: -0.35 }, 6));
  shovel.add(box(0.22, 0.02, 0.26, M.metal(), { y: -0.86, z: 0.06, rx: 0.4 }));
  const scanner = new THREE.Group();
  scanner.add(box(0.12, 0.08, 0.2, M.dark(), { y: -0.08, z: 0.06 }));
  parent.add(shovel, scanner);
  shovel.visible = false;
  scanner.visible = false;
  return { shovel, scanner };
}

export function headlampMaterial() {
  return mat('headlamp', { color: '#fff', emissive: '#fff6d8', emissiveIntensity: 0 });
}

export function buildAstronaut({ name = 'Crew', role = 'commander', high = true } = {}) {
  const suit = M.white();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  hips.add(box(0.42, 0.18, 0.26, M.panel(), { y: 0.02 }));

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  torso.add(cap(0.25, 0.32, suit, { y: 0.32 }));
  torso.add(box(0.3, 0.16, 0.08, M.panel(), { y: 0.36, z: 0.24 }));
  torso.add(box(0.46, 0.58, 0.24, M.white(), { y: 0.38, z: -0.3 }));
  torso.add(cyl(0.04, 0.04, 0.5, M.grey(), { x: 0.16, y: 0.4, z: -0.44 }, 8));

  const tagTex = textTexture(name.split(' ')[0].toUpperCase(), { w: 256, h: 64, bg: '#f4f1ea', fg: '#111111', font: 'bold 40px system-ui, sans-serif' });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.7 }));
  tag.position.set(0, 0.22, 0.262);
  torso.add(tag);

  const head = new THREE.Group();
  head.position.y = 0.7;
  torso.add(head);
  head.add(sphere(0.22, suit, { y: 0.02 }, high ? 24 : 14, high ? 18 : 10));
  head.add(mesh(new THREE.SphereGeometry(0.205, high ? 24 : 14, 12, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.5), M.gold(), { y: 0.03, z: 0.035 }));
  const lampMat = headlampMaterial();
  for (const x of [-0.2, 0.2]) head.add(box(0.05, 0.035, 0.05, lampMat, { x, y: 0.1, z: 0.09, shadow: false }));

  const glove = () => sphere(0.075, M.panel(), {}, 10, 8);
  const boot = () => box(0.16, 0.12, 0.3, M.dark(), { z: 0.05 });
  const armL = limb(0.24, 0.22, 0.08, suit, glove());
  const armR = limb(0.24, 0.22, 0.08, suit, glove());
  armL.root.position.set(-0.33, 0.55, 0);
  armR.root.position.set(0.33, 0.55, 0);
  torso.add(armL.root, armR.root);
  const legL = limb(0.34, 0.32, 0.1, suit, boot());
  const legR = limb(0.34, 0.32, 0.1, suit, boot());
  legL.root.position.set(-0.13, -0.02, 0);
  legR.root.position.set(0.13, -0.02, 0);
  hips.add(legL.root, legR.root);
  for (const leg of [legL, legR]) addStripes(leg.root, role, { radius: 0.108, y: -0.22 });

  const tools = buildTools(armR.joint);
  root.traverse((o) => { if (o.isMesh) o.castShadow = high; });
  const animator = createAnimator({ body, torso, head, armL, armR, legL, legR });

  return {
    root,
    kind: 'primitive',
    animate(dt, state = {}) {
      lampMat.emissiveIntensity = state.lamps ? 3 : 0;
      tools.shovel.visible = state.work === 'shield';
      tools.scanner.visible = state.work === 'sample' || state.work === 'scan';
      return animator.animate(dt, state);
    },
    get falling() { return animator.falling; },
    setOpacity(alpha) {
      root.visible = alpha > 0.02;
      root.scale.setScalar(0.85 + 0.15 * alpha);
    },
    dispose() {
      tagTex.dispose();
      tag.material.dispose();
    },
  };
}
