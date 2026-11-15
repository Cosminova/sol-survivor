// What can be clicked in the Cosminova sky, and which worlds each target leads to. Pure logic, no DOM.
// Only two kinds of target exist: host stars of rocky exoplanets in WORLDS, and Solar System bodies. There are no
// galaxies, nebulae or other deep-sky objects, and gas giants are never landable: Jupiter and Saturn only open a
// list of their moons.
import { planetRaDec, moonRaDec, toHorizontal } from './ephemeris.js';

export const GAS_GIANTS = new Set(['jupiter', 'saturn', 'uranus', 'neptune']);
const LANDABLE_KINDS = new Set(['planet', 'moon', 'dwarf-planet', 'exoplanet']);
const ROCKY_MAX_RADIUS_EARTH = 2.0; // above about 1.6-2 Earth radii planets are mostly gas or deep water
const NAKED_EYE_MATCH_DEG = 0.25; // a host star is "visible" if a catalogue star sits this close
export const TARGET_KINDS = new Set(['star', 'body']);

/** Where the player stands on Earth. Both are real NASA places. */
export const OBSERVERS = [
  { id: 'houston', name: 'Houston, USA (northern sky)', short: 'Houston', lat: 29.56, lon: -95.09 },
  { id: 'canberra', name: 'Canberra, Australia (southern sky)', short: 'Canberra', lat: -35.4, lon: 148.98 },
];
export const observerById = (id) => OBSERVERS.find((o) => o.id === id) ?? OBSERVERS[0];

/**
 * Solar System targets. moons lists the landable worlds a gateway opens; the gateway itself is never a world.
 * @type {Array<{ id: string, name: string, gateway: boolean, moons: string[], mag: number, color: string, blurb: string }>}
 */
export const SOLAR_TARGETS = [
  { id: 'moon', name: 'The Moon', gateway: false, moons: [], mag: -12, color: '#e9e4d8', blurb: 'Our Moon, about 3 days away by rocket.' },
  { id: 'mercury', name: 'Mercury', gateway: false, moons: [], mag: 0, color: '#c9b9a6', blurb: 'The smallest planet, closest to the Sun.' },
  { id: 'venus', name: 'Venus', gateway: false, moons: [], mag: -4, color: '#f6e7c1', blurb: 'The brightest planet, wrapped in thick clouds.' },
  { id: 'mars', name: 'Mars', gateway: false, moons: [], mag: 0.5, color: '#ff8a5c', blurb: 'The red planet.' },
  { id: 'jupiter', name: 'Jupiter', gateway: true, moons: ['io', 'europa', 'ganymede', 'callisto'], mag: -2.2, color: '#f0d6b0', blurb: 'The biggest planet, made mostly of gas, with dozens of moons.' },
  { id: 'saturn', name: 'Saturn', gateway: true, moons: ['titan', 'enceladus'], mag: 0.6, color: '#ead9a6', blurb: 'A planet of gas with bright rings of ice and rock.' },
];

/** True for a rocky planet or moon the player may land on. Gas giants and big puffy exoplanets are never landable. */
export function isLandableWorld(world) {
  if (!world || GAS_GIANTS.has(world.id) || !LANDABLE_KINDS.has(world.kind)) return false;
  const radius = world.facts?.radiusEarth?.v;
  if (world.kind === 'exoplanet' && Number.isFinite(radius) && radius > ROCKY_MAX_RADIUS_EARTH) return false;
  return true;
}

/** True only for targets the sky is allowed to show: stars and Solar System bodies, never deep-sky objects. */
export const isAllowedTarget = (target) => TARGET_KINDS.has(target?.kind);

const angularSeparationDeg = (a, b) => {
  const toRad = Math.PI / 180;
  const cos = Math.sin(a.dec * toRad) * Math.sin(b.dec * toRad)
    + Math.cos(a.dec * toRad) * Math.cos(b.dec * toRad) * Math.cos((a.ra - b.ra) * toRad);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / toRad;
};

