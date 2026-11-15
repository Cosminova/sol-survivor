// NASA 3D Resources "Astronaut" (Extravehicular Mobility Unit) model, loaded offline from
// public/models/nasa-astronaut.glb (Draco + WebP, decoder bundled in public/models/draco/).
// The model is a single static mesh in a relaxed T-pose, so we split its triangles into limb
// segments around joint pivots and drive them with suitAnimator.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createAnimator } from './suitAnimator.js';
import { addStripes } from './stripes.js';
import { M, mat, textTexture, box } from './meshes/kit.js';
import { headlampMaterial } from './astronaut.js';
import { segmentOf, JOINTS, PELVIS } from './suitSegments.js';

export const SUIT_HEIGHT = 1.85;

function collectTriangles(scene) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    parts.push({ geometry: g, material: o.material });
  });
  return parts;
}

function normalise(parts) {
  const box3 = new THREE.Box3();
  parts.forEach((p) => { p.geometry.computeBoundingBox(); box3.union(p.geometry.boundingBox); });
  const size = box3.getSize(new THREE.Vector3());
  const s = SUIT_HEIGHT / size.y;
  const centre = box3.getCenter(new THREE.Vector3());
  const m = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box3.min.y, -centre.z));
  parts.forEach((p) => p.geometry.applyMatrix4(m));
  // Face +z: the visor (smaller part) should be in front.
  const visor = parts.reduce((a, b) => (a.geometry.attributes.position.count < b.geometry.attributes.position.count ? a : b));
  visor.geometry.computeBoundingBox();
  if (visor.geometry.boundingBox.max.z < 0) parts.forEach((p) => p.geometry.rotateY(Math.PI));
  return { span: (size.x * s) / SUIT_HEIGHT, visor };
}

// Splits each part's triangles by segment and re-centres every segment on its joint pivot.
function splitSegments(parts, span) {
  const buckets = {};
  const joints = JOINTS(span);
  for (const part of parts) {
    const pos = part.geometry.attributes.position;
    const attrs = Object.keys(part.geometry.attributes);
    const lists = {};
    for (let t = 0; t < pos.count; t += 3) {
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
      const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
      const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
      const seg = segmentOf(cx / SUIT_HEIGHT, cy / SUIT_HEIGHT, cz / SUIT_HEIGHT, span);
      (lists[seg] ??= []).push(t);
    }
    for (const [seg, tris] of Object.entries(lists)) {
      const g = new THREE.BufferGeometry();
      for (const name of attrs) {
        const src = part.geometry.attributes[name];
        const arr = new Float32Array(tris.length * 3 * src.itemSize);
        tris.forEach((t, i) => {
          for (let k = 0; k < 3; k += 1) for (let c = 0; c < src.itemSize; c += 1) arr[(i * 3 + k) * src.itemSize + c] = src.getComponent(t + k, c);
        });
        g.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
      }
      const pivot = joints[seg];
      g.translate(-pivot.x * SUIT_HEIGHT, -pivot.y * SUIT_HEIGHT, -pivot.z * SUIT_HEIGHT);
      g.userData.shared = true;
      (buckets[seg] ??= []).push({ geometry: g, material: part.material });
    }
    part.geometry.dispose();
  }
  return buckets;
}

function prepareMaterials(parts, visor) {
  for (const p of parts) {
    if (p === visor) {
      p.material = M.gold();
    } else {
      p.material = p.material.clone();
      p.material.roughness = 0.62;
      p.material.metalness = 0;
      p.material.color.set('#ffffff');
      p.material.userData.shared = true;
    }
  }
}

// Builds a reusable template: geometry per segment plus pivot positions (fractions of height).
function buildTemplate(gltf) {
  const parts = collectTriangles(gltf.scene);
  const { span, visor } = normalise(parts);
  prepareMaterials(parts, visor);
  const buckets = splitSegments(parts, span);
  const joints = JOINTS(span);
  const armAngle = (side) => {
    const sh = joints[`upperArm${side}`];
    const hand = joints[`hand${side}`];
    return Math.atan2(hand.x - sh.x, -(hand.y - sh.y)); // arm angle from straight down
  };
  return { buckets, joints, span, restL: -0.14 - armAngle('L'), restR: 0.14 - armAngle('R') };
}

let pending = null;

