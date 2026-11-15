// Pictures for the Cosminova sky picker's system view: the star glowing in its real colour, and each landable
// world drawn as a globe in our own colours (src/data/worldPalette.js), painted from its facts: rock and ground
// colour, ice caps that grow with waterIce, liquid seas (water, methane or lava), and an air glow when it has air.
// Nothing here is a photo or a downloaded texture. No telescope can see these planets' surfaces yet, so every
// picture carries a caption saying it is drawn by the game from NASA numbers.
import { h } from '../dom.js';
import { starTint, mix } from '../../data/worldPalette.js';
import { nameHash } from '../../data/worldModel.js';

export const PORTRAIT_CAPTION = 'Game drawing from NASA numbers, not a photo.';
const SOL_CAPTION = 'Game drawing in the colours NASA saw, not a photo.';

const PLANET_PX = 112;
const SYSTEM_W = 640;
const SYSTEM_H = 140;
const STAR_X = 40;
const NOISE_CELLS = 9;
const ICE_CAP_MAX = 0.45; // fraction of the globe's height a fully icy world's caps cover
const LIGHT = [-0.55, -0.35, 0.76]; // light from the upper left, toward the viewer
const THIN_AIR_PA = 1000;
const CLOUD_DECK_PA = 5e6; // above this the ground is hidden under cloud (Venus)

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const css = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** A deterministic random function seeded by a name (same world, same picture). */
export function seeded(name) {
  let s = nameHash(name) >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Smooth value noise on a grid, in 0..1. Exported for tests. */
export function noiseField(seedName, cells = NOISE_CELLS) {
  const rand = seeded(seedName);
  const grid = Array.from({ length: (cells + 1) * (cells + 1) }, rand);
  const at = (x, y) => grid[y * (cells + 1) + x];
  return (u, v) => {
    const x = clamp01(u) * cells;
    const y = clamp01(v) * cells;
    const x0 = Math.min(cells - 1, Math.floor(x));
    const y0 = Math.min(cells - 1, Math.floor(y));
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    return lerp(lerp(at(x0, y0), at(x0 + 1, y0), tx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
  };
}

/** What a world's globe shows, worked out from its facts and palette. Pure, exported for tests. */
export function portraitLook(world) {
  const f = world.facts ?? {};
  const p = world.palette ?? {};
  const pressure = f.pressurePa?.v ?? 0;
  // The palette carries a liquid colour only when the world has open liquid on top (Titan's methane, lava, seas).
  const liquid = p.liquid ?? (f.liquidWater?.v === 'surface' ? '#2f6f8f' : null);
  return {
    ground: p.ground ?? '#6b5a4e',
    rock: p.rock ?? '#3f3530',
    ice: p.ice ?? '#d8e4ee',
    iceCap: clamp01(f.waterIce?.v ?? 0) * ICE_CAP_MAX,
    liquid,
    lava: f.ground?.v === 'lava' || (f.hazards?.v ?? []).includes('volcanism'),
    glow: pressure > THIN_AIR_PA ? (p.haze ?? p.sky ?? null) : null,
    thickClouds: pressure > CLOUD_DECK_PA,
  };
}

function surfaceColour(look, cols, n, fine, polar) {
  if (look.thickClouds && cols.cloud) return cols.cloud.map((c) => lerp(c, 255, 0.15 + 0.2 * fine));
  if (polar > 1 - look.iceCap * 2 + (n - 0.5) * 0.15) return cols.ice;
  if (look.lava && fine > 0.86) return [255, 120, 40];
  if (cols.liquid && n < 0.38) return cols.liquid;
  return cols.rock.map((c, i) => lerp(c, cols.ground[i], smooth(clamp01((n - 0.25) / 0.5))));
}

function paintGlobe(ctx, cx, cy, r, world) {
  const look = portraitLook(world);
  const noise = noiseField(world.id);
  const detail = noiseField(`${world.id}:detail`, NOISE_CELLS * 3);
  const cols = {
    ground: rgb(look.ground), rock: rgb(look.rock), ice: rgb(look.ice),
    liquid: look.liquid ? rgb(look.liquid) : null, cloud: look.glow ? rgb(look.glow) : null,
  };
  const size = 2 * r;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x - r + 0.5) / r;
      const ny = (y - r + 0.5) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      // Map the visible hemisphere to texture space so features curve with the globe.
      const u = 0.5 + Math.atan2(nx, nz) / Math.PI;
      const v = 0.5 + Math.asin(ny) / Math.PI;
      const fine = detail(u, v);
      const c = surfaceColour(look, cols, 0.65 * noise(u, v) + 0.35 * fine, fine, Math.abs(ny));
      const shade = 0.12 + 0.88 * clamp01(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const o = 4 * (y * size + x);
      img.data[o] = c[0] * shade;
      img.data[o + 1] = c[1] * shade;
      img.data[o + 2] = c[2] * shade;
      img.data[o + 3] = d2 > 0.985 ? 200 : 255; // soft edge
    }
  }
  ctx.putImageData(img, cx - r, cy - r);
  if (cols.cloud && !look.thickClouds) {
    const rim = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.12);
    rim.addColorStop(0, css(cols.cloud, 0));
    rim.addColorStop(0.45, css(cols.cloud, 0.55));
    rim.addColorStop(1, css(cols.cloud, 0));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

const canvas = (w, h2, label) => {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h2;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  return el;
};

/** A globe picture for one world card. */
export function planetPortrait(world) {
  const el = canvas(PLANET_PX, PLANET_PX, `A drawing of ${world.name}, made by the game from NASA numbers.`);
  const ctx = el.getContext?.('2d');
  if (ctx) paintGlobe(ctx, PLANET_PX / 2, PLANET_PX / 2, Math.floor(PLANET_PX / 2) - 8, world);
  return h('figure', { class: 'wp-portrait' }, el,
    h('figcaption', { class: 'wp-portrait-caption' }, world.system === 'sol' ? SOL_CAPTION : PORTRAIT_CAPTION));
}

/**
 * Orbit layout for the system strip: the star on the left, worlds placed by orbit size (log scale so close-in
 * planets do not pile up) and drawn bigger for bigger radius. Pure, exported for tests.
 */
export function systemLayout(worlds, width = SYSTEM_W) {
  const orbits = worlds.map((w) => w.facts?.orbitAu?.v ?? 1);
  const lo = Math.log(Math.min(...orbits));
  const hi = Math.log(Math.max(...orbits));
  const left = 150;
  const right = width - 40;
  return worlds.map((w, i) => {
    const t = hi > lo ? (Math.log(orbits[i]) - lo) / (hi - lo) : 0.5;
    const radius = Math.min(1.6, w.facts?.radiusEarth?.v ?? 1);
    return { id: w.id, name: w.name, x: Math.round(lerp(left, right, t)), r: Math.round(8 + (10 * radius) / 1.6) };
  });
}

/** The star and its landable worlds side by side, for an exoplanet system. */
export function systemPortrait(target, worlds) {
  const el = canvas(SYSTEM_W, SYSTEM_H, `A drawing of ${target.name} and its rocky planets, made by the game from NASA numbers.`);
  const ctx = el.getContext?.('2d');
  if (ctx && worlds.length) {
    const cy = SYSTEM_H / 2;
    const tint = rgb(starTint(target.teffK));
    const glow = ctx.createRadialGradient(STAR_X, cy, 6, STAR_X, cy, 110);
    glow.addColorStop(0, css(rgb(mix(starTint(target.teffK), '#ffffff', 0.5))));
    glow.addColorStop(0.25, css(tint, 0.9));
    glow.addColorStop(1, css(tint, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SYSTEM_W, SYSTEM_H);
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const spot of systemLayout(worlds)) {
      ctx.strokeStyle = 'rgba(180,200,220,0.18)';
      ctx.beginPath();
      ctx.arc(STAR_X, cy, spot.x - STAR_X, -0.35, 0.35);
      ctx.stroke();
      paintGlobe(ctx, spot.x, cy, spot.r, worlds.find((w) => w.id === spot.id));
      ctx.fillStyle = '#cfe3f2';
      ctx.fillText(spot.name.replace(target.name, '').trim() || spot.name, spot.x, cy + spot.r + 16);
    }
  }
  return h('figure', { class: 'wp-system-portrait' }, el,
    h('figcaption', { class: 'wp-portrait-caption' }, `${target.name} in its real colour. ${PORTRAIT_CAPTION}`));
}
