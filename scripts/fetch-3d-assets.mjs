// Downloads and converts the 3D outpost's NASA assets (run: node scripts/fetch-3d-assets.mjs).
// - Laser-altimeter terrain patches around each landing site from PDS Geosciences:
//   Mars: MGS MOLA MEGDR 128 px/deg (463 m). Moon: LRO LOLA LDEM 512 px/deg (59 m) and polar 40 m.
//   Only the needed rows/columns are fetched with HTTP range requests, then resampled to a
//   256x256 Int16 grid (0.25 m steps, heights relative to the base) + a JSON sidecar.
// - NASA 3D Resources astronaut (EMU) glTF and the three.js Draco decoder for offline loading.
// Raw downloads are cached in data-src/ (gitignored). Output goes to public/terrain and public/models.
import { mkdir, writeFile, readFile, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_TERRAIN = join(ROOT, 'public/terrain');
const OUT_MODELS = join(ROOT, 'public/models');
const CACHE = join(ROOT, 'data-src/terrain');
const SIZE = 256;
const STEP_M = 0.25;
const MOLA = 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128';
const LOLA = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr';
const NASA3D = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models';
const MARS_R = 3396190;
const MOON_R = 1737400;

// Mars MEGDR 128 px/deg tiles: 44 deg tall x 90 deg wide, MSB int16 metres above the areoid.
const megdrTile = (lat, lonE) => {
  const top = lat >= 44 ? 88 : lat >= 0 ? 44 : lat >= -44 ? 0 : -44;
  const west = Math.floor((((lonE % 360) + 360) % 360) / 90) * 90;
  const name = `megt${String(Math.abs(top)).padStart(2, '0')}${top >= 0 ? 'n' : 's'}${String(west).padStart(3, '0')}hb`;
  return { url: `${MOLA}/${name}.img`, name, top, west, ppd: 128, lines: 5632, samples: 11520, msb: true, scale: 1 };
};

const SITES = [
  { id: 'jezero', body: 'mars', lat: 18.4447, lon: 77.4508, halfKm: 30, note: 'Perseverance landing site, Jezero crater floor; rim and delta on the horizon.' },
  { id: 'gale', body: 'mars', lat: -4.5895, lon: 137.4417, halfKm: 30, note: 'Curiosity landing site, Gale crater; Mount Sharp (Aeolis Mons) to the south.' },
  { id: 'arcadia', body: 'mars', lat: 40.0, lon: -150.0, halfKm: 30, note: 'Arcadia Planitia ice-rich plains.' },
  { id: 'utopia', body: 'mars', lat: 47.6, lon: 134.0, halfKm: 30, note: 'Utopia Planitia, near Viking 2.' },
  { id: 'tranquility', body: 'moon', lat: 0.6741, lon: 23.4730, halfKm: 12, note: 'Apollo 11 Tranquility Base, Mare Tranquillitatis.' },
  { id: 'shackleton', body: 'moon', lat: -89.67, lon: 129.78, halfKm: 22, polar: true, note: 'Base placed on the highest point of the Shackleton crater rim, crater interior beside it.' },
];

async function fetchRange(url, start, end, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
      if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return res.status === 200 ? buf.subarray(start, end + 1) : buf;
    } catch (err) {
      if (i === tries - 1) throw new Error(`${url} [${start}-${end}]: ${err.message}`);
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// Reads a rectangular window from a PDS IMG raster (one range request per row, or one block for full rows).
async function readWindow(src, row0, rows, col0, cols) {
  const cacheFile = join(CACHE, `${src.name}_${row0}_${rows}_${col0}_${cols}.bin`);
  let raw;
  if (existsSync(cacheFile)) {
    raw = await readFile(cacheFile);
  } else {
    const parts = await pool(Array.from({ length: rows }, (_, i) => row0 + i), 16, (r) => {
      const start = (r * src.samples + col0) * 2;
      return fetchRange(src.url, start, start + cols * 2 - 1);
    });
    raw = Buffer.concat(parts);
    await mkdir(CACHE, { recursive: true });
    await writeFile(cacheFile, raw);
  }
  const grid = new Float32Array(rows * cols);
  for (let i = 0; i < rows * cols; i += 1) grid[i] = (src.msb ? raw.readInt16BE(i * 2) : raw.readInt16LE(i * 2)) * src.scale;
  return { grid, rows, cols };
}

function bilinear(win, r, c) {
  const r0 = Math.max(0, Math.min(win.rows - 2, Math.floor(r)));
  const c0 = Math.max(0, Math.min(win.cols - 2, Math.floor(c)));
  const fr = Math.min(1, Math.max(0, r - r0));
  const fc = Math.min(1, Math.max(0, c - c0));
  const g = (rr, cc) => win.grid[rr * win.cols + cc];
  return (g(r0, c0) * (1 - fc) + g(r0, c0 + 1) * fc) * (1 - fr) + (g(r0 + 1, c0) * (1 - fc) + g(r0 + 1, c0 + 1) * fc) * fr;
}

async function equirectPatch(site) {
  const src = site.body === 'mars'
    ? megdrTile(site.lat, site.lon)
    : { url: `${LOLA}/cylindrical/img/ldem_512_00n_45n_000_090.img`, name: 'ldem_512_00n_45n_000_090', top: 45, west: 0, ppd: 512, lines: 23040, samples: 46080, msb: false, scale: 0.5 };
  const R = site.body === 'mars' ? MARS_R : MOON_R;
  const mPerDeg = (Math.PI / 180) * R;
  const cosLat = Math.cos((site.lat * Math.PI) / 180);
  const lonE = ((site.lon % 360) + 360) % 360;
  const halfM = site.halfKm * 1000;
  const latSpan = halfM / mPerDeg;
  const lonSpan = halfM / (mPerDeg * cosLat);
  const row0 = Math.max(0, Math.floor((src.top - (site.lat + latSpan)) * src.ppd) - 2);
  const row1 = Math.min(src.lines - 1, Math.ceil((src.top - (site.lat - latSpan)) * src.ppd) + 2);
  const col0 = Math.max(0, Math.floor((lonE - lonSpan - src.west) * src.ppd) - 2);
  const col1 = Math.min(src.samples - 1, Math.ceil((lonE + lonSpan - src.west) * src.ppd) + 2);
  const win = await readWindow(src, row0, row1 - row0 + 1, col0, col1 - col0 + 1);
  const mpp = (2 * halfM) / (SIZE - 1);
  const heights = new Float32Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      const lat = site.lat + (halfM - j * mpp) / mPerDeg; // row 0 = north edge
      const lon = lonE + (-halfM + i * mpp) / (mPerDeg * cosLat);
      heights[j * SIZE + i] = bilinear(win, (src.top - lat) * src.ppd - row0 - 0.5, (lon - src.west) * src.ppd - col0 - 0.5);
    }
  }
  const instrument = site.body === 'mars' ? 'MGS MOLA MEGDR (128 px/deg, 463 m/px)' : 'LRO LOLA LDEM_512 (512 px/deg, 59 m/px)';
  return { heights, mpp, instrument, url: src.url, sourceRes: site.body === 'mars' ? 463 : 59, center: { lat: site.lat, lon: site.lon } };
}

