// Procedural ground for worlds without lidar: a height field and a ground colour, both pure functions of (x, z)
// seeded by world + site. Same interface as world3d/heightfield.js so the walk mode can swap it in.
// Styles: craters (airless rock), dunes (Titan), ice-chaos (Europa), lava-flows (Io, lava worlds),
// fractured-basalt (hot rock), plains (worlds with weather).
import { makeRng, fbm2, smoothstep, lerp, clamp } from '../world3d/rng.js';
import { hexToRgb, mixRgb, scaleRgb } from './color.js';

export const DETAIL_FADE = [260, 700]; // metres: walkable-scale detail fades out between these radii
export const SURFACE_EXTENT_M = 3000;
const FAR_START = [150, 900]; // distant landforms grow in between these radii
const WALK_LIMIT_M = 105; // inside this radius lava stays in fenced pools the astronauts cannot wade into
const POOL_SAMPLE_M = 230;
const POOL_MAX_LEVEL = -0.45; // pools always sit below the flat building pads
const SHORE_M = 0.4;
const MAX_LAVA_SINK_M = 4; // safe: near the base the ground is held just above the lava anyway
const NOISE_SPREAD = 0.13; // typical spread of the 0..1 patch noise around 0.5

// Noise level above which ground is icy, chosen so the icy share of the ground is about `coverage`.
const iceThresholdFor = (coverage) => {
  const p = clamp(coverage, 0.005, 0.995);
  return 0.5 + (NOISE_SPREAD * Math.log((1 - p) / p)) / 1.7;
};

function hash2i(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Cracked plates: distance to the nearest plate edge (in cells) and a random value per plate. */
function plates(x, z, size, seed) {
  const px = x / size;
  const pz = z / size;
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  let d1 = 9; let d2 = 9; let id = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = ix + dx + hash2i(ix + dx, iz + dz, seed);
      const cz = iz + dz + hash2i(ix + dx, iz + dz, seed + 57);
      const d = Math.hypot(px - cx, pz - cz);
      if (d < d1) { d2 = d1; d1 = d; id = hash2i(ix + dx, iz + dz, seed + 113); } else if (d < d2) d2 = d;
    }
  }
  return { edge: d2 - d1, id };
}

const ridged = (x, z, seed, octaves = 4) => (1 - Math.abs(fbm2(x, z, seed, octaves))) ** 2;
const terrace = (v, steps) => { const s = v * steps; const f = s - Math.floor(s); return (Math.floor(s) + smoothstep(0.6, 1, f)) / steps; };

function circleList(rng, { count, radius, dist, depth, pads }) {
  const list = [];
  for (let i = 0; list.length < count && i < count * 8; i += 1) {
    const r = rng.range(...radius);
    const a = rng.range(-Math.PI, Math.PI);
    const d = rng.range(...dist);
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d;
    const clear = !pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r * 1.3) && !list.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r);
    if (clear) list.push({ x, z, r, depth: rng.range(...depth) });
  }
  return list;
}

function craterHeight(c, x, z) {
  const d = Math.hypot(x - c.x, z - c.z) / c.r;
  if (d > 1.6) return 0;
  const bowl = d < 1 ? -c.depth * (1 - d * d) : 0;
  return bowl + c.depth * 0.35 * Math.exp(-(((d - 1) / 0.22) ** 2));
}

// Flat-floored pit with a steep wall: lake beds, calderas.
function basinHeight(c, x, z) {
  const d = Math.hypot(x - c.x, z - c.z) / c.r;
  return d >= 1 ? 0 : -c.depth * (1 - smoothstep(0.55, 1, d));
}

function duneWave(x, z, nSeed, wavelength, angle) {
  const u = (x * Math.cos(angle) + z * Math.sin(angle)) / wavelength + fbm2(x / (wavelength * 3), z / (wavelength * 3), nSeed + 5, 2) * 0.9;
  const p = u - Math.floor(u);
  return p < 0.72 ? smoothstep(0, 0.72, p) : 1 - smoothstep(0.72, 1, p); // long windward slope, short slip face
}

// 1 on the sand sea, 0 on the flat gravel between dune fields.
const duneField = (x, z, s) => smoothstep(-0.2, 0.12, fbm2(x / 80 + 0.37, z / 80 + 0.61, s.nSeed + 9, 4));

