// Small math/colour helpers shared by the 3D scenes. No three.js imports here so outpostModel stays dependency-free.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const DEG = Math.PI / 180;

/* ---- globe drag (site picker) ---- */
export const DRAG_SLOP_PX = 4; // a press that moves less than this is a tap on a pin
export const SPIN_PER_PX = 0.008; // rad of globe spin per px dragged sideways
export const TILT_PER_PX = 0.006; // rad of view tilt per px dragged up or down

/**
 * One pointer move of a globe drag. Returns the next drag state (a new object once the press has become a drag)
 * and how far to spin and tilt. Until the pointer leaves the slop the anchor stays where the press began.
 * @param {{ x: number, y: number, moved: boolean, id: number }} drag
 * @param {{ x: number, y: number }} point
 * @returns {{ drag: { x: number, y: number, moved: boolean, id: number }, dSpin: number, dLat: number }}
 */
export function advanceDrag(drag, point) {
  const dx = point.x - drag.x;
  const dy = point.y - drag.y;
  const moved = drag.moved || Math.abs(dx) > DRAG_SLOP_PX || Math.abs(dy) > DRAG_SLOP_PX;
  if (!moved) return { drag, dSpin: 0, dLat: 0 };
  return { drag: { ...drag, x: point.x, y: point.y, moved: true }, dSpin: dx * SPIN_PER_PX, dLat: dy * TILT_PER_PX };
}

/** True when a mouse move arrives with no button held: the release happened where the canvas could not hear it. */
export const pointerReleased = (ev) => ev.pointerType === 'mouse' && ev.buttons === 0;

/** Deterministic 0–1 hash of two numbers (for rock scatter, stars). */
export function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Smooth value noise in [0,1]. */
export function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Fractal noise, 4 octaves, roughly in [0,1]. */
export function fbm(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x * f, y * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
}

/** Mix two [r,g,b] (0–1) colours. */
export const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** True when the browser can give us a WebGL context (cheap probe, cached). */
let webglProbe;
export function webglAvailable() {
  if (webglProbe !== undefined) return webglProbe;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    webglProbe = !!gl;
    const lose = gl?.getExtension?.('WEBGL_lose_context');
    lose?.loseContext?.();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}

/** Palette shared with the HTML UI (mirrors src/styles/tokens.css). `accent` is the hardware orange on the meshes. */
export const UI = {
  bg: '#03070e',
  panel: '#060b14',
  text: '#e8f3fb',
  muted: '#93a9bc',
  accent: '#f4874b',
  pin: '#8bdcff',
  good: '#3ddbb0',
  warn: '#fbbf24',
  danger: '#ff7a7a',
};
