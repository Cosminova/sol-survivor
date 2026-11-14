// Pure mini-game mechanics and scoring. Every function returns quality in 0..1 or a new state.
import { clamp, shuffled } from './rng.js';

// ---- Solar panel wipe ----
export const wipeQuality = (coverage) => clamp((coverage - 0.3) / 0.6, 0, 1);

// ---- Regolith shovel timing ----
// Needle bounces 0..1..0; ease > 1 slows it down.
export function needlePos(time, speed = 0.9) {
  const p = (time * speed) % 2;
  return p < 1 ? p : 2 - p;
}

export function shovelZone(ease = 1, assist = false) {
  const half = clamp(0.09 * ease * (assist ? 1.6 : 1), 0.06, 0.28);
  return { centre: 0.5, half };
}

export function shovelHit(pos, zone) {
  const d = Math.abs(pos - zone.centre);
  if (d <= zone.half) return 1;
  if (d <= zone.half * 2.2) return 0.5;
  return 0;
}

export const average = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);

// ---- Greenhouse watering ----
export function waterBand(index, ease = 1) {
  const centres = [0.55, 0.65, 0.5];
  const half = clamp(0.08 * ease, 0.06, 0.18);
  const c = centres[index % centres.length];
  return { lo: c - half, hi: c + half };
}

export function waterScore(level, band) {
  if (level >= band.lo && level <= band.hi) return 1;
  if (level < band.lo) return clamp((level / band.lo) * 0.7, 0, 0.7);
  return clamp(0.6 - ((level - band.hi) / (1 - band.hi + 1e-6)) * 0.6, 0, 0.6); // overwatering drowns roots
}

export function harvestScore(picked, ripe) {
  const good = picked.filter((i) => ripe.includes(i)).length;
  const bad = picked.length - good;
  return ripe.length ? clamp((good - bad * 0.5) / ripe.length, 0, 1) : 1;
}

// ---- Spectrometer scan ----
export function scanSignal(reticle, hotspot, radius) {
  const d = Math.hypot(reticle.x - hotspot.x, reticle.y - hotspot.y);
  return clamp(1 - d / (radius * 4), 0, 1);
}

export const scanLocked = (reticle, hotspot, radius) => Math.hypot(reticle.x - hotspot.x, reticle.y - hotspot.y) <= radius;

export function scanRadius(role, ease = 1) {
  return clamp(0.07 * ease * (role === 'geologist' ? 1.5 : 1), 0.05, 0.2);
}

export const timedQuality = (seconds, limit, floor = 0.3) => clamp(1 - Math.max(0, seconds - limit * 0.25) / (limit * 1.1), floor, 1);

// ---- Wire repair ----
export const WIRE_SYMBOLS = [
  { id: 'red', color: '#ff5d5d', shape: '●' },
  { id: 'blue', color: '#4da3ff', shape: '■' },
  { id: 'yellow', color: '#ffd23f', shape: '▲' },
  { id: 'green', color: '#3ddc84', shape: '◆' },
];

export function makeWirePuzzle(rng, n = 4) {
  const ids = WIRE_SYMBOLS.slice(0, n).map((w) => w.id);
  const left = shuffled(ids, rng);
  let right = shuffled(ids, rng);
  if (right.every((id, i) => id === left[i])) right = [...right.slice(1), right[0]];
  return { left, right };
}

export const wireQuality = (mistakes, seconds, limit) => clamp(1 - mistakes * 0.2 - (Math.max(0, seconds - 6) / limit) * 0.4, 0.2, 1);

// ---- Ice drill ----
export const DRILL = { target: 1, rate: 0.16, heatRate: 0.42, coolRate: 0.55, jamLoss: 0.15 };

export function drillStep(s, { drilling, dt, ease = 1 }) {
  if (s.jamTime > 0) return { ...s, jamTime: Math.max(0, s.jamTime - dt), heat: Math.max(0, s.heat - DRILL.coolRate * dt) };
  if (!drilling) return { ...s, heat: Math.max(0, s.heat - DRILL.coolRate * dt) };
  const heat = s.heat + (DRILL.heatRate / ease) * dt;
  if (heat >= 1) return { ...s, heat: 1, depth: Math.max(0, s.depth - DRILL.jamLoss), overheats: s.overheats + 1, jamTime: 1.2 };
  return { ...s, heat, depth: Math.min(DRILL.target, s.depth + DRILL.rate * dt) };
}

export const drillStart = () => ({ depth: 0, heat: 0, overheats: 0, jamTime: 0 });
export const drillQuality = (s, seconds, limit) => clamp((s.depth / DRILL.target) * (1 - s.overheats * 0.2) * timedQuality(seconds, limit, 0.6), 0, 1);

// Skipping always gives a fair middle score so nobody is blocked by a mini-game.
export const SKIP_QUALITY = 0.5;