const STYLES = {
  craters: {
    features: (rng, pads) => ({ craters: circleList(rng, { count: 34, radius: [2, 18], dist: [18, 240], depth: [0.4, 2.2], pads }).map((c) => ({ ...c, depth: c.depth * (c.r / 14) })) }),
    detail: (x, z, s) => fbm2(x / 36, z / 36, s.nSeed, 5) * 1.8 + fbm2(x / 6, z / 6, s.nSeed + 7, 2) * 0.16,
    far: (x, z, s) => fbm2(x / 520, z / 520, s.nSeed + 21, 4) * 60 + ridged(x / 900, z / 900, s.nSeed + 22, 3) * 45,
  },
  plains: {
    features: (rng, pads) => ({ craters: circleList(rng, { count: 6, radius: [5, 16], dist: [30, 240], depth: [0.3, 0.8], pads }) }),
    detail: (x, z, s) => fbm2(x / 48, z / 48, s.nSeed, 4) * 2.2 + Math.sin(x * 0.35 + z * 0.14 + fbm2(x * 0.05, z * 0.05, s.nSeed + 3, 2) * 4) * 0.07,
    far: (x, z, s) => fbm2(x / 700, z / 700, s.nSeed + 21, 4) * 70,
  },
  dunes: {
    features: () => ({ craters: [] }),
    detail: (x, z, s) => {
      const field = duneField(x, z, s); // dunes break into flat gravel between them
      return (duneWave(x, z, s.nSeed, 42, s.angle) - 0.4) * 2.6 * field + Math.sin((x * Math.cos(s.angle) + z * Math.sin(s.angle)) * 1.9) * 0.03;
    },
    far: (x, z, s) => duneWave(x, z, s.nSeed + 30, 420, s.angle) * 38 + fbm2(x / 900, z / 900, s.nSeed + 21, 3) * 25,
  },
  'ice-chaos': {
    features: (rng) => ({
      craters: [],
      lines: Array.from({ length: 9 }, () => ({ angle: rng.range(0, Math.PI), offset: rng.range(-200, 200), width: rng.range(0.8, 2.2), height: rng.range(0.5, 1.3) })),
    }),
    detail: (x, z, s) => {
      const block = plates(x, z, 16, s.nSeed + 40);
      let h = (block.id - 0.5) * 0.9 * smoothstep(0, 0.12, block.edge) + ridged(x / 34, z / 34, s.nSeed, 3) * 1.1;
      // Double ridges with a trough down the middle, the long stripes that cross Europa.
      for (const l of s.lines) {
        const d = Math.abs(x * Math.cos(l.angle) + z * Math.sin(l.angle) - l.offset) / l.width;
        if (d < 4) h += l.height * (Math.exp(-((d - 1.2) ** 2)) - 0.35 * Math.exp(-d * d * 4));
      }
      return h;
    },
    far: (x, z, s) => ridged(x / 420, z / 420, s.nSeed + 21, 4) * 70 + (plates(x, z, 380, s.nSeed + 41).id - 0.5) * 30,
  },
  'lava-flows': {
    features: (rng, pads) => ({
      craters: [],
      basins: circleList(rng, { count: 4, radius: [9, 22], dist: [34, 210], depth: [2.4, 3.4], pads }),
      cones: Array.from({ length: 2 }, () => {
        const a = rng.range(-Math.PI, Math.PI);
        const d = rng.range(1500, 2300);
        return { x: Math.sin(a) * d, z: Math.cos(a) * d, r: rng.range(650, 950), height: rng.range(170, 300) };
      }),
    }),
    detail: (x, z, s) => {
      const flow = fbm2(x / 60, z / 60, s.nSeed, 3) * 0.5 + 0.5;
      const channel = 1 - smoothstep(0, 0.07, Math.abs(fbm2(x / 85, z / 85, s.nSeed + 12, 2)));
      return terrace(flow, 5) * 2.6 + fbm2(x / 3.5, z / 3.5, s.nSeed + 7, 2) * 0.14 - channel * 2.2 * smoothstep(WALK_LIMIT_M, WALK_LIMIT_M + 30, Math.hypot(x, z));
    },
    far: (x, z, s) => {
      let h = terrace(fbm2(x / 600, z / 600, s.nSeed + 21, 3) * 0.5 + 0.5, 4) * 60;
      for (const c of s.cones) {
        const d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1) h += c.height * (1 - d) ** 1.4 * (1 - 0.6 * Math.exp(-((d / 0.09) ** 2))); // shield with a summit pit
      }
      return h;
    },
  },
  'fractured-basalt': {
    features: (rng, pads) => ({ craters: [], basins: circleList(rng, { count: 3, radius: [8, 18], dist: [36, 200], depth: [1.8, 2.6], pads }) }),
    detail: (x, z, s) => {
      const plate = plates(x, z, 5.5, s.nSeed + 40);
      const crack = 1 - smoothstep(0, 0.07, plate.edge);
      return fbm2(x / 55, z / 55, s.nSeed, 4) * 1.6 + (plate.id - 0.5) * 0.35 - crack * 0.45;
    },
    far: (x, z, s) => terrace(fbm2(x / 650, z / 650, s.nSeed + 21, 4) * 0.5 + 0.5, 5) * 110,
  },
};

