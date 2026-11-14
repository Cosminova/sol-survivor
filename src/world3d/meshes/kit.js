// Shared low-poly building blocks and cached materials for outpost props.
import * as THREE from 'three';

const cache = new Map();

// Cached MeshStandardMaterial by key; disposed together via disposeKit().
export function mat(key, params) {
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial(params));
  return cache.get(key);
}

export const M = {
  white: () => mat('white', { color: '#e9e6e1', roughness: 0.55, metalness: 0.05 }),
  panel: () => mat('panel', { color: '#c9c6c0', roughness: 0.6, metalness: 0.15 }),
  grey: () => mat('grey', { color: '#7d7f84', roughness: 0.5, metalness: 0.6 }),
  dark: () => mat('dark', { color: '#2b2d33', roughness: 0.6, metalness: 0.4 }),
  metal: () => mat('metal', { color: '#b8bcc4', roughness: 0.3, metalness: 0.9 }),
  gold: () => mat('gold', { color: '#d9a62e', roughness: 0.28, metalness: 1, envMapIntensity: 1.2 }),
  foil: () => mat('foil', { color: '#c8902a', roughness: 0.35, metalness: 0.95 }),
  orange: () => mat('orange', { color: '#f07a2a', roughness: 0.5, metalness: 0.1 }),
  red: () => mat('red', { color: '#d63c3c', roughness: 0.5, metalness: 0.1 }),
  glass: () => mat('glass', { color: '#9fd3ff', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false }),
  window: () => mat('window', { color: '#1c2a3a', roughness: 0.1, metalness: 0.5, emissive: '#ffcf8a', emissiveIntensity: 0 }),
  solarCell: () => mat('solarCell', { color: '#1d3a7a', roughness: 0.25, metalness: 0.55, envMapIntensity: 1.4 }),
  regolithMars: () => mat('regMars', { color: '#9a5634', roughness: 1, metalness: 0, flatShading: true }),
  regolithMoon: () => mat('regMoon', { color: '#77746f', roughness: 1, metalness: 0, flatShading: true }),
  plant: () => mat('plant', { color: '#3fae4f', roughness: 0.7, emissive: '#0d3010', emissiveIntensity: 0.4 }),
  ledGreen: () => mat('ledGreen', { color: '#163', emissive: '#3dff7a', emissiveIntensity: 1.6 }),
  ledRed: () => mat('ledRed', { color: '#400', emissive: '#ff3b30', emissiveIntensity: 2 }),
  glowPink: () => mat('glowPink', { color: '#f6c', emissive: '#ff4fd8', emissiveIntensity: 1.4 }),
  glowOrange: () => mat('glowOrange', { color: '#f84', emissive: '#ff7a1a', emissiveIntensity: 1.2 }),
};

export function regolith(body) {
  return body === 'moon' ? M.regolithMoon() : M.regolithMars();
}

export function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export const box = (w, h, d, material, opts) => mesh(new THREE.BoxGeometry(w, h, d), material, opts);
export const cyl = (rt, rb, h, material, opts, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, opts);
export const sphere = (r, material, opts, w = 20, h = 14) => mesh(new THREE.SphereGeometry(r, w, h), material, opts);

// Canvas text/emoji texture for signs, name tags and labels.
export function textTexture(text, { w = 256, h = 64, bg = '#ffffff', fg = '#111111', font = 'bold 34px system-ui, sans-serif' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function signMesh(text, { w = 1.2, h = 0.4, bg = '#ffd23f', fg = '#111' } = {}) {
  const tex = textTexture(text, { w: 512, h: Math.round(512 * (h / w)), bg, fg, font: `bold ${Math.round(150 * (h / w))}px system-ui, sans-serif` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

// Blinking red warning beacon reused by broken / damaged stations.
export function beacon() {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.05, 0.6, M.grey(), { y: 0.3 }));
  const bulb = sphere(0.12, M.ledRed(), { y: 0.66, shadow: false }, 10, 8);
  g.add(bulb);
  g.userData.bulb = bulb;
  g.visible = false;
  return g;
}

export function disposeKit() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}

// Disposes every geometry, material and texture under root (skips cached kit materials).
export function disposeTree(root) {
  const shared = new Set(cache.values());
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (shared.has(m)) continue;
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}
