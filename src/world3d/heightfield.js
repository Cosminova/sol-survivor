// Pure terrain height. Large-scale landform comes from NASA laser altimetry (MOLA / LOLA) when a
// patch is supplied; walkable-scale detail (small craters, ripples, bumps) is procedural on top and
// fades out with distance. Building pads are flattened. True planetary curvature drops the horizon.
import { makeRng, fbm2, smoothstep, lerp } from './rng.js';

const PROFILE = {
  mars: { amp: 1.4, freq: 1 / 42, ripple: 0.08, craters: 14, craterDepth: [0.4, 1.6], craterR: [3, 16] },
  moon: { amp: 0.9, freq: 1 / 36, ripple: 0, craters: 30, craterDepth: [0.4, 2.2], craterR: [2, 18] },
};

export const PLANET_RADIUS = { mars: 3389500, moon: 1737400 };
export const DETAIL_FADE = [260, 700]; // metres: procedural detail fades out between these radii

function craterList(seed, profile, pads) {
  const rng = makeRng(seed ^ 0x51ed270b);
  const list = [];
  for (let i = 0; list.length < profile.craters && i < profile.craters * 6; i += 1) {
    const r = rng.range(...profile.craterR) * (rng.chance(0.25) ? 1.5 : 1);
    const ang = rng.range(-Math.PI, Math.PI);
    const dist = rng.range(18, 240);
    const x = Math.sin(ang) * dist;
    const z = Math.cos(ang) * dist;
    if (!pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r * 1.3)) list.push({ x, z, r, depth: rng.range(...profile.craterDepth) * (r / 14) });
  }
  return list;
}

function craterHeight(c, x, z) {
  const d = Math.hypot(x - c.x, z - c.z) / c.r;
  if (d > 1.6) return 0;
  const bowl = d < 1 ? -c.depth * (1 - d * d) : 0;
  return bowl + c.depth * 0.35 * Math.exp(-(((d - 1) / 0.22) ** 2));
}

// dem: optional { sample(x, z) } in metres relative to the base (see lidar.js).
export function makeHeightfield({ seed = 1, body = 'mars', pads = [], dem = null } = {}) {
  const profile = PROFILE[body] ?? PROFILE.mars;
  const craters = craterList(seed, profile, pads);
  const nSeed = seed % 9973;
  const R = PLANET_RADIUS[body] ?? PLANET_RADIUS.mars;
  const landform = dem ? (x, z) => dem.sample(x, z) : () => 0;
  const padBase = pads.map((p) => landform(p.x, p.z));

  function detail(x, z) {
    let h = fbm2(x * profile.freq, z * profile.freq, nSeed, 5) * profile.amp * 2;
    h += fbm2(x * profile.freq * 6, z * profile.freq * 6, nSeed + 7, 2) * profile.amp * 0.18;
    if (profile.ripple > 0) h += Math.sin(x * 0.35 + z * 0.14 + fbm2(x * 0.05, z * 0.05, nSeed + 3, 2) * 4) * profile.ripple;
    for (const c of craters) h += craterHeight(c, x, z);
    return h;
  }

  const detail0 = detail(0, 0);

  function heightAt(x, z) {
    const dist = Math.hypot(x, z);
    let base = landform(x, z);
    let fine = dist < DETAIL_FADE[1] ? (detail(x, z) - detail0) * (1 - smoothstep(DETAIL_FADE[0], DETAIL_FADE[1], dist)) : 0;
    for (let i = 0; i < pads.length; i += 1) {
      const p = pads[i];
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 4) {
        const w = smoothstep(p.r, p.r + 4, d);
        base = lerp(padBase[i], base, w);
        fine *= w;
      }
    }
    return base + fine - (dist * dist) / (2 * R);
  }

  function craterShade(x, z) {
    let s = 0;
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1) s = Math.max(s, 1 - d);
    }
    return s;
  }

  return { heightAt, craterShade, craters, hasDem: Boolean(dem), extent: dem?.halfExtent ?? 600 };
}
