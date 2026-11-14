import { moonIsSunlit } from './solar.js';

const mod = (x, m) => ((x % m) + m) % m;
const avg = (values) => values.reduce((s, v) => s + v, 0) / values.length;

// Groups real Curiosity REMS sols into 1° Ls buckets so any season can be looked up instantly.
export function buildWeatherIndex(rems) {
  const col = Object.fromEntries(rems.columns.map((name, i) => [name, i]));
  const buckets = Array.from({ length: 360 }, () => []);
  for (const row of rems.rows) {
    const ls = row[col.ls];
    if (ls == null || row[col.minC] == null || row[col.maxC] == null) continue;
    buckets[Math.round(ls) % 360].push(row);
  }
  return buckets.map((rows, ls) => {
    if (!rows.length) return null;
    return {
      ls,
      minC: avg(rows.map((r) => r[col.minC])),
      maxC: avg(rows.map((r) => r[col.maxC])),
      pressurePa: avg(rows.map((r) => r[col.pressurePa]).filter((v) => v != null)),
      samples: rows.length,
      examples: rows.slice(-3).map((r) => ({ sol: r[col.sol], earthDate: r[col.earthDate], minC: r[col.minC], maxC: r[col.maxC] })),
    };
  });
}

function nearestBucket(index, ls) {
  for (let d = 0; d < 180; d += 1) {
    const hit = index[mod(Math.round(ls) + d, 360)] ?? index[mod(Math.round(ls) - d, 360)];
    if (hit) return hit;
  }
  return null;
}

const FALLBACK = { minC: -75, maxC: -5, pressurePa: 750, samples: 0, examples: [] };

export function marsWeather(index, ls, site, pick = 0) {
  const bucket = (index && nearestBucket(index, ls)) ?? FALLBACK;
  const offset = site.tempOffsetC ?? 0;
  const example = bucket.examples.length ? bucket.examples[Math.floor(pick * bucket.examples.length)] : null;
  return {
    minC: Math.round(bucket.minC + offset),
    maxC: Math.round(bucket.maxC + offset),
    avgC: Math.round((bucket.minC + bucket.maxC) / 2 + offset),
    pressurePa: Math.round(bucket.pressurePa),
    reference: example,
  };
}

// Background dust opacity: clear in northern spring/summer, dusty from Ls 180 to 330.
export function baselineTau(ls) {
  const l = mod(ls, 360);
  if (l < 180 || l > 330) return 0.5;
  return 0.5 + 0.5 * Math.sin((Math.PI * (l - 180)) / 150);
}

export const dustStormChance = (ls) => (mod(ls, 360) >= 180 && mod(ls, 360) <= 330 ? 0.03 : 0.006);

export function moonConditions(site, dayIndex, phaseOffsetDays = 0) {
  const lit = moonIsSunlit(site, dayIndex, phaseOffsetDays);
  const temp = lit ? site.tempDayC : site.tempNightC;
  return { lit, minC: temp - 10, maxC: temp + 10, avgC: temp, pressurePa: 0 };
}
