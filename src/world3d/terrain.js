// Ground mesh, detail texture and instanced rocks. Albedo is modulated by the real NASA Trek
// tile around the landing site so each site's ground tone differs.
import * as THREE from 'three';
import { makeRng, fbm2, clamp } from './rng.js';

const PALETTE = {
  mars: { dark: '#7c3f22', light: '#c07a4c', dust: '#d9a176', crater: '#6a3a24' },
  moon: { dark: '#5d5b58', light: '#9a9792', dust: '#b4b0aa', crater: '#4e4c4a' },
};

function detailTexture(body, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rng = makeRng(body === 'moon' ? 77 : 33);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = fbm2(x / 18, y / 18, 5, 3) * 26 + fbm2(x / 4, y / 4, 9, 2) * 14 + (rng.next() - 0.5) * 22;
      const v = clamp(206 + n, 0, 255);
      const i = (y * size + x) * 4;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Pebbles: small dark stones with a lit edge.
  for (let i = 0; i < 900; i += 1) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = 0.8 + rng.next() ** 3 * 4.5;
    ctx.fillStyle = `rgba(40,30,25,${0.25 + rng.next() * 0.35})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, rng.next() * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,230,0.25)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const rng = makeRng(seed);
  const pos = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 0.75 + rng.next() * 0.45);
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

export function trekTileUrl(body, site) {
  const x = clamp(Math.floor(((site?.lon ?? 0) + 180) / 45), 0, 7);
  const y = clamp(Math.floor((90 - (site?.lat ?? 0)) / 45), 0, 3);
  return { url: new URL(`tiles/${body}/${y}_${x}.jpg`, document.baseURI).href, x, y };
}

// extentM: metres covered by the terrain (so the crop matches the real ground footprint).
function sampleTrek(body, site, extentM) {
  return new Promise((resolve) => {
    const { url, y } = trekTileUrl(body, site);
    const img = new Image();
    img.onload = () => {
      try {
        const n = 48;
        const c = document.createElement('canvas');
        c.width = n; c.height = n;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        const px = ((((site.lon + 180) % 45) + 45) % 45) / 45 * img.width;
        const py = (((90 - site.lat) - y * 45) / 45) * img.height;
        const metresPerPx = ((45 / img.width) * Math.PI * (body === 'moon' ? 1737400 : 3389500)) / 180;
        const span = Math.max(3, (2 * extentM) / metresPerPx);
        ctx.drawImage(img, clamp(px - span / 2, 0, img.width - span), clamp(py - span / 2, 0, img.height - span), span, span, 0, 0, n, n);
        const data = ctx.getImageData(0, 0, n, n).data;
        let sum = 0;
        const lum = new Float32Array(n * n);
        for (let i = 0; i < n * n; i += 1) { lum[i] = data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11; sum += lum[i]; }
        const avg = sum / (n * n) || 1;
        resolve({ ratio: (u, v) => lum[clamp(Math.floor(v * n), 0, n - 1) * n + clamp(Math.floor(u * n), 0, n - 1)] / avg });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function scatterRocks({ body, heightfield, layout, high }) {
  const rng = makeRng((layout.seed ^ 0xabcdef) >>> 0);
  const count = high ? 520 : 180;
  const rockMat = new THREE.MeshStandardMaterial({ color: body === 'moon' ? '#8a8783' : '#7d4a32', roughness: 0.92, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeometry(layout.seed), rockMat, count);
  rocks.castShadow = high;
  rocks.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const blockers = [...layout.colliders.map((c) => ({ ...c, r: c.r + 2.5 })), ...layout.stations.flatMap((s) => s.spots.map((p) => ({ ...p, r: 2 })))];
  const tint = new THREE.Color();
  const colliders = [];
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 8; tries += 1) {
    const a = rng.range(-Math.PI, Math.PI);
    const d = 6 + rng.next() ** 0.8 * 170;
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d;
    if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r)) continue;
    const s = 0.08 + rng.next() ** 4 * (d > 30 ? 2.4 : 1.1);
    e.set(rng.range(0, 3), rng.range(0, 6.28), rng.range(0, 3));
    q.setFromEuler(e);
    m4.compose(v.set(x, heightfield.heightAt(x, z) + s * 0.15, z), q, sc.set(s * rng.range(0.8, 1.4), s, s * rng.range(0.8, 1.3)));
    rocks.setMatrixAt(placed, m4);
    rocks.setColorAt(placed, tint.setScalar(0.75 + rng.next() * 0.45));
    if (s > 0.7) colliders.push({ x, z, r: s * 0.9 });
    placed += 1;
  }
  rocks.count = placed;
  rocks.instanceMatrix.needsUpdate = true;
  return { rocks, rockMat, colliders };
}

// Polar grid: rings grow geometrically so spacing is ~square everywhere, dense under the player's
// feet and coarse out at the lidar horizon. One seamless mesh, no near/far stitching.
function polarGeometry(heightAt, { segs, r0, rMax }) {
  const ratio = 1 + (2 * Math.PI) / segs;
  const radii = [];
  for (let r = r0; r < rMax; r *= ratio) radii.push(r);
  radii.push(rMax);
  const count = 1 + radii.length * segs;
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  pos.set([0, heightAt(0, 0), 0], 0);
  radii.forEach((r, ri) => {
    for (let s = 0; s < segs; s += 1) {
      const a = (s / segs) * Math.PI * 2;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const i = 1 + ri * segs + s;
      pos.set([x, heightAt(x, z), z], i * 3);
      uv.set([x / 3.2, z / 3.2], i * 2);
    }
  });
  const index = [];
  for (let s = 0; s < segs; s += 1) index.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let ri = 0; ri < radii.length - 1; ri += 1) {
    for (let s = 0; s < segs; s += 1) {
      const a = 1 + ri * segs + s;
      const b = 1 + ri * segs + ((s + 1) % segs);
      const c = a + segs;
      const d = b + segs;
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  geo.computeVertexNormals();
  return geo;
}

export function createTerrain({ body, site, heightfield, layout, high }) {
  const rMax = heightfield.hasDem ? Math.min(heightfield.extent * 0.98, high ? 30000 : 12000) : (high ? 1500 : 900);
  const geo = polarGeometry(heightfield.heightAt, { segs: high ? 256 : 112, r0: 1.2, rMax });
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const pal = Object.fromEntries(Object.entries(PALETTE[body] ?? PALETTE.mars).map(([k, v]) => [k, new THREE.Color(v)]));
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const k = Math.max(1, Math.hypot(x, z) / 60); // broader colour patches further out
    tmp.copy(pal.dark).lerp(pal.light, clamp(0.55 + fbm2(x / (22 * k), z / (22 * k), 3, 4) * 0.9, 0, 1));
    tmp.lerp(pal.dust, clamp(fbm2(x / (70 * k), z / (70 * k), 8, 3) * 1.2, 0, 0.6));
    const cs = heightfield.craterShade(x, z);
    if (cs > 0) tmp.lerp(body === 'moon' ? pal.dust : pal.crater, cs * 0.35);
    // Steep slopes from the lidar landform: darker bedrock on Mars, fresher brighter regolith on the Moon.
    const slope = 1 - nrm.getY(i);
    if (slope > 0.04) tmp.lerp(body === 'moon' ? pal.dust : pal.crater, clamp((slope - 0.04) * 4, 0, 0.55));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  const baseColors = colors.slice();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const detail = detailTexture(body, high ? 512 : 256);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, bumpMap: detail, bumpScale: high ? 1.6 : 1, roughness: 0.97, metalness: 0 });
  const ground = new THREE.Mesh(geo, material);
  ground.receiveShadow = true;
  ground.name = 'ground';

  const group = new THREE.Group();
  group.add(ground);
  const { rocks, rockMat, colliders } = scatterRocks({ body, heightfield, layout, high });
  group.add(rocks);

  let disposed = false;
  if (site) {
    sampleTrek(body, site, rMax).then((trek) => {
      if (!trek || disposed) return;
      const attr = geo.attributes.color;
      for (let i = 0; i < pos.count; i += 1) {
        const u = (pos.getX(i) + rMax) / (2 * rMax);
        const v = (pos.getZ(i) + rMax) / (2 * rMax);
        const k = clamp(1 + (trek.ratio(u, v) - 1) * 0.45, 0.7, 1.3);
        attr.setXYZ(i, baseColors[i * 3] * k, baseColors[i * 3 + 1] * k, baseColors[i * 3 + 2] * k);
      }
      attr.needsUpdate = true;
    });
  }

  return {
    group,
    ground,
    rockColliders: colliders,
    dispose() {
      disposed = true;
      geo.dispose();
      material.dispose();
      detail.dispose();
      rocks.geometry.dispose();
      rockMat.dispose();
      rocks.dispose();
    },
  };
}