/** The brightest catalogue star within NAKED_EYE_MATCH_DEG of a position, or null. Rows are [ra, dec, mag, bv]. */
export function catalogueMatch(pos, starRows = []) {
  let best = null;
  for (const [ra, dec, mag] of starRows) {
    if (Math.abs(dec - pos.dec) > NAKED_EYE_MATCH_DEG) continue;
    if (angularSeparationDeg(pos, { ra, dec }) > NAKED_EYE_MATCH_DEG) continue;
    if (!best || mag < best.mag) best = { ra, dec, mag };
  }
  return best;
}

/** One target per exoplanet host star that has at least one landable world with a sky position. */
export function starTargets(worlds, starRows = []) {
  const bySystem = new Map();
  for (const w of worlds) {
    if (w.kind !== 'exoplanet' || !w.sky || !isLandableWorld(w)) continue;
    const entry = bySystem.get(w.system) ?? { world: w, ids: [] };
    bySystem.set(w.system, { ...entry, ids: [...entry.ids, w.id] });
  }
  return [...bySystem.entries()].map(([system, { world, ids }]) => {
    const match = catalogueMatch(world.sky, starRows);
    return {
      id: `star:${system}`, kind: 'star', system, name: world.star?.name ?? system,
      ra: world.sky.ra, dec: world.sky.dec, mag: match?.mag ?? null, nakedEye: Boolean(match),
      distanceLy: world.star?.distanceLy?.v ?? null, teffK: world.star?.teffK?.v ?? null,
      spectralType: world.star?.spectralType?.v ?? null, worldIds: ids, gateway: false,
    };
  });
}

/** Solar System targets at their real places in the sky for a date, seen from an observer. */
export function solarTargets(date, observer) {
  return SOLAR_TARGETS.map((t) => {
    const pos = t.id === 'moon' ? moonRaDec(date, observer) : planetRaDec(t.id, date);
    return { ...t, kind: 'body', system: 'sol', ra: pos.ra, dec: pos.dec, nakedEye: true, distAu: t.id === 'moon' ? null : pos.dist };
  });
}

/**
 * Every clickable target with its altitude/azimuth for the date and observer, brightest-first within each group.
 * @returns {Array<object>} targets with alt, az and aboveHorizon added
 */
export function skyTargets(worlds, date, observer, starRows = []) {
  const all = [...solarTargets(date, observer), ...starTargets(worlds, starRows)].filter(isAllowedTarget);
  return all.map((t) => {
    const { alt, az } = toHorizontal(t, observer, date);
    return { ...t, alt, az, aboveHorizon: alt > 0 };
  });
}

/**
 * Landable worlds behind a target, and the ids a gateway promises that have no world profile yet.
 * @returns {{ worlds: Array<object>, missing: string[] }}
 */
export function worldsForTarget(target, worlds) {
  if (!target) return { worlds: [], missing: [] };
  if (target.kind === 'star') {
    return { worlds: worlds.filter((w) => w.system === target.system && isLandableWorld(w)), missing: [] };
  }
  if (target.gateway) {
    const found = target.moons.map((id) => worlds.find((w) => w.id === id)).filter(isLandableWorld);
    const extra = worlds.filter((w) => w.parent === target.id && !target.moons.includes(w.id) && isLandableWorld(w));
    return { worlds: [...found, ...extra], missing: target.moons.filter((id) => !found.some((w) => w.id === id)) };
  }
  const self = worlds.find((w) => w.id === target.id);
  const moons = worlds.filter((w) => w.parent === target.id && isLandableWorld(w));
  const list = [self, ...moons].filter(isLandableWorld);
  return { worlds: list, missing: self ? [] : [target.id] };
}

/** Plain sentence for where a target is right now. */
export function whereInSky(target) {
  if (!target.aboveHorizon) return 'Below the horizon right now.';
  const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dir = dirs[Math.round(target.az / 45) % 8];
  const height = target.alt > 60 ? 'high up' : target.alt > 25 ? 'halfway up' : 'low';
  return `${height[0].toUpperCase()}${height.slice(1)} in the ${dir}.`;
}