// South polar stereographic LOLA 40 m DEM; finds Shackleton's rim high point and centres the patch there.
async function shackletonPatch(site) {
  const src = { url: `${LOLA}/polar/img/ldem_85s_40m.img`, name: 'ldem_85s_40m', lines: 7584, samples: 7584, msb: false, scale: 0.5 };
  const scale = 40;
  const span = 1100; // ~44 km around the pole
  const row0 = Math.round(3791.5 - span / 2);
  const col0 = Math.round(3791.5 - span / 2);
  const win = await readWindow(src, row0, span, col0, span);
  let floor = { v: Infinity, r: 0, c: 0 };
  for (let r = 50; r < span - 50; r += 4) {
    for (let c = 50; c < span - 50; c += 4) {
      if (Math.hypot(r - span / 2, c - span / 2) * scale > 15000) continue;
      const v = win.grid[r * span + c];
      if (v < floor.v) floor = { v, r, c };
    }
  }
  let rim = { v: -Infinity, r: 0, c: 0 };
  for (let a = 0; a < 360; a += 1) {
    for (let k = 9000; k <= 13000; k += 80) {
      const r = Math.round(floor.r + (Math.sin((a * Math.PI) / 180) * k) / scale);
      const c = Math.round(floor.c + (Math.cos((a * Math.PI) / 180) * k) / scale);
      if (r < 0 || c < 0 || r >= span || c >= span) continue;
      const v = win.grid[r * span + c];
      if (v > rim.v) rim = { v, r, c };
    }
  }
  const halfM = site.halfKm * 1000;
  const mpp = (2 * halfM) / (SIZE - 1);
  const heights = new Float32Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      heights[j * SIZE + i] = bilinear(win, rim.r + (-halfM + j * mpp) / scale, rim.c + (-halfM + i * mpp) / scale);
    }
  }
  return {
    heights, mpp, instrument: 'LRO LOLA LDEM_85S_40M (polar stereographic, 40 m/px)', url: src.url, sourceRes: 40,
    center: { lat: site.lat, lon: site.lon },
    extra: { craterFloorOffsetM: { x: (floor.c - rim.c) * scale, z: (floor.r - rim.r) * scale }, rimDepthM: Math.round(rim.v - floor.v) },
  };
}

