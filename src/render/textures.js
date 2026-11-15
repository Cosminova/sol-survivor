// Deterministic texture generators for the world looks. Pure: each returns { width, height, data } with RGBA
// bytes and never touches the DOM, so the same seed always gives the same bytes. Results are cached per key
// (world + site + kind) so a mission pays for each texture once.
import { makeRng, clamp, smoothstep } from '../world3d/rng.js';
import { hexToRgb, mixRgb } from './color.js';

export const MAX_TEXTURE_SIZE = 1024;
const DETAIL_BASE = 226; // mid grey of the tiling detail map: it multiplies the ground colour, so it stays light
const PEBBLES_AT_FULL_DENSITY = 1400;

const cache = new Map();

/** Returns the texture stored under key, generating it on first use. */
export function cachedTexture(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}
export const clearTextureCache = () => cache.clear();

const safeSize = (size) => clamp(Math.round(size), 8, MAX_TEXTURE_SIZE);

function hash2i(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const wrap = (i, period) => ((i % period) + period) % period;

/** Value noise that repeats every `period` cells, so textures built from it tile without seams. -1..1 */
export function tileNoise(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const x0 = wrap(ix, period); const x1 = wrap(ix + 1, period);
  const y0 = wrap(iy, period); const y1 = wrap(iy + 1, period);
  const a = hash2i(x0, y0, seed); const b = hash2i(x1, y0, seed);
  const c = hash2i(x0, y1, seed); const d = hash2i(x1, y1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

function tileFbm(x, y, period, seed, octaves) {
  let sum = 0; let amp = 0.5; let norm = 0; let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * tileNoise(x * f, y * f, period * f, seed + o * 101);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

/** Distance to the nearest cell edge of a tiling crack network, in cells. */
function tileCracks(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let d1 = 9; let d2 = 9;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = ix + dx + hash2i(wrap(ix + dx, period), wrap(iy + dy, period), seed);
      const cy = iy + dy + hash2i(wrap(ix + dx, period), wrap(iy + dy, period), seed + 57);
      const d = Math.hypot(x - cx, y - cy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  return d2 - d1;
}

function blank(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function setGrey(data, i, v) {
  data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
}

function stampPebble(data, size, cx, cy, r, darkness) {
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
    for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
      const dx = (x - cx) / r;
      const dy = (y - cy) / (r * 0.75);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const i = (wrap(y, size) * size + wrap(x, size)) * 4;
      const lit = dx + dy < -0.5 ? 26 : 0; // a lit edge up and to the left
      const v = clamp(data[i] * (1 - darkness * (1 - d * 0.5)) + lit, 0, 255);
      setGrey(data, i, v);
    }
  }
}

const DETAIL_STYLE = {
  craters: { grain: 22, soft: 26, cracks: 0, ripples: 0 },
  plains: { grain: 18, soft: 24, cracks: 0, ripples: 10 },
  dunes: { grain: 9, soft: 12, cracks: 0, ripples: 22 },
  'ice-chaos': { grain: 6, soft: 14, cracks: 12, ripples: 0 },
  'lava-flows': { grain: 30, soft: 34, cracks: 9, ripples: 0 },
  'fractured-basalt': { grain: 26, soft: 26, cracks: 20, ripples: 0 },
};

/**
 * Tiling grey detail map: grain, pebbles and style marks (wind ripples, cracks). It multiplies the ground
 * colour up close, the way the Moon and Mars detail maps do.
 */
export function generateDetailTexture(look, size = 512) {
  const n = safeSize(size);
  const tex = blank(n, n);
  const style = DETAIL_STYLE[look.reliefStyle] ?? DETAIL_STYLE.craters;
  const rng = makeRng((look.seed ^ 0x7e57) >>> 0);
  const seed = look.seed % 7919;
  const cells = 16; // noise cells across the tile
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const u = (x / n) * cells;
      const v = (y / n) * cells;
      let g = DETAIL_BASE + tileFbm(u, v, cells, seed, 3) * style.soft + tileFbm(u * 4, v * 4, cells * 4, seed + 9, 2) * 14 + (rng.next() - 0.5) * style.grain;
      if (style.ripples) g += Math.sin((x / n) * Math.PI * 2 * 22 + tileNoise(u / 2, v / 2, cells / 2, seed + 3) * 3) * style.ripples * 0.5;
      if (style.cracks) g -= (1 - smoothstep(0, 0.07, tileCracks(u / 4, v / 4, cells / 4, seed + 5))) * style.cracks;
      setGrey(tex.data, (y * n + x) * 4, clamp(g, 0, 255));
    }
  }
  const pebbles = Math.round(PEBBLES_AT_FULL_DENSITY * look.rockDensity * (n / 512) ** 2);
  for (let i = 0; i < pebbles; i += 1) {
    stampPebble(tex.data, n, rng.next() * n, rng.next() * n, (0.8 + rng.next() ** 3 * 4.5) * (n / 512), 0.2 + rng.next() * 0.3);
  }
  return tex;
}

/**
 * Colour map of the ground around a base, seen from above (the outpost backdrop). heightAt gives the height
 * the scene actually uses; colours come from the same surface as the walk mode.
 */
export function generateGroundMap(look, surface, { size = 512, extentM = 260, heightAt = surface.heightAt } = {}) {
  const n = safeSize(size);
  const tex = blank(n, n);
  const grid = Math.max(16, Math.round(n / 4));
  const step = extentM / grid;
  const heights = new Float32Array((grid + 1) * (grid + 1));
  for (let j = 0; j <= grid; j += 1) {
    for (let i = 0; i <= grid; i += 1) heights[j * (grid + 1) + i] = heightAt(i * step - extentM / 2, j * step - extentM / 2);
  }
  const at = (i, j) => heights[clamp(j, 0, grid) * (grid + 1) + clamp(i, 0, grid)];
  const detail = cachedTexture(`detail:${look.worldId}:${look.seed}:256`, () => generateDetailTexture(look, 256));
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const gx = (x / (n - 1)) * grid;
      const gy = (y / (n - 1)) * grid;
      const i = Math.min(grid - 1, Math.floor(gx));
      const j = Math.min(grid - 1, Math.floor(gy));
      const fx = gx - i;
      const fy = gy - j;
      const h = (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
      const dx = (at(i + 1, j) - at(i, j)) / step;
      const dz = (at(i, j + 1) - at(i, j)) / step;
      const slope = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz);
      const c = surface.colorAt((x / (n - 1) - 0.5) * extentM, (y / (n - 1) - 0.5) * extentM, h, slope);
      const speckle = detail.data[((y * 3) % 256 * 256 + ((x * 3) % 256)) * 4] / DETAIL_BASE;
      const o = (y * n + x) * 4;
      tex.data[o] = c[0] * speckle * 255; tex.data[o + 1] = c[1] * speckle * 255; tex.data[o + 2] = c[2] * speckle * 255; tex.data[o + 3] = 255;
    }
  }
  return tex;
}

