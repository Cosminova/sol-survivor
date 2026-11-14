// Pure helpers that turn the archived Curiosity REMS table into chart-ready numbers.
import { marsTime } from '../../../engine/marsTime.js';

export const EARTH_PRESSURE_PA = 101325;

export function toRecords(rems) {
  const columns = rems?.columns ?? [];
  return (rems?.rows ?? []).map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Rows are in sol order; a big drop in Ls means a new Mars year has started.
export function withMarsYears(records) {
  if (!records.length) return [];
  const firstYear = marsTime(new Date(`${records[0].earthDate}T12:00:00Z`)).marsYear;
  return records.reduce((acc, rec) => {
    const prev = acc[acc.length - 1];
    const year = !prev ? firstYear : prev.marsYear + (isNum(rec.ls) && isNum(prev.ls) && prev.ls - rec.ls > 180 ? 1 : 0);
    acc.push({ ...rec, marsYear: year });
    return acc;
  }, []);
}

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// Average a field over Ls buckets of `size` degrees. Returns [{x: bucket centre, y, n}].
export function bucketByLs(records, field, size = 2) {
  const buckets = new Map();
  for (const rec of records) {
    if (!isNum(rec.ls) || !isNum(rec[field])) continue;
    const key = Math.floor(rec.ls / size) * size;
    buckets.set(key, [...(buckets.get(key) ?? []), rec[field]]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, values]) => ({ x: key + size / 2, y: Math.round(mean(values) * 10) / 10, n: values.length }));
}

export function yearsIn(records) {
  return [...new Set(records.map((r) => r.marsYear))].sort((a, b) => a - b);
}

export function perYearSeries(records, field, size = 6) {
  return yearsIn(records).map((year) => ({
    year,
    values: bucketByLs(records.filter((r) => r.marsYear === year), field, size),
  }));
}

// Typical weather at one Ls, read from the bucket averages (nearest bucket).
export function typicalAt(ls, buckets) {
  const nearest = (series) => series.reduce((best, p) => (!best || Math.abs(p.x - ls) < Math.abs(best.x - ls) ? p : best), null);
  return {
    maxC: nearest(buckets.maxC)?.y ?? null,
    minC: nearest(buckets.minC)?.y ?? null,
    pressurePa: nearest(buckets.pressurePa)?.y ?? null,
  };
}
