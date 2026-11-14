// Pure outpost layout: turns mission.modules into positioned stations around a central habitat.
// Angles are measured from +z (the airlock side) towards +x; units are metres.
import { makeRng, hashString } from './rng.js';

export const WORLD_LIMIT = 95; // astronauts cannot walk farther than this from the habitat
export const INTERACT_RANGE = 2.6;
export const AIRLOCK = { x: 0, z: 6.4 };

// kind -> placement and collision. `spot` is where an astronaut stands to work, offset towards the habitat.
export const STATION_SLOTS = {
  habitat: { angle: 0, dist: 0, r: 4.6 },
  berm: { angle: Math.PI, dist: 8.5, r: 1.6 },
  solar: { angle: -0.85, dist: 19, r: 2.2 },
  greenhouse: { angle: 1.05, dist: 14, r: 3.4 },
  shelter: { angle: 2.25, dist: 13, r: 2.8 },
  battery: { angle: -2.05, dist: 10, r: 1.4 },
  recycler: { angle: -2.65, dist: 8.6, r: 1.1 },
  oxygen: { angle: 2.85, dist: 9.6, r: 1.1 },
  moxie: { angle: -1.55, dist: 12, r: 1.1 },
  regolithO2: { angle: -1.55, dist: 12, r: 1.5 },
  iceDrill: { angle: -2.45, dist: 25, r: 1.8 },
  fission: { angle: 1.95, dist: 36, r: 2.2 },
  rover: { angle: 0.5, dist: 11.5, r: 2.4 },
  relay: { angle: 1.62, dist: 21, r: 1.2 },
  spares: { angle: -0.38, dist: 7.4, r: 1 },
};

export const FISSION_KEEP_OUT = 7;
const OUTCROP_ANGLES = [-0.25, 0.85, 2.7, -2.95];
const polar = (angle, dist) => ({ x: Math.sin(angle) * dist, z: Math.cos(angle) * dist });
const round2 = (v) => Math.round(v * 100) / 100;

function spotToward(x, z, gap) {
  const d = Math.hypot(x, z) || 1;
  return { x: round2(x - (x / d) * gap), z: round2(z - (z / d) * gap) };
}

function solarStation(count) {
  const { angle, dist } = STATION_SLOTS.solar;
  const centre = polar(angle, dist);
  const cols = Math.min(3, count);
  const rows = Math.ceil(count / cols);
  // Rows run perpendicular to the line back to the habitat.
  const fwd = { x: -Math.sin(angle), z: -Math.cos(angle) };
  const side = { x: fwd.z, z: -fwd.x };
  const panels = Array.from({ length: count }, (_, i) => {
    const c = (i % cols) - (cols - 1) / 2;
    const r = Math.floor(i / cols) - (rows - 1) / 2;
    const x = centre.x + side.x * c * 5 + fwd.x * r * 5.2;
    const z = centre.z + side.z * c * 5 + fwd.z * r * 5.2;
    return { index: i, x: round2(x), z: round2(z), spot: { x: round2(x + fwd.x * 2.1), z: round2(z + fwd.z * 2.1) } };
  });
  return {
    id: 'solar', kind: 'solar', moduleId: 'solar', count, x: round2(centre.x), z: round2(centre.z),
    angle, r: STATION_SLOTS.solar.r, panels, spots: panels.map((p) => p.spot),
    colliders: panels.map((p) => ({ x: p.x, z: p.z, r: 1.9 })),
  };
}

function rowStation(kind, count, spacing) {
  const { angle, dist, r } = STATION_SLOTS[kind];
  const centre = polar(angle, dist);
  const side = { x: Math.cos(angle), z: -Math.sin(angle) };
  const units = Array.from({ length: count }, (_, i) => {
    const o = (i - (count - 1) / 2) * spacing;
    return { index: i, x: round2(centre.x + side.x * o), z: round2(centre.z + side.z * o) };
  });
  return {
    id: kind, kind, moduleId: kind, count, x: round2(centre.x), z: round2(centre.z), angle, r, units,
    spots: units.map((u) => spotToward(u.x, u.z, r + 1.2)),
    colliders: units.map((u) => ({ x: u.x, z: u.z, r })),
  };
}

function singleStation(kind, moduleId = kind) {
  const { angle, dist, r } = STATION_SLOTS[kind];
  const p = polar(angle, dist);
  const gap = kind === 'fission' ? FISSION_KEEP_OUT + 0.6 : r + 1.2;
  return {
    id: kind, kind, moduleId, count: 1, x: round2(p.x), z: round2(p.z), angle, r,
    spots: [spotToward(p.x, p.z, gap)], colliders: [{ x: round2(p.x), z: round2(p.z), r }],
  };
}

