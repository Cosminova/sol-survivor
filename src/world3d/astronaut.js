// Procedural astronaut built from primitives, with walk / lunar hop / idle / work animations.
import * as THREE from 'three';
import { M, mat, box, cyl, sphere, mesh, textTexture } from './meshes/kit.js';

const cap = (r, len, material, opts) => mesh(new THREE.CapsuleGeometry(r, len, 4, 10), material, opts);

function limb(upperLen, lowerLen, r, suit, end, roleMat, stripe) {
  const root = new THREE.Group();
  const upper = cap(r, upperLen, suit, { y: -upperLen / 2 - r * 0.4 });
  root.add(upper);
  if (stripe) root.add(cyl(r * 1.08, r * 1.08, 0.06, roleMat, { y: -0.04 }, 12));
  const joint = new THREE.Group();
  joint.position.y = -upperLen - r * 0.8;
  root.add(joint);
  joint.add(cap(r * 0.92, lowerLen, suit, { y: -lowerLen / 2 - r * 0.3 }));
  joint.add(end);
  end.position.y = -lowerLen - r * 0.7;
  return { root, joint };
}

function buildTools() {
  const shovel = new THREE.Group();
  shovel.add(cyl(0.02, 0.02, 1.0, M.grey(), { y: -0.35 }, 6));
  shovel.add(box(0.22, 0.02, 0.26, M.metal(), { y: -0.86, z: 0.06, rx: 0.4 }));
  const scanner = new THREE.Group();
  scanner.add(box(0.12, 0.08, 0.2, M.dark(), { y: -0.08, z: 0.06 }));
  scanner.add(sphere(0.03, M.ledGreen(), { y: -0.06, z: 0.17, shadow: false }, 8, 6));
  return { shovel, scanner };
}