// Height below which `coverage` of the open ground lies (before any clamping).
function poolQuantile(heightAt, coverage, pads) {
  const heights = [];
  const step = POOL_SAMPLE_M / 24;
  for (let z = -POOL_SAMPLE_M; z <= POOL_SAMPLE_M; z += step) {
    for (let x = -POOL_SAMPLE_M; x <= POOL_SAMPLE_M; x += step) {
      if (!pads.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 4)) heights.push(heightAt(x, z));
    }
  }
  heights.sort((a, b) => a - b);
  return heights[Math.floor(clamp(coverage, 0, 0.9) * (heights.length - 1))] ?? POOL_MAX_LEVEL;
}

function tintFor(look, s, pal, x, z, h, k) {
  const { accents } = pal;
  const style = look.reliefStyle;
  let c = mixRgb(pal.dark, pal.light, 0.55 + fbm2(x / (22 * k), z / (22 * k), 3, 4) * 0.9);
  c = mixRgb(c, pal.dust, clamp(fbm2(x / (70 * k), z / (70 * k), 8, 3) * 1.2, 0, 0.6));
  if (look.ground === 'sulfur') {
    const n = fbm2(x / (48 * k), z / (48 * k), s.nSeed + 60, 3);
    c = mixRgb(c, n > 0 ? accents[0] : accents[1], clamp(Math.abs(n) * 2.4, 0, 0.75));
    c = mixRgb(c, accents[2], smoothstep(0.18, 0.4, fbm2(x / (30 * k), z / (30 * k), s.nSeed + 61, 3)) * 0.8); // SO2 frost
    for (const b of s.basins ?? []) {
      const d = Math.hypot(x - b.x, z - b.z) / b.r;
      if (d < 2.2) c = mixRgb(c, d < 1.15 ? pal.crust : accents[3], d < 1.15 ? 0.85 : (1 - smoothstep(1.15, 2.2, d)) * 0.7); // dark pit, red fallout ring
    }
  } else if (style === 'ice-chaos') {
    let stain = 0;
    for (const l of s.lines) {
      const d = Math.abs(x * Math.cos(l.angle) + z * Math.sin(l.angle) - l.offset) / l.width;
      if (d < 4) stain = Math.max(stain, Math.exp(-((d - 0.6) ** 2) * 0.8));
    }
    c = mixRgb(c, accents[0], stain * 0.6);
    c = mixRgb(c, accents[1], (1 - smoothstep(0, 0.1, plates(x, z, 16, s.nSeed + 40).edge)) * 0.5);
  } else if (style === 'dunes') {
    const sand = duneField(x, z, s);
    const crest = duneWave(x, z, s.nSeed, 42, s.angle);
    c = mixRgb(mixRgb(c, accents[1], 0.55 * (1 - sand)), accents[0], sand * (0.35 + 0.4 * (1 - crest)));
  } else if (style === 'fractured-basalt') {
    const plate = plates(x, z, 5.5, s.nSeed + 40);
    c = scaleRgb(c, 0.82 + plate.id * 0.3);
    c = mixRgb(c, pal.crust, (1 - smoothstep(0, 0.09, plate.edge)) * 0.8);
  } else if (style === 'lava-flows') {
    c = mixRgb(c, pal.crust, smoothstep(0.5, 0.8, fbm2(x / 60, z / 60, s.nSeed, 3) * 0.5 + 0.5) * 0.7); // young flows are darkest
  } else {
    let shade = 0;
    for (const cr of s.craters) {
      const d = Math.hypot(x - cr.x, z - cr.z) / cr.r;
      if (d < 1) shade = Math.max(shade, 1 - d);
    }
    c = mixRgb(c, pal.dust, shade * 0.35);
  }
  if (look.iceCoverage > 0 && style !== 'ice-chaos') {
    const n = fbm2(x / (26 * k), z / (26 * k), s.nSeed + 70, 4) * 0.5 + 0.5 - clamp(h, -2, 2) * 0.06; // ice gathers in the hollows
    c = mixRgb(c, pal.ice, smoothstep(0, 0.07, n - s.iceThreshold) * 0.92);
  }
  if (s.poolLevel !== null) {
    const above = h - s.poolLevel;
    if (above < SHORE_M) c = mixRgb(c, look.lava > 0 ? pal.glow : pal.wet, (1 - clamp(above / SHORE_M, 0, 1)) * (look.lava > 0 ? 0.75 : 0.6));
  }
  return c;
}

/**
 * @param {ReturnType<typeof import('./worldLook.js').worldLook>} look
 * @param {{ seed?: number, pads?: Array<{x: number, z: number, r: number}>, lavaFreeRadius?: number }} [opts]
 *   lavaFreeRadius: lava outside its pits is kept this far from the base (default: the walkable area).
 */
