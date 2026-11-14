#!/usr/bin/env node
// Downloads archived NASA data once and writes compact files into public/.
// The game reads only these static files, so it runs offline at the event.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'data-src');
const OUT_DATA = path.join(ROOT, 'public', 'data');
const OUT_TILES = path.join(ROOT, 'public', 'tiles');
const OUT_IMAGES = path.join(ROOT, 'public', 'images');

const REMS_URL = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json';
const DONKI_BASE = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get';
const DONKI_START = '2024-01-01';
const DONKI_END = '2025-12-31';
const DONKI_WINDOW_DAYS = 59;
const TREK_LAYERS = {
  mars: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm',
  moon: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm',
};
const TILE_ZOOM = 2;
const TILE_COLS = 8;
const TILE_ROWS = 4;
const GALLERY_QUERIES = [
  'Curiosity rover Mars surface',
  'Perseverance rover Jezero',
  'Mars dust storm',
  'Mars habitat concept',
  'Artemis lunar surface',
  'MOXIE oxygen Perseverance',
];
const GALLERY_PER_QUERY = 4;

for (const dir of [CACHE, OUT_DATA, OUT_TILES, OUT_IMAGES]) fs.mkdirSync(dir, { recursive: true });

async function cachedFetch(url, cacheName, { binary = false } = {}) {
  const file = path.join(CACHE, cacheName);
  if (fs.existsSync(file)) return binary ? fs.readFileSync(file) : fs.readFileSync(file, 'utf8');
  const response = await fetch(url, { headers: { 'user-agent': 'sol-survivor data fetch' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const body = binary ? Buffer.from(await response.arrayBuffer()) : await response.text();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return body;
}

const toNumber = (value) => {
  const n = Number(value);
  return value === '--' || value === '' || value == null || Number.isNaN(n) ? null : n;
};

async function fetchRems() {
  const raw = JSON.parse(await cachedFetch(REMS_URL, 'rems.json'));
  const rows = raw.soles
    .map((s) => [
      toNumber(s.sol), s.terrestrial_date, toNumber(s.ls),
      toNumber(s.min_temp), toNumber(s.max_temp), toNumber(s.pressure),
      s.atmo_opacity, s.local_uv_irradiance_index, s.sunrise, s.sunset,
    ])
    .filter((r) => r[0] != null)
    .sort((a, b) => a[0] - b[0]);
  const out = {
    source: 'NASA/JPL-Caltech, Curiosity Rover Environmental Monitoring Station (REMS), Centro de Astrobiología (CAB)',
    url: REMS_URL,
    fetched: new Date().toISOString().slice(0, 10),
    note: 'Archived snapshot. Temperatures in °C, pressure in Pa, at Gale Crater (4.6°S, 137.4°E).',
    columns: ['sol', 'earthDate', 'ls', 'minC', 'maxC', 'pressurePa', 'opacity', 'uv', 'sunrise', 'sunset'],
    rows,
  };
  fs.writeFileSync(path.join(OUT_DATA, 'rems.json'), JSON.stringify(out));
  console.log(`REMS: ${rows.length} sols`);
}

function* dateWindows(start, end, days) {
  let cursor = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cursor <= stop) {
    const windowEnd = new Date(Math.min(cursor.getTime() + days * 864e5, stop.getTime()));
    yield [cursor.toISOString().slice(0, 10), windowEnd.toISOString().slice(0, 10)];
    cursor = new Date(windowEnd.getTime() + 864e5);
  }
}

async function fetchDonkiType(type) {
  const all = [];
  for (const [from, to] of dateWindows(DONKI_START, DONKI_END, DONKI_WINDOW_DAYS)) {
    const url = `${DONKI_BASE}/${type}?startDate=${from}&endDate=${to}`;
    const body = await cachedFetch(url, `donki/${type}-${from}.json`);
    const parsed = body.trim() ? JSON.parse(body) : [];
    all.push(...parsed);
  }
  return all;
}

function bestCmeSpeed(cme) {
  const analyses = cme.cmeAnalyses ?? [];
  const best = analyses.find((a) => a.isMostAccurate) ?? analyses[0];
  return best?.speed ?? null;
}

async function fetchDonki() {
  const [flares, cmes, seps] = await Promise.all(['FLR', 'CME', 'SEP'].map(fetchDonkiType));
  const out = {
    source: 'NASA Community Coordinated Modeling Center (CCMC), DONKI Space Weather Database',
    url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    fetched: new Date().toISOString().slice(0, 10),
    range: [DONKI_START, DONKI_END],
    note: 'Archived snapshot of real solar events. Replayed in-game as space weather alerts.',
    flares: flares.map((f) => ({ t: f.peakTime ?? f.beginTime, c: f.classType, loc: f.sourceLocation ?? '' })),
    cmes: cmes.map((c) => ({ t: c.startTime, v: bestCmeSpeed(c) })),
    seps: seps.map((s) => ({ t: s.eventTime, id: s.sepID })),
  };
  fs.writeFileSync(path.join(OUT_DATA, 'donki.json'), JSON.stringify(out));
  console.log(`DONKI: ${out.flares.length} flares, ${out.cmes.length} CMEs, ${out.seps.length} SEP events`);
}

async function fetchTiles() {
  for (const [body, base] of Object.entries(TREK_LAYERS)) {
    const dir = path.join(OUT_TILES, body);
    fs.mkdirSync(dir, { recursive: true });
    for (let y = 0; y < TILE_ROWS; y += 1) {
      for (let x = 0; x < TILE_COLS; x += 1) {
        const target = path.join(dir, `${y}_${x}.jpg`);
        if (fs.existsSync(target)) continue;
        const bytes = await cachedFetch(`${base}/${TILE_ZOOM}/${y}/${x}.jpg`, `tiles/${body}-${y}-${x}.jpg`, { binary: true });
        fs.writeFileSync(target, bytes);
      }
    }
    console.log(`Trek tiles: ${body} (${TILE_COLS}x${TILE_ROWS})`);
  }
}

async function fetchGallery() {
  const items = [];
  const seen = new Set();
  for (const query of GALLERY_QUERIES) {
    const url = `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(query)}`;
    const raw = JSON.parse(await cachedFetch(url, `gallery/${query.replace(/\W+/g, '_')}.json`));
    const picks = raw.collection.items.filter((it) => it.links?.[0]?.href && !seen.has(it.data[0].nasa_id));
    for (const it of picks.slice(0, GALLERY_PER_QUERY)) {
      const meta = it.data[0];
      seen.add(meta.nasa_id);
      const file = `${meta.nasa_id.replace(/[^\w-]/g, '_')}.jpg`;
      try {
        const bytes = await cachedFetch(it.links[0].href, `gallery/img/${file}`, { binary: true });
        fs.writeFileSync(path.join(OUT_IMAGES, file), bytes);
      } catch (err) {
        console.warn(`  skip ${meta.nasa_id}: ${err.message}`);
        continue;
      }
      items.push({
        id: meta.nasa_id,
        title: meta.title,
        date: (meta.date_created ?? '').slice(0, 10),
        center: meta.center ?? 'NASA',
        description: (meta.description ?? '').replace(/<[^>]+>/g, '').slice(0, 420),
        file,
        topic: query,
      });
    }
  }
  const out = {
    source: 'NASA Image and Video Library (images.nasa.gov)',
    fetched: new Date().toISOString().slice(0, 10),
    items,
  };
  fs.writeFileSync(path.join(OUT_DATA, 'gallery.json'), JSON.stringify(out));
  console.log(`Gallery: ${items.length} images`);
}

const steps = [fetchRems, fetchDonki, fetchTiles, fetchGallery];
let failed = 0;
for (const step of steps) {
  try {
    await step();
  } catch (err) {
    failed += 1;
    console.error(`${step.name} failed: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