export function buildAstronaut({ name = 'Crew', roleColor = '#2f80ed', high = true } = {}) {
  const suit = M.white();
  const roleMat = mat(`role-${roleColor}`, { color: roleColor, roughness: 0.5 });
  const visorMat = M.gold();
  const root = new THREE.Group();
  const body = new THREE.Group(); // bounces and leans
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  hips.add(box(0.42, 0.18, 0.26, M.panel(), { y: 0.02 }));

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  torso.add(cap(0.25, 0.32, suit, { y: 0.32 }));
  torso.add(box(0.3, 0.16, 0.08, M.panel(), { y: 0.36, z: 0.24 })); // chest display & controls
  torso.add(box(0.05, 0.03, 0.02, M.ledGreen(), { x: -0.08, y: 0.4, z: 0.285, shadow: false }));
  torso.add(box(0.05, 0.03, 0.02, roleMat, { x: 0.06, y: 0.4, z: 0.285, shadow: false }));
  const pack = box(0.46, 0.58, 0.24, M.white(), { y: 0.38, z: -0.3 });
  torso.add(pack);
  torso.add(box(0.36, 0.1, 0.05, roleMat, { y: 0.6, z: -0.43 }));
  torso.add(cyl(0.04, 0.04, 0.5, M.grey(), { x: 0.16, y: 0.4, z: -0.44 }, 8));

  const tagTex = textTexture(name.split(' ')[0].toUpperCase(), { w: 256, h: 64, bg: '#f4f1ea', fg: '#14213d', font: 'bold 40px system-ui, sans-serif' });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.7 }));
  tag.position.set(0, 0.22, 0.262);
  torso.add(tag);

  const head = new THREE.Group();
  head.position.y = 0.7;
  torso.add(head);
  head.add(sphere(0.22, suit, { y: 0.02 }, high ? 24 : 14, high ? 18 : 10));
  const visor = mesh(new THREE.SphereGeometry(0.205, high ? 24 : 14, 12, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.5), visorMat, { y: 0.03, z: 0.035 });
  head.add(visor);
  head.add(mesh(new THREE.TorusGeometry(0.215, 0.022, 6, 24), roleMat, { y: -0.1, rx: Math.PI / 2 }));
  const lampL = box(0.05, 0.035, 0.05, M.dark(), { x: -0.2, y: 0.1, z: 0.08, shadow: false });
  const lampR = lampL.clone();
  lampR.position.x = 0.2;
  head.add(lampL, lampR);
  const lampMat = mat('headlamp', { color: '#fff', emissive: '#fff6d8', emissiveIntensity: 0 });
  const bulbL = box(0.03, 0.02, 0.01, lampMat, { x: -0.2, y: 0.1, z: 0.106, shadow: false });
  const bulbR = bulbL.clone();
  bulbR.position.x = 0.2;
  head.add(bulbL, bulbR);

  const glove = () => sphere(0.075, M.panel(), {}, 10, 8);
  const boot = () => box(0.16, 0.12, 0.3, M.dark(), { z: 0.05 });
  const armL = limb(0.24, 0.22, 0.08, suit, glove(), roleMat, true);
  const armR = limb(0.24, 0.22, 0.08, suit, glove(), roleMat, true);
  armL.root.position.set(-0.33, 0.55, 0);
  armR.root.position.set(0.33, 0.55, 0);
  torso.add(armL.root, armR.root);
  const legL = limb(0.34, 0.32, 0.1, suit, boot(), roleMat, false);
  const legR = limb(0.34, 0.32, 0.1, suit, boot(), roleMat, false);
  legL.root.position.set(-0.13, -0.02, 0);
  legR.root.position.set(0.13, -0.02, 0);
  hips.add(legL.root, legR.root);

  const tools = buildTools();
  armR.joint.add(tools.shovel, tools.scanner);
  tools.shovel.visible = false;
  tools.scanner.visible = false;

  root.traverse((o) => { if (o.isMesh) o.castShadow = high; });

  let phase = 0;
  let workT = 0;
  let idleT = Math.random() * 10;
  let lastStepSign = 1;

  // state: { speed, gravity (g), work (verb|null), reducedMotion, lamps }
  // Returns true on the frame a foot touches down, so the caller can drop a footprint / crunch.
  function animate(dt, { speed = 0, gravity = 0.38, work = null, reducedMotion = false, lamps = false } = {}) {
    const moon = gravity < 0.25;
    const moving = speed > 0.15;
    lampMat.emissiveIntensity = lamps ? 3 : 0;
    tools.shovel.visible = work === 'shield';
    tools.scanner.visible = work === 'sample' || work === 'scan';
    let footDown = false;
    const reset = (g, v = 0) => { g.rotation.set(v, 0, 0); };
    [armL.root, armR.root, legL.root, legR.root, armL.joint, armR.joint, legL.joint, legR.joint].forEach((g) => reset(g));
    armL.root.rotation.z = 0.12;
    armR.root.rotation.z = -0.12;
    torso.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    body.position.y = 0;

    if (moving) {
      // Low gravity: slower cadence and bigger, floatier bounds. On the Moon a two-footed hop.
      const cadence = moon ? 1.5 + speed * 0.25 : 2.4 + speed * 0.65;
      phase += dt * cadence * Math.PI;
      const swing = Math.min(0.75, 0.25 + speed * 0.13);
      const s = Math.sin(phase);
      const bounceH = Math.min(0.45, (0.028 / gravity) * Math.min(1.6, speed / 2.2)) * (reducedMotion ? 0.4 : 1);
      if (moon) {
        const hop = Math.abs(Math.sin(phase * 0.5));
        body.position.y = hop * bounceH * 1.4;
        legL.root.rotation.x = legR.root.rotation.x = -0.35 * swing + hop * 0.5 * swing;
        legL.joint.rotation.x = legR.joint.rotation.x = 0.4 + (1 - hop) * 0.5;
        armL.root.rotation.x = armR.root.rotation.x = -0.4 + hop * 0.3;
        torso.rotation.x = 0.18;
        const sign = Math.sign(Math.cos(phase * 0.5));
        if (sign !== lastStepSign && sign > 0) footDown = true;
        lastStepSign = sign;
      } else {
        body.position.y = Math.abs(s) * bounceH;
        legL.root.rotation.x = s * swing;
        legR.root.rotation.x = -s * swing;
        legL.joint.rotation.x = Math.max(0, -s) * swing * 1.2;
        legR.joint.rotation.x = Math.max(0, s) * swing * 1.2;
        armL.root.rotation.x = -s * swing * 0.7;
        armR.root.rotation.x = s * swing * 0.7;
        armL.joint.rotation.x = armR.joint.rotation.x = -0.3;
        torso.rotation.x = 0.06 + speed * 0.02;
        const sign = Math.sign(s);
        if (sign !== lastStepSign) footDown = true;
        lastStepSign = sign;
      }
    } else if (work) {
      workT += dt;
      const w = Math.sin(workT * 5);
      if (work === 'shield') {
        torso.rotation.x = 0.45 + w * 0.15;
        armR.root.rotation.x = armL.root.rotation.x = -0.9 - w * 0.5;
        armL.root.rotation.z = -0.25;
        legL.joint.rotation.x = legR.joint.rotation.x = 0.3;
      } else if (work === 'clean') {
        armR.root.rotation.x = -1.3 + Math.cos(workT * 6) * 0.25;
        armR.root.rotation.z = -0.3 + Math.sin(workT * 6) * 0.35;
        torso.rotation.x = 0.2;
      } else if (work === 'tend' || work === 'drill') {
        legL.root.rotation.x = legR.root.rotation.x = -0.6;
        legL.joint.rotation.x = legR.joint.rotation.x = 1.1;
        body.position.y = -0.18;
        torso.rotation.x = 0.35;
        armL.root.rotation.x = armR.root.rotation.x = -0.9 + (work === 'drill' ? Math.sin(workT * 40) * 0.04 : w * 0.25);
      } else if (work === 'sample' || work === 'scan') {
        armR.root.rotation.x = -1.2 + Math.sin(workT * 2) * 0.15;
        armR.root.rotation.z = -0.3 + Math.sin(workT * 1.3) * 0.25;
        head.rotation.x = 0.35;
        torso.rotation.x = 0.25;
      } else {
        armL.root.rotation.x = -1 + w * 0.15;
        armR.root.rotation.x = -1 - w * 0.15;
        armL.joint.rotation.x = armR.joint.rotation.x = -0.6;
        torso.rotation.x = 0.3;
      }
    } else {
      idleT += dt;
      body.position.y = reducedMotion ? 0 : Math.sin(idleT * 1.8) * 0.008;
      head.rotation.y = Math.sin(idleT * 0.35) * 0.4;
      armL.root.rotation.x = Math.sin(idleT * 0.9) * 0.04;
      armR.root.rotation.x = -Math.sin(idleT * 0.9) * 0.04;
    }
    if (!work) workT = 0;
    return footDown;
  }

  function setOpacity(alpha) {
    root.visible = alpha > 0.02;
    root.scale.setScalar(0.85 + 0.15 * alpha);
  }

  return {
    root,
    animate,
    setOpacity,
    dispose() {
      tagTex.dispose();
      tag.material.dispose();
    },
  };
}