function habitatStation() {
  return {
    id: 'habitat', kind: 'habitat', moduleId: null, count: 1, x: 0, z: 0, angle: 0, r: STATION_SLOTS.habitat.r,
    spots: [{ ...AIRLOCK }], colliders: [{ x: 0, z: 0, r: 4.6 }, { x: 0, z: 4.3, r: 1.3 }],
  };
}

function outcrops(seed, body) {
  const rng = makeRng(seed ^ 0x9e3779b9);
  const n = body === 'moon' ? 3 : 4;
  return OUTCROP_ANGLES.slice(0, n).map((a, i) => {
    const angle = a + rng.range(-0.18, 0.18);
    const dist = rng.range(30, 42);
    const p = polar(angle, dist);
    return {
      id: `outcrop${i + 1}`, kind: 'outcrop', moduleId: null, index: i, count: 1, x: round2(p.x), z: round2(p.z),
      angle, r: 1.6, spots: [spotToward(p.x, p.z, 2.4)], colliders: [{ x: round2(p.x), z: round2(p.z), r: 1.6 }],
    };
  });
}

export function layoutSeed(mission) {
  return hashString(`${mission.code ?? 'SOL'}:${mission.config?.siteId ?? 'site'}`);
}

export function buildLayout(mission) {
  const modules = mission.modules ?? {};
  const body = mission.config?.body ?? 'mars';
  const has = (id) => (modules[id] ?? 0) > 0;
  const stations = [habitatStation(), singleStation('berm', null)];
  if (has('solar')) stations.push(solarStation(modules.solar));
  if (has('greenhouse')) stations.push(rowStation('greenhouse', modules.greenhouse, 7.4));
  if (has('battery')) stations.push(rowStation('battery', modules.battery, 1.8));
  if (has('fission')) stations.push(rowStation('fission', modules.fission, 5));
  for (const id of ['shelter', 'recycler', 'oxygen', 'moxie', 'regolithO2', 'iceDrill', 'rover', 'relay', 'spares']) {
    if (has(id)) stations.push(singleStation(id));
  }
  const fission = stations.find((s) => s.kind === 'fission');
  if (fission) {
    fission.spots = [spotToward(fission.x, fission.z, FISSION_KEEP_OUT + 0.6)];
  }
  const seed = layoutSeed(mission);
  const all = [...stations, ...outcrops(seed, body)];
  return { seed, body, stations: all, colliders: all.flatMap((s) => s.colliders) };
}

// Flat building pads so structures do not float or sink on the procedural terrain.
export function padsFor(layout) {
  return layout.stations.flatMap((s) => {
    if (s.kind === 'outcrop') return [];
    if (s.kind === 'habitat') return [{ x: 0, z: 0, r: 9 }];
    return s.colliders.map((c) => ({ x: c.x, z: c.z, r: c.r + 1.6 }));
  });
}

// Seeded spots for things to discover, kept clear of structures.
export function scatterPoints(layout, seed, count, { minDist = 14, maxDist = 70, clearance = 5 } = {}) {
  const rng = makeRng(seed);
  const points = [];
  for (let tries = 0; points.length < count && tries < count * 40; tries += 1) {
    const p = polar(rng.range(-Math.PI, Math.PI), rng.range(minDist, maxDist));
    const blocked = layout.colliders.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < c.r + clearance)
      || points.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < clearance * 2);
    if (!blocked) points.push({ x: round2(p.x), z: round2(p.z) });
  }
  return points;
}

export function stationById(layout, id) {
  return layout.stations.find((s) => s.id === id) ?? null;
}

// Nearest station spot within range of (x, z), or null.
export function nearestStation(layout, x, z, range = INTERACT_RANGE) {
  let best = null;
  for (const s of layout.stations) {
    s.spots.forEach((spot, spotIndex) => {
      const d = Math.hypot(spot.x - x, spot.z - z);
      if (d <= range && (!best || d < best.dist)) best = { station: s, spotIndex, dist: d };
    });
  }
  return best;
}

export function layoutSignature(mission) {
  const m = mission.modules ?? {};
  return `${mission.config?.body}|${mission.config?.siteId}|${mission.code}|${Object.keys(m).sort().map((k) => `${k}${m[k]}`).join(',')}`;
}
