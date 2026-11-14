// Small math/color helpers shared by the outpost scene renderer.
import { rngFromState, hashSeed } from '../../engine/rng.js';

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const hexToRgb = (color) => {
  if (color.startsWith('rgb')) return color.slice(color.indexOf('(') + 1, -1).split(',').map(Number);
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = clamp(t);
  return `rgb(${Math.round(lerp(r1, r2, k))},${Math.round(lerp(g1, g2, k))},${Math.round(lerp(b1, b2, k))})`;
}

export function mix3(a, b, c, t) {
  return t < 0.5 ? mix(a, b, t * 2) : mix(b, c, (t - 0.5) * 2);
}

export const seeded = (seed) => rngFromState(hashSeed(String(seed)));

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Converts a depth (0 = horizon, 1 = foreground) into screen y and a size scale.
export function project(depth, W, H, horizon) {
  const y = horizon + (H - horizon) * (0.12 + 0.82 * depth);
  const scale = (0.5 + 0.8 * depth) * (H / 360);
  return { y, scale };
}
