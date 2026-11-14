// Pure procedural terrain height: rolling noise + craters, flattened under building pads.
// Shared by the terrain mesh, the astronaut's feet, the camera and every prop placement.
import { makeRng, fbm2, smoothstep, lerp } from './rng.js';

const PROFILE = {
  mars: { amp: 1.6, freq: 1 / 42, ripple: 0.12, craters: 14, craterDepth: [0.6, 2.2], craterR: [4, 22] },
  moon: { amp: 1.1, freq: 1 / 36, ripple: 0.03, craters: 30, craterDepth: [0.5, 3], craterR: [2.5, 26] },
};

export const HORIZON_RADIUS = 1800; // fake planetary curvature hides the terrain edge

function craterList(seed, profile, pads) {
  const rng = makeRng(seed ^ 0x51ed270b);
  const list = [];
  for (let i = 0; list.length < profile.craters && i < profile.craters * 6; i += 1) {
    const r = rng.range(...profile.craterR) * (rng.chance(0.25) ? 1.6 : 1);
    const ang = rng.range(-Math.PI, Math.PI);
    const dist = rng.range(18, 240);
    const x = Math.sin(ang) * dist;
    const z = Math.cos(ang) * dist;
    const overlapsPad = pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r * 1.3);
    if (!overlapsPad) list.push({ x, z, r, depth: rng.range(...profile.craterDepth) * (r / 14) });
  }
  return list;
}

function craterHeight(c, x, z) {
  const d = Math.hypot(x - c.x, z - c.z) / c.r;
  if (d > 1.6) return 0;
  const bowl = d < 1 ? -c.depth * (1 - d * d) : 0;
  const rim = c.depth * 0.35 * Math.exp(-(((d - 1) / 0.22) ** 2));
  return bowl + rim;
}

export function makeHeightfield({ seed = 1, body = 'mars', pads = [] } = {}) {
  const profile = PROFILE[body] ?? PROFILE.mars;
  const craters = craterList(seed, profile, pads);
  const nSeed = seed % 9973;

  function raw(x, z) {
    let h = fbm2(x * profile.freq, z * profile.freq, nSeed, 5) * profile.amp * 2;
    h += fbm2(x * profile.freq * 6, z * profile.freq * 6, nSeed + 7, 2) * profile.amp * 0.18;
    if (profile.ripple > 0) {
      // Wind ripples on Mars run across the prevailing wind.
      h += Math.sin(x * 0.9 + z * 0.35 + fbm2(x * 0.05, z * 0.05, nSeed + 3, 2) * 4) * profile.ripple * 0.5;
    }
    for (const c of craters) h += craterHeight(c, x, z);
    return h;
  }

  const base = raw(0, 0);

  function heightAt(x, z) {
    let h = raw(x, z) - base;
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 4) h = lerp(0, h, smoothstep(p.r, p.r + 4, d));
    }
    const dist = Math.hypot(x, z);
    return h - (dist * dist) / (2 * HORIZON_RADIUS);
  }

  // How far inside a crater bowl a point is (0..1); used for darker crater floors.
  function craterShade(x, z) {
    let s = 0;
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1) s = Math.max(s, 1 - d);
    }
    return s;
  }

  return { heightAt, craterShade, craters };
}
