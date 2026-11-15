#!/usr/bin/env node
// Saves the bright-star catalogue for the Cosminova night-sky world picker into src/data/skyStars.json.
// Run at build time (node scripts/fetch-sky.mjs); the game never fetches it live.
//
// Source: d3-celestial by Olaf Frohn (BSD-3-Clause), data/stars.6.json and data/starnames.json, which are drawn
// from the HYG database (Hipparcos, Yale Bright Star and Gliese catalogues). Cosminova credits the same files.
// We keep every star to visual magnitude 5.5 (about what a child sees from a dark back yard) as
// [raDeg, decDeg, mag, bv] rows, plus the proper names of the brightest stars for labels.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data', 'skyStars.json');
const BASE = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data';
const MAG_LIMIT = 5.5;
const NAME_MAG_LIMIT = 1.6; // only the brightest stars get a label
const DEFAULT_BV = 0.65; // a Sun-like colour when the catalogue has no B-V

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const round = (v, digits) => Number(v.toFixed(digits));

function toRow(feature) {
  const [lon, dec] = feature.geometry?.coordinates ?? [];
  const mag = Number(feature.properties?.mag);
  if (!Number.isFinite(lon) || !Number.isFinite(dec) || !Number.isFinite(mag)) return null;
  const bvRaw = Number.parseFloat(feature.properties?.bv);
  const ra = lon < 0 ? lon + 360 : lon; // d3-celestial stores RA as -180..180 degrees
  return { id: feature.id, row: [round(ra, 3), round(dec, 3), round(mag, 2), round(Number.isFinite(bvRaw) ? bvRaw : DEFAULT_BV, 2)] };
}

async function main() {
  const [stars, names] = await Promise.all([getJson(`${BASE}/stars.6.json`), getJson(`${BASE}/starnames.json`)]);
  if (stars?.type !== 'FeatureCollection' || !Array.isArray(stars.features)) throw new Error('stars.6.json is not a FeatureCollection');
  const kept = stars.features
    .map(toRow)
    .filter((s) => s && s.row[2] <= MAG_LIMIT)
    .sort((a, b) => a.row[2] - b.row[2]);
  const labels = {};
  kept.forEach((s, i) => {
    const name = names?.[s.id]?.name;
    if (name && s.row[2] <= NAME_MAG_LIMIT) labels[i] = name;
  });
  const out = {
    source: 'd3-celestial stars.6.json (HYG: Hipparcos, Yale BSC, Gliese), BSD-3-Clause, https://github.com/ofrohn/d3-celestial',
    magLimit: MAG_LIMIT,
    fields: ['raDeg', 'decDeg', 'mag', 'bv'],
    stars: kept.map((s) => s.row),
    names: labels,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  console.log(`Wrote ${kept.length} stars (${Object.keys(labels).length} named) to ${path.relative(ROOT, OUT)}, ${fs.statSync(OUT).size} bytes`);
}

main().catch((err) => {
  console.error('[fetch-sky]', err.message);
  process.exit(1);
});
