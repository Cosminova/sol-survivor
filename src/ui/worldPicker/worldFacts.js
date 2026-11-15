// Turns a world profile into short kid-friendly fact rows. Every row keeps its own provenance badge from
// factLabel(): real and derived facts read 'Real · NASA', game guesses read 'Generated · game model'.
import { factLabel, isMeasured } from '../../data/worlds.js';

const HOURS_PER_DAY = 24;
const LONG_DAY_HOURS = 72;
const ICE_EASY = 0.66;
const ICE_SOME = 0.33;
const PA_PER_EARTH_ATM = 101325;
const THIN_AIR_PA = 1;

const GROUND_WORDS = {
  basalt: 'Dark volcanic rock', regolith: 'Dusty broken rock', 'iron-oxide': 'Rusty red dust', sulfur: 'Yellow sulfur',
  'ice-shell': 'A shell of ice', 'organic-dunes': 'Dunes of sooty grains', lava: 'Hot lava', 'iron-rich': 'Iron-rich rock',
};
const WATER_WORDS = { none: 'No liquid water', subsurface: 'An ocean under the ground', surface: 'Liquid on the surface' };

const round = (v, digits = 0) => Number(Number(v).toFixed(digits)).toLocaleString('en-US');

export function formatGravity(g) {
  if (!Number.isFinite(g)) return 'Unknown';
  return `${round(g, 2)} g (${Math.abs(g - 1) < 0.05 ? 'about the same as Earth' : g < 1 ? 'lighter than Earth' : 'heavier than Earth'})`;
}

export function formatDay(hours) {
  if (!Number.isFinite(hours)) return 'Unknown';
  return hours >= LONG_DAY_HOURS ? `${round(hours / HOURS_PER_DAY, 1)} Earth days` : `${round(hours, 1)} hours`;
}

export const formatTemp = (c) => (Number.isFinite(c) ? `${round(c)} °C` : 'Unknown');

export function formatPressure(pa) {
  if (!Number.isFinite(pa)) return 'Unknown';
  if (pa < THIN_AIR_PA) return 'No air to breathe';
  const atm = pa / PA_PER_EARTH_ATM;
  return atm < 0.1 ? `Very thin air (${round(atm * 100, 1)}% of Earth)` : `${round(atm, 2)} times Earth's air`;
}

export function formatAir(gases) {
  if (!Array.isArray(gases) || gases.length === 0) return 'None';
  return gases.slice(0, 3).map((g) => `${g.gas} ${round(g.pct, 1)}%`).join(', ');
}

export function formatIce(v) {
  if (!Number.isFinite(v)) return 'Unknown';
  return v >= ICE_EASY ? 'Easy to dig up' : v >= ICE_SOME ? 'Some, if you dig' : v > 0 ? 'Very little' : 'None found';
}

export const formatRadiation = (msv) => (Number.isFinite(msv) ? `${round(msv, 2)} mSv a day (Earth: about 0.01)` : 'Unknown');

export function formatDistance(world) {
  const ly = world.star?.distanceLy;
  if (ly) return { fact: ly, value: `${round(ly.v, 2)} light-years from Earth` };
  const au = world.facts?.orbitAu;
  if (!au) return null;
  return { fact: au, value: world.parent && world.parent !== 'sun' ? `${round(au.v, 2)} AU from the Sun (with its planet)` : `${round(au.v, 2)} AU from the Sun` };
}

/**
 * Fact rows for a world card, in reading order. Rows whose fact is missing are left out.
 * @returns {Array<{ key: string, label: string, value: string, badge: string, measured: boolean }>}
 */
export function factRows(world) {
  const f = world.facts ?? {};
  const row = (key, label, fact, format) => (fact
    ? { key, label, value: format(fact.v), badge: factLabel(fact), measured: isMeasured(fact), note: fact.note ?? null }
    : null);
  const dist = formatDistance(world);
  return [
    row('gravity', 'Gravity', f.gravityG, formatGravity),
    row('day', 'Length of a day', f.dayHours, formatDay),
    row('tempDay', 'Daytime', f.tempDayC, formatTemp),
    row('tempNight', 'Night', f.tempNightC, formatTemp),
    row('pressure', 'Air', f.pressurePa, formatPressure),
    row('air', 'Gases in the air', f.air, formatAir),
    row('ice', 'Water ice', f.waterIce, formatIce),
    row('water', 'Liquid water', f.liquidWater, (v) => WATER_WORDS[v] ?? String(v)),
    row('ground', 'Ground', f.ground, (v) => GROUND_WORDS[v] ?? String(v)),
    row('radiation', 'Radiation on the ground', f.radiationMsvPerDay, formatRadiation),
    dist ? { key: 'distance', label: 'Distance', value: dist.value, badge: factLabel(dist.fact), measured: isMeasured(dist.fact), note: dist.fact.note ?? null } : null,
  ].filter(Boolean);
}

/** Warning shown on worlds the NASA Exoplanet Archive flags as controversial, or null. */
export const disputedLine = (world) => (world.disputed ? 'Disputed: NASA lists it, but astronomers are not sure it is really there.' : null);

/** The plain-language header line about where the facts come from. */
export function provenanceLine(world) {
  const anyGenerated = Object.values(world.facts ?? {}).some((fact) => fact && !isMeasured(fact));
  const year = world.discovery?.year ?? null;
  const first = world.kind === 'exoplanet' ? `Real planet${year ? `, found ${year}` : ''}. NASA Exoplanet Archive.` : 'Real world, explored by NASA.';
  return anyGenerated ? `${first} Some facts are game guesses.` : `${first} Every fact is measured.`;
}