async function writeTerrain(site, patch) {
  const base = patch.heights[(SIZE / 2) * SIZE + SIZE / 2];
  const ints = new Int16Array(SIZE * SIZE);
  let min = Infinity;
  let max = -Infinity;
  patch.heights.forEach((h, i) => {
    const rel = h - base;
    min = Math.min(min, rel);
    max = Math.max(max, rel);
    ints[i] = Math.max(-32768, Math.min(32767, Math.round(rel / STEP_M)));
  });
  await mkdir(OUT_TERRAIN, { recursive: true });
  await writeFile(join(OUT_TERRAIN, `${site.id}.bin`), Buffer.from(ints.buffer));
  const meta = {
    site: site.id, body: site.body, width: SIZE, height: SIZE, metersPerPixel: Math.round(patch.mpp * 1000) / 1000,
    halfExtentM: site.halfKm * 1000, encoding: 'int16le', heightStepM: STEP_M, minM: Math.round(min), maxM: Math.round(max),
    baseElevationM: Math.round(base), rowOrder: 'north-to-south', colOrder: 'west-to-east',
    center: patch.center, instrument: patch.instrument, sourceResolutionM: patch.sourceRes, source: patch.url,
    license: 'Public domain (NASA / PDS Geosciences Node)', note: site.note, ...patch.extra,
  };
  await writeFile(join(OUT_TERRAIN, `${site.id}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`terrain ${site.id}: ${meta.metersPerPixel} m/px, relief ${meta.minM}..${meta.maxM} m`);
}

async function download(url, file) {
  if (existsSync(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

async function models() {
  await mkdir(join(OUT_MODELS, 'draco'), { recursive: true });
  const raw = join(ROOT, 'data-src/models/astronaut.glb');
  await download(`${NASA3D}/Astronaut/Astronaut.glb`, raw);
  await copyFile(raw, join(OUT_MODELS, 'nasa-astronaut.glb'));
  const draco = join(ROOT, 'node_modules/three/examples/jsm/libs/draco/gltf');
  for (const f of ['draco_decoder.wasm', 'draco_wasm_wrapper.js']) await copyFile(join(draco, f), join(OUT_MODELS, 'draco', f));
  console.log(`model nasa-astronaut.glb: ${(await stat(raw)).size} bytes`);
}

const only = process.argv.slice(2);
for (const site of SITES) {
  if (only.length && !only.includes(site.id) && !only.includes('terrain')) continue;
  const patch = site.polar ? await shackletonPatch(site) : await equirectPatch(site);
  await writeTerrain(site, patch);
}
if (!only.length || only.includes('models')) await models();