export function loadSuitTemplate({ base = document.baseURI } = {}) {
  if (pending) return pending;
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('models/draco/', base).href);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  pending = loader.loadAsync(new URL('models/nasa-astronaut.glb', base).href)
    .then((gltf) => buildTemplate(gltf))
    .catch((err) => {
      console.warn('[world3d] NASA suit model unavailable, using the procedural astronaut', err);
      pending = null;
      return null;
    })
    .finally(() => draco.dispose());
  return pending;
}

const H = SUIT_HEIGHT;

function segmentGroup(template, seg) {
  const g = new THREE.Group();
  const p = template.joints[seg];
  g.position.set(p.x * H, p.y * H, p.z * H);
  for (const { geometry, material } of template.buckets[seg] ?? []) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// Re-expresses a child's pivot position relative to its parent's pivot.
function attach(parent, child, template, parentSeg) {
  const pp = template.joints[parentSeg] ?? { x: 0, y: 0, z: 0 };
  child.position.x -= pp.x * H;
  child.position.y -= pp.y * H;
  child.position.z -= pp.z * H;
  parent.add(child);
}

const PELVIS_SEGMENTS = { width: 12, height: 8 };
let pelvisGeometry = null;

// Low-poly solid seat shared by every astronaut; it sits in `body` so it stays put while the legs swing.
function buildPelvis() {
  if (!pelvisGeometry) {
    pelvisGeometry = new THREE.SphereGeometry(1, PELVIS_SEGMENTS.width, PELVIS_SEGMENTS.height);
    pelvisGeometry.userData.shared = true; // survives disposeTree() of a single astronaut
  }
  const pelvis = new THREE.Mesh(pelvisGeometry, mat('suit-pelvis', { color: '#e9e6df', roughness: 0.62 }));
  pelvis.name = 'pelvis';
  pelvis.position.set(PELVIS.centre.x * H, PELVIS.centre.y * H, PELVIS.centre.z * H);
  pelvis.scale.set(PELVIS.radii.x * H, PELVIS.radii.y * H, PELVIS.radii.z * H);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  return pelvis;
}

export function buildSuitAstronaut(template, { name = 'Crew', role = 'commander', high = true }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = segmentGroup(template, 'torso');
  body.add(torso);
  body.add(buildPelvis());
  const head = segmentGroup(template, 'head');
  attach(torso, head, template, 'torso');
  const limb = (upper, lower, toTorso) => {
    const r = segmentGroup(template, upper);
    const j = segmentGroup(template, lower);
    attach(r, j, template, upper);
    if (toTorso) attach(torso, r, template, 'torso');
    else body.add(r);
    return { root: r, joint: j };
  };
  const armL = limb('upperArmL', 'forearmL', true);
  const armR = limb('upperArmR', 'forearmR', true);
  const legL = limb('thighL', 'shinL', false);
  const legR = limb('thighR', 'shinR', false);
  for (const leg of [legL, legR]) addStripes(leg.root, role, { radius: 0.11, y: -0.2 });

  const tagTex = textTexture(name.split(' ')[0].toUpperCase(), { w: 256, h: 64, bg: '#f4f1ea', fg: '#111111', font: 'bold 40px system-ui, sans-serif' });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.7 }));
  const chest = template.joints.chestFront;
  tag.position.set(0.07, (chest.y - template.joints.torso.y) * H, (chest.z - template.joints.torso.z) * H + 0.012);
  torso.add(tag);
  const lampMat = headlampMaterial();
  for (const x of [-0.16, 0.16]) head.add(box(0.05, 0.035, 0.05, lampMat, { x, y: 0.06, z: 0.1, shadow: false }));
  if (!high) root.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  const animator = createAnimator({ body, torso, head, armL, armR, legL, legR, armRest: { L: template.restL, R: template.restR } });
  return {
    root,
    kind: 'nasa',
    animate(dt, state = {}) {
      lampMat.emissiveIntensity = state.lamps ? 3 : 0;
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

export function disposeSuitTemplate(template) {
  pelvisGeometry?.dispose();
  pelvisGeometry = null;
  if (!template) return;
  for (const list of Object.values(template.buckets)) {
    for (const { geometry, material } of list) {
      geometry.dispose();
      if (material.userData.shared) {
        material.map?.dispose();
        material.dispose();
      }
    }
  }
}