/** Banded cloud tops of a giant planet (equirectangular, wraps east-west). Our own bands, not a photograph. */
export function generateGasGiantTexture(parent, size = 256, seed = 1) {
  const w = safeSize(size);
  const h = Math.max(8, w >> 1);
  const tex = blank(w, h);
  const bands = parent.bands.map(hexToRgb);
  const cells = 8;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const u = (x / w) * cells;
      const lat = y / h;
      const swirl = tileNoise(u, lat * 14, cells, seed) * 0.035 + tileNoise(u * 4, lat * 40, cells * 4, seed + 3) * 0.012;
      const pos = clamp(lat + swirl, 0, 0.999) * bands.length * 2.2;
      const a = bands[Math.floor(pos) % bands.length];
      const b = bands[(Math.floor(pos) + 1) % bands.length];
      const c = mixRgb(a, b, smoothstep(0.25, 0.75, pos - Math.floor(pos)));
      const pole = 1 - 0.35 * smoothstep(0.3, 0.5, Math.abs(lat - 0.5));
      const o = (y * w + x) * 4;
      tex.data[o] = c[0] * pole * 255; tex.data[o + 1] = c[1] * pole * 255; tex.data[o + 2] = c[2] * pole * 255; tex.data[o + 3] = 255;
    }
  }
  return tex;
}

/** Ring brightness from the inner edge (x = 0) to the outer edge, with gaps, as a 1-pixel-tall strip. */
export function generateRingTexture(size = 256, seed = 1) {
  const w = safeSize(size);
  const tex = blank(w, 1);
  for (let x = 0; x < w; x += 1) {
    const t = x / (w - 1);
    const gap = Math.abs(t - 0.62) < 0.035 ? 0.08 : 1; // the dark division between the two bright rings
    const density = (0.55 + tileNoise(t * 24, 0.5, 64, seed) * 0.3) * gap * smoothstep(0, 0.08, t) * (1 - smoothstep(0.92, 1, t));
    tex.data.set([226, 208, 168, clamp(density, 0, 1) * 235], x * 4);
  }
  return tex;
}

/** Tiling molten surface: dark cooling crust split by bright cracks. */
export function generateLavaTexture(size = 256, seed = 1) {
  const n = safeSize(size);
  const tex = blank(n, n);
  const cells = 6;
  const hot = [1, 0.82, 0.3];
  const warm = [1, 0.36, 0.06];
  const crust = [0.2, 0.05, 0.02];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const u = (x / n) * cells;
      const v = (y / n) * cells;
      const wobble = tileNoise(u * 2, v * 2, cells * 2, seed + 4) * 0.12;
      const crack = 1 - smoothstep(0.02, 0.3, tileCracks(u + wobble, v + wobble, cells, seed));
      const churn = tileFbm(u, v, cells, seed + 8, 3) * 0.5 + 0.5;
      const c = mixRgb(mixRgb(crust, warm, churn * 0.7), hot, crack);
      tex.data.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], (y * n + x) * 4);
    }
  }
  return tex;
}
