// Data Lab: pure summaries of the bundled NASA datasets (Curiosity REMS weather, DONKI space weather)
// plus radiation dose comparisons. The UI renders these; tests use them to keep quiz answers honest.
import { flareStrength } from './spaceWeather.js';
import { DOSE_LADDER } from '../data/doses.js';
import { RADIATION } from '../data/constants.js';

const COL = { sol: 0, earthDate: 1, ls: 2, minC: 3, maxC: 4, pressurePa: 5 };
const round1 = (v) => Math.round(v * 10) / 10;

const extreme = (rows, col, pickLower) => rows.reduce((best, r) => {
  if (r[col] == null) return best;
  if (!best) return r;
  return (pickLower ? r[col] < best[col] : r[col] > best[col]) ? r : best;
}, null);

const reading = (row, col, key) => (row ? { sol: row[COL.sol], earthDate: row[COL.earthDate], ls: row[COL.ls], [key]: row[col] } : null);

export function remsHighlights(rems) {
  const rows = rems?.rows ?? [];
  const withTemps = rows.filter((r) => r[COL.minC] != null && r[COL.maxC] != null);
  const mean = (col) => (withTemps.length ? round1(withTemps.reduce((s, r) => s + r[col], 0) / withTemps.length) : null);
  return {
    sols: withTemps.length,
    firstDate: rows[0]?.[COL.earthDate] ?? null,
    lastDate: rows[rows.length - 1]?.[COL.earthDate] ?? null,
    coldest: reading(extreme(rows, COL.minC, true), COL.minC, 'minC'),
    warmest: reading(extreme(rows, COL.maxC, false), COL.maxC, 'maxC'),
    lowestPressure: reading(extreme(rows, COL.pressurePa, true), COL.pressurePa, 'pressurePa'),
    highestPressure: reading(extreme(rows, COL.pressurePa, false), COL.pressurePa, 'pressurePa'),
    avgMinC: mean(COL.minC),
    avgMaxC: mean(COL.maxC),
  };
}

// Averages REMS readings into 12 seasonal bins of 30° Ls, for a "Mars year at Gale Crater" chart.
export function remsSeasonalCycle(rems) {
  const bins = Array.from({ length: 12 }, (_, i) => ({ lsStart: i * 30, n: 0, minC: 0, maxC: 0, pressurePa: 0, np: 0 }));
  const filled = (rems?.rows ?? []).reduce((acc, r) => {
    if (r[COL.ls] == null || r[COL.minC] == null || r[COL.maxC] == null) return acc;
    const i = Math.min(11, Math.floor(r[COL.ls] / 30));
    const b = acc[i];
    const p = r[COL.pressurePa];
    const next = { ...b, n: b.n + 1, minC: b.minC + r[COL.minC], maxC: b.maxC + r[COL.maxC], pressurePa: b.pressurePa + (p ?? 0), np: b.np + (p == null ? 0 : 1) };
    return acc.map((x, j) => (j === i ? next : x));
  }, bins);
  return filled.map((b) => ({
    lsStart: b.lsStart,
    sols: b.n,
    minC: b.n ? round1(b.minC / b.n) : null,
    maxC: b.n ? round1(b.maxC / b.n) : null,
    pressurePa: b.np ? Math.round(b.pressurePa / b.np) : null,
  }));
}

const isX = (f) => f.c?.[0]?.toUpperCase() === 'X';

export const xFlaresInMonth = (donki, month) => (donki?.flares ?? []).filter((f) => isX(f) && f.t?.startsWith(month)).length;

export function donkiHighlights(donki) {
  const flares = donki?.flares ?? [];
  const cmes = donki?.cmes ?? [];
  const byYear = flares.reduce((acc, f) => {
    const year = f.t?.slice(0, 4);
    if (!year) return acc;
    const prev = acc[year] ?? { flares: 0, x: 0 };
    return { ...acc, [year]: { flares: prev.flares + 1, x: prev.x + (isX(f) ? 1 : 0) } };
  }, {});
  const strongest = flares.reduce((best, f) => (f.c && (!best || flareStrength(f.c) > flareStrength(best.c)) ? f : best), null);
  const fastest = cmes.reduce((best, c) => (c.v != null && (!best || c.v > best.v) ? c : best), null);
  return {
    range: donki?.range ?? null,
    flares: flares.length,
    xFlares: flares.filter(isX).length,
    cmes: cmes.length,
    seps: (donki?.seps ?? []).length,
    byYear,
    strongestFlare: strongest ? { time: strongest.t, classType: strongest.c } : null,
    fastestCme: fastest ? { time: fastest.t, speedKmS: fastest.v } : null,
  };
}

// Puts a dose in everyday terms: chest X-rays, US-average years, and the nearest rungs on the NASA dose ladder.
export function compareDose(msv) {
  const dose = Math.max(0, Number(msv) || 0);
  const below = [...DOSE_LADDER].reverse().find((d) => d.msv <= dose) ?? null;
  const above = DOSE_LADDER.find((d) => d.msv > dose) ?? null;
  const usYear = DOSE_LADDER.find((d) => d.id === 'us-year').msv;
  return {
    msv: dose,
    chestXrays: Math.round(dose / RADIATION.chestXrayMsv),
    usYears: round1(dose / usYear),
    careerPct: Math.round((100 * dose) / RADIATION.careerLimitMsv),
    below,
    above,
  };
}