export function makeSurface(look, { seed = look.seed, pads = [], lavaFreeRadius = WALK_LIMIT_M } = {}) {
  const style = STYLES[look.reliefStyle] ?? STYLES.craters;
  const rng = makeRng((seed ^ 0x51ed270b) >>> 0);
  const wantsPool = look.lava > 0 || Boolean(look.liquid);
  const features = style.features(rng, pads);
  const lakes = look.liquid ? circleList(rng, { count: Math.round(look.liquid.coverage * 45), radius: [10, 34], dist: [32, 230], depth: [1.6, 2.6], pads }) : [];
  const s = { nSeed: seed % 9973, angle: rng.range(0, Math.PI), lines: [], cones: [], ...features, basins: [...(features.basins ?? []), ...lakes], poolLevel: null, sink: 0, iceThreshold: iceThresholdFor(look.iceCoverage) };
  const R = look.planetRadiusM;

  function detailAt(x, z) {
    let h = style.detail(x, z, s);
    for (const c of s.craters) h += craterHeight(c, x, z);
    for (const b of s.basins) h += basinHeight(b, x, z);
    return h;
  }
  const detail0 = detailAt(0, 0);
  const landformAt = (x, z) => style.far(x, z, s) * smoothstep(FAR_START[0], FAR_START[1], Math.hypot(x, z));
  const inBasin = (x, z) => s.basins.some((b) => Math.hypot(x - b.x, z - b.z) < b.r);

  function rawHeight(x, z, dist) {
    const fine = dist < DETAIL_FADE[1] ? (detailAt(x, z) - detail0 - s.sink) * (1 - smoothstep(DETAIL_FADE[0], DETAIL_FADE[1], dist)) : 0;
    return { base: landformAt(x, z), fine };
  }

  function heightAt(x, z) {
    const dist = Math.hypot(x, z);
    let { base, fine } = rawHeight(x, z, dist);
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 4) {
        const w = smoothstep(p.r, p.r + 4, d);
        base = lerp(0, base, w);
        fine *= w;
      }
    }
    let h = base + fine;
    // Lava only pools in the fenced pits near the base, never across a path.
    if (look.lava > 0 && s.poolLevel !== null && dist < lavaFreeRadius + 20 && !inBasin(x, z)) {
      h = lerp(Math.max(h, s.poolLevel + 0.3), h, smoothstep(lavaFreeRadius, lavaFreeRadius + 20, dist));
    }
    return h - (dist * dist) / (2 * R);
  }

  if (wantsPool) {
    const level = poolQuantile(heightAt, look.lava > 0 ? look.lava : look.liquid.coverage, pads);
    // A lava world's open ground sinks a little so the molten share really floods; the base stays on its rise.
    if (look.lava > 0) s.sink = clamp(level - POOL_MAX_LEVEL, 0, MAX_LAVA_SINK_M);
    s.poolLevel = Math.min(POOL_MAX_LEVEL, level - s.sink);
  }

  const pal = {
    dark: hexToRgb(look.groundColors.dark), light: hexToRgb(look.groundColors.light), dust: hexToRgb(look.groundColors.dust),
    rock: hexToRgb(look.groundColors.rock), ice: hexToRgb(look.groundColors.ice), accents: look.groundColors.accents.map(hexToRgb),
    crust: [0.09, 0.075, 0.07], glow: hexToRgb(look.lavaColor), wet: mixRgb(hexToRgb(look.liquid?.color ?? '#000000'), hexToRgb(look.groundColors.dark), 0.4),
  };

  /** Ground colour as sRGB [r, g, b]. slope = 1 - normal.y (0 on flat ground). */
  function colorAt(x, z, h = heightAt(x, z), slope = 0) {
    const k = Math.max(1, Math.hypot(x, z) / 60); // broader colour patches further out
    const c = tintFor(look, s, pal, x, z, h, k);
    return slope > 0.04 ? mixRgb(c, pal.rock, clamp((slope - 0.04) * 4, 0, 0.55)) : c;
  }

  function craterShade(x, z) {
    let shade = 0;
    for (const c of s.craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1) shade = Math.max(shade, 1 - d);
    }
    return shade;
  }

  return {
    heightAt, colorAt, craterShade, detailAt: (x, z) => detailAt(x, z) - detail0, landformAt,
    craters: s.craters, basins: s.basins, cones: s.cones, poolLevel: s.poolLevel,
    // Lava pits near the base are walls the astronauts walk around.
    poolColliders: look.lava > 0 ? s.basins.filter((b) => Math.hypot(b.x, b.z) < WALK_LIMIT_M + b.r).map((b) => ({ x: b.x, z: b.z, r: b.r * 0.92 })) : [],
    hasDem: false, extent: SURFACE_EXTENT_M,
  };
}
