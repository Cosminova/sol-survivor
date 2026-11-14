// Data Lab: shows judges and players exactly which NASA data the game runs on.
// Pure DOM + hand-rolled SVG. No libraries. Works offline from the bundled public/ files.
import { SOURCES } from '../data/sources.js';
import { SITES } from '../data/sites.js';
import { buildWeatherIndex } from '../engine/environment.js';
import { monthlyActivity } from '../engine/spaceWeather.js';

const BASE = (typeof import.meta.env !== 'undefined' && import.meta.env.BASE_URL) || './';

// Trek tiles were fetched at zoom 2 as public/tiles/{body}/{row}_{col}.jpg: 8 columns x 4 rows,
// equirectangular, longitude -180..180 west to east, latitude 90..-90 top to bottom (45° per tile).
export const TILE_GRID = { cols: 8, rows: 4, tilePx: 256 };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BODY_NAMES = { mars: 'Mars', moon: 'Moon' };
const MAP_CREDIT = {
  mars: 'Viking MDIM 2.1 color mosaic (232 m/pixel), NASA Mars Trek',
  moon: 'LRO Wide Angle Camera mosaic (303 pixels/degree), NASA Moon Trek',
};

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmtInt = (n) => Number(n).toLocaleString('en-US');
const r1 = (n) => Math.round(n * 10) / 10;

function fmtDate(iso) {
  if (!iso) return 'unknown date';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m) return iso;
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
}
const fmtMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ’${String(y).slice(2)}`;
};

// ---------- pure data helpers (exported so the UI and tests can reuse them) ----------

/** Average min/max temperature and pressure per `step` degrees of Ls, weighted by sample count. */
export function lsBands(index, step = 10) {
  const bands = [];
  for (let start = 0; start < 360; start += step) {
    let n = 0; let minSum = 0; let maxSum = 0; let pSum = 0; let pN = 0;
    for (let ls = start; ls < start + step; ls += 1) {
      const b = index[ls];
      if (!b) continue;
      n += b.samples; minSum += b.minC * b.samples; maxSum += b.maxC * b.samples;
      if (Number.isFinite(b.pressurePa)) { pSum += b.pressurePa * b.samples; pN += b.samples; }
    }
    bands.push(n ? { ls: start + step / 2, minC: minSum / n, maxC: maxSum / n, pressurePa: pN ? pSum / pN : null, samples: n } : null);
  }
  return bands;
}

const tally = (values) => {
  const out = {};
  for (const v of values) if (v && v !== '--') out[v] = (out[v] ?? 0) + 1;
  return out;
};
const mostCommon = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

/** Uses every REMS column: sol range, dates, opacity + UV labels, sunrise/sunset times. */
export function remsSummary(rems) {
  if (!rems?.rows?.length) return null;
  const col = Object.fromEntries(rems.columns.map((name, i) => [name, i]));
  const rows = rems.rows;
  const pick = (name) => rows.map((r) => r[col[name]]);
  const times = (name) => {
    const list = pick(name).filter((t) => typeof t === 'string' && /^\d\d:\d\d$/.test(t)).sort();
    return list.length ? { earliest: list[0], latest: list[list.length - 1], common: mostCommon(tally(list)) } : null;
  };
  const withTemps = rows.filter((r) => r[col.minC] != null && r[col.maxC] != null);
  return {
    sols: rows.length,
    solsWithTemps: withTemps.length,
    firstSol: rows[0][col.sol], lastSol: rows[rows.length - 1][col.sol],
    firstDate: rows[0][col.earthDate], lastDate: rows[rows.length - 1][col.earthDate],
    coldest: Math.min(...withTemps.map((r) => r[col.minC])),
    warmest: Math.max(...withTemps.map((r) => r[col.maxC])),
    opacity: tally(pick('opacity')),
    uv: tally(pick('uv')),
    sunrise: times('sunrise'),
    sunset: times('sunset'),
  };
}

/** Coronal mass ejection stats from DONKI cmes[].v (km/s). */
export function cmeStats(donki) {
  const cmes = (donki?.cmes ?? []).filter((c) => Number.isFinite(c.v));
  if (!cmes.length) return { count: donki?.cmes?.length ?? 0, withSpeed: 0, fastest: null, median: null };
  const fastest = cmes.reduce((best, c) => (c.v > best.v ? c : best), cmes[0]);
  const sorted = cmes.map((c) => c.v).sort((a, b) => a - b);
  return { count: donki.cmes.length, withSpeed: cmes.length, fastest, median: sorted[Math.floor(sorted.length / 2)] };
}

/** lat/lon (east-positive) to percent position on the equirectangular mosaic. */
export function siteToMosaic({ lat, lon }) {
  return { x: ((lon + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

// ---------- SVG charts ----------

const niceStep = (range, target = 6) => {
  const raw = range / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
};

function temperatureChart(bands, currentLs) {
  const W = 900; const H = 380; const L = 64; const R = 24; const T = 28; const B = 72;
  const plotW = W - L - R; const plotH = H - T - B;
  const live = bands.filter(Boolean);
  if (!live.length) return '<p class="dl-empty">No temperature readings available.</p>';
  const lo = Math.floor((Math.min(...live.map((b) => b.minC)) - 5) / 10) * 10;
  const hi = Math.ceil((Math.max(...live.map((b) => b.maxC)) + 5) / 10) * 10;
  const x = (ls) => L + (ls / 360) * plotW;
  const y = (c) => T + ((hi - c) / (hi - lo)) * plotH;

  const path = (key) => {
    let d = ''; let pen = false;
    for (const b of bands) {
      if (!b) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(b.ls).toFixed(1)},${y(b[key]).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  };
  const band = live.map((b) => `${x(b.ls).toFixed(1)},${y(b.maxC).toFixed(1)}`)
    .concat([...live].reverse().map((b) => `${x(b.ls).toFixed(1)},${y(b.minC).toFixed(1)}`)).join(' ');

  const yTicks = [];
  for (let c = lo; c <= hi; c += niceStep(hi - lo)) yTicks.push(c);
  const seasons = [['N. spring', 0], ['N. summer', 90], ['N. autumn', 180], ['N. winter', 270]];

  return `
<svg class="dl-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average daily minimum and maximum temperature at Gale Crater by Mars season (solar longitude)">
  <rect class="dl-chart-bg" x="0" y="0" width="${W}" height="${H}" rx="12"/>
  <rect class="dl-storm-season" x="${x(180)}" y="${T}" width="${x(330) - x(180)}" height="${plotH}"/>
  <text class="dl-note" x="${x(255)}" y="${T + 16}" text-anchor="middle">dust storm season</text>
  ${yTicks.map((c) => `<line class="dl-grid" x1="${L}" x2="${W - R}" y1="${y(c)}" y2="${y(c)}"/>
  <text class="dl-tick" x="${L - 8}" y="${y(c) + 4}" text-anchor="end">${c}</text>`).join('')}
  ${[0, 90, 180, 270, 360].map((ls) => `<line class="dl-grid" x1="${x(ls)}" x2="${x(ls)}" y1="${T}" y2="${T + plotH}"/>
  <text class="dl-tick" x="${x(ls)}" y="${T + plotH + 18}" text-anchor="middle">${ls}°</text>`).join('')}
  ${seasons.map(([label, ls]) => `<text class="dl-season" x="${x(ls + 45)}" y="${T + plotH + 36}" text-anchor="middle">${label}</text>`).join('')}
  <polygon class="dl-band" points="${band}"/>
  <path class="dl-line dl-line-max" d="${path('maxC')}"/>
  <path class="dl-line dl-line-min" d="${path('minC')}"/>
  ${Number.isFinite(currentLs) ? `
  <line class="dl-current" x1="${x(currentLs)}" x2="${x(currentLs)}" y1="${T}" y2="${T + plotH}"/>
  <text class="dl-current-label" x="${x(currentLs) + (currentLs > 300 ? -8 : 8)}" y="${T + plotH - 10}" text-anchor="${currentLs > 300 ? 'end' : 'start'}">Your mission: Ls ${Math.round(currentLs)}°</text>` : ''}
  <text class="dl-axis" x="${L + plotW / 2}" y="${H - 14}" text-anchor="middle">Solar longitude Ls (degrees): the Mars season clock</text>
  <text class="dl-axis" transform="translate(16 ${T + plotH / 2}) rotate(-90)" text-anchor="middle">Temperature (°C)</text>
  <g class="dl-legend" transform="translate(${L + 10} ${T + plotH - 56})">
    <rect class="dl-legend-bg" x="-6" y="-14" width="200" height="48" rx="8"/>
    <line class="dl-line dl-line-max" x1="0" x2="24" y1="0" y2="0"/><text x="32" y="4">Daytime high (average)</text>
    <line class="dl-line dl-line-min" x1="0" x2="24" y1="20" y2="20"/><text x="32" y="24">Night-time low (average)</text>
  </g>
</svg>`;
}

function spaceWeatherChart(months, currentMonth) {
  const W = 900; const H = 360; const L = 56; const R = 20; const T = 28; const B = 70;
  const plotW = W - L - R; const plotH = H - T - B;
  if (!months.length) return '<p class="dl-empty">No space weather records available.</p>';
  const series = [['M', 'dl-bar-m', 'M-class flares'], ['X', 'dl-bar-x', 'X-class flares'], ['sep', 'dl-bar-sep', 'SEP radiation storms']];
  const maxVal = Math.max(1, ...months.flatMap((m) => series.map(([k]) => m[k])));
  const step = niceStep(maxVal, 5);
  const top = Math.ceil(maxVal / step) * step;
  const groupW = plotW / months.length;
  const barW = Math.max(2, (groupW * 0.78) / series.length);
  const y = (v) => T + plotH - (v / top) * plotH;
  const yTicks = [];
  for (let v = 0; v <= top; v += step) yTicks.push(v);
  const labelEvery = months.length > 14 ? 3 : 1;

  return `
<svg class="dl-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly counts of M-class flares, X-class flares and solar energetic particle events from NASA DONKI">
  <rect class="dl-chart-bg" x="0" y="0" width="${W}" height="${H}" rx="12"/>
  ${months.map((m, i) => (m.month === currentMonth ? `<rect class="dl-current-month" x="${L + i * groupW}" y="${T}" width="${groupW}" height="${plotH}"/>
  <text class="dl-current-label" x="${L + i * groupW + groupW / 2}" y="${T - 8}" text-anchor="middle">Your mission</text>` : '')).join('')}
  ${yTicks.map((v) => `<line class="dl-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
  <text class="dl-tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
  ${months.map((m, i) => series.map(([key, cls], s) => {
    const v = m[key];
    const bx = L + i * groupW + groupW * 0.11 + s * barW;
    return `<rect class="dl-bar ${cls}" x="${bx.toFixed(1)}" y="${y(v).toFixed(1)}" width="${barW.toFixed(1)}" height="${(T + plotH - y(v)).toFixed(1)}"><title>${fmtMonth(m.month)}: ${v} ${series[s][2]}</title></rect>`;
  }).join('')).join('')}
  ${months.map((m, i) => (i % labelEvery === 0 ? `<text class="dl-tick" x="${L + i * groupW + groupW / 2}" y="${T + plotH + 18}" text-anchor="middle">${fmtMonth(m.month)}</text>` : '')).join('')}
  <text class="dl-axis" x="${L + plotW / 2}" y="${H - 12}" text-anchor="middle">Month (Earth calendar, ${months[0].month.slice(0, 4)}–${months[months.length - 1].month.slice(0, 4)})</text>
  <text class="dl-axis" transform="translate(16 ${T + plotH / 2}) rotate(-90)" text-anchor="middle">Events per month</text>
  <g class="dl-legend" transform="translate(${W - R - 190} ${T + 10})">
    <rect class="dl-legend-bg" x="-8" y="-6" width="186" height="64" rx="8"/>
    ${series.map(([, cls, label], s) => `<rect class="dl-bar ${cls}" x="0" y="${s * 20}" width="14" height="12"/><text x="22" y="${s * 20 + 11}">${label}</text>`).join('')}
  </g>
</svg>`;
}

// ---------- sections ----------

function bannerSection({ rems, donki, gallery }) {
  const rows = [
    ['Curiosity REMS weather', rems?.fetched, rems ? `${fmtInt(rems.rows.length)} sols of Gale Crater weather` : 'not loaded'],
    ['DONKI space weather', donki?.fetched, donki ? `real solar events ${donki.range?.[0] ?? ''} to ${donki.range?.[1] ?? ''}` : 'not loaded'],
    ['NASA image library', gallery?.fetched, gallery ? `${gallery.items.length} photos` : 'not loaded'],
    ['Mars Trek & Moon Trek maps', rems?.fetched ?? donki?.fetched, `${TILE_GRID.cols * TILE_GRID.rows} tiles per world, downloaded by the same script`],
  ];
  return `
<section class="dl-section dl-banner" id="datalab-banner">
  <h2>Where our numbers come from</h2>
  <p>Everything in Sol Survivor is driven by <strong>archived NASA data</strong>. We downloaded each dataset once and bundled it with the game, so it plays offline.
  The dates below are when we took the snapshot. <strong>Nothing here is live</strong>: a storm alert in the game is a real event from the past being replayed, not a forecast.</p>
  <ul class="dl-snapshots">
    ${rows.map(([name, fetched, detail]) => `<li><span class="dl-pill">📊 snapshot</span> <strong>${esc(name)}</strong> · ${esc(detail)} · fetched ${esc(fmtDate(fetched))}</li>`).join('')}
  </ul>
</section>`;
}

function weatherSection(rems, state) {
  if (!rems?.rows?.length) return `<section class="dl-section" id="datalab-weather"><h2>Mars weather</h2><p class="dl-empty">REMS data not loaded.</p></section>`;
  const index = buildWeatherIndex(rems);
  const bands = lsBands(index, 10);
  const summary = remsSummary(rems);
  const isMars = state?.body === 'mars' && Number.isFinite(state?.ls);
  const live = bands.filter(Boolean);
  const pressures = live.map((b) => b.pressurePa).filter(Number.isFinite);
  const uvOrder = ['Low', 'Moderate', 'High', 'Very_High'];
  const uvText = uvOrder.filter((k) => summary.uv[k]).map((k) => `${k.replace('_', ' ')} on ${fmtInt(summary.uv[k])} sols`).join(', ');
  const opacityText = Object.entries(summary.opacity).map(([k, v]) => `“${k}” on ${fmtInt(v)} of ${fmtInt(summary.sols)} sols`).join(', ');

  return `
<section class="dl-section" id="datalab-weather">
  <h2>Mars weather: ${fmtInt(summary.sols)} real sols at Gale Crater</h2>
  <p>Curiosity’s weather station (REMS) has reported the daily high and low since landing in August 2012. We average every sol into 10° slices of
  <em>solar longitude</em> (Ls), the Mars season clock, so the game can look up what the weather is like in any season.
  ${isMars ? `Your mission is at <strong>Ls ${Math.round(state.ls)}°</strong>${state.season ? ` (${esc(state.season)})` : ''}, sol ${state.sol} of ${state.lengthSols}; the game adds a site offset of ${state.site?.tempOffsetC ?? 0} °C for ${esc(state.site?.name ?? 'your site')}.` : 'Start a Mars mission and this chart will show where your sol lands in the year.'}</p>
  ${temperatureChart(bands, isMars ? state.ls : null)}
  <p class="dl-caption">Sols ${fmtInt(summary.firstSol)}–${fmtInt(summary.lastSol)} (${fmtDate(summary.firstDate)} to ${fmtDate(summary.lastDate)}), ${fmtInt(summary.solsWithTemps)} sols with temperature readings.
  Coldest night: ${summary.coldest} °C. Warmest afternoon: ${summary.warmest} °C.
  Air pressure averages ${fmtInt(Math.round(Math.min(...pressures)))}–${fmtInt(Math.round(Math.max(...pressures)))} Pa across the year (Earth: about 101,000 Pa): it drops when CO₂ freezes at the winter pole.</p>
  <ul class="dl-facts">
    <li><strong>Sky (opacity):</strong> REMS labels every sol’s sky; it reads ${esc(opacityText)}. “Sunny” means no cloud, but there is always some dust, which the game tracks as <em>tau</em>.</li>
    <li><strong>UV index:</strong> how strong the Sun’s ultraviolet light is at the surface: ${esc(uvText)}. Mars has no ozone layer, so even “Moderate” would sunburn skin in minutes.</li>
    <li><strong>Sunrise and sunset:</strong> usually around ${esc(summary.sunrise?.common ?? '?')} and ${esc(summary.sunset?.common ?? '?')} local Mars time,
    ranging from ${esc(summary.sunrise?.earliest ?? '?')}–${esc(summary.sunrise?.latest ?? '?')} and ${esc(summary.sunset?.earliest ?? '?')}–${esc(summary.sunset?.latest ?? '?')} through the year. A sol is 24 h 39 min long.</li>
  </ul>
  <p class="dl-source-line">Source: ${sourceLink('rems')}. Snapshot fetched ${esc(fmtDate(rems.fetched))}.</p>
</section>`;
}

function spaceWeatherSection(donki, state) {
  if (!donki) return `<section class="dl-section" id="datalab-space"><h2>Space weather</h2><p class="dl-empty">DONKI data not loaded.</p></section>`;
  const months = monthlyActivity(donki);
  const currentMonth = state?.date ? state.date.slice(0, 7) : null;
  const totals = months.reduce((t, m) => ({ C: t.C + m.C, M: t.M + m.M, X: t.X + m.X, sep: t.sep + m.sep }), { C: 0, M: 0, X: 0, sep: 0 });
  const cme = cmeStats(donki);
  return `
<section class="dl-section" id="datalab-space">
  <h2>Space weather: the Sun in ${esc(donki.range?.[0]?.slice(0, 4) ?? '')}–${esc(donki.range?.[1]?.slice(0, 4) ?? '')}</h2>
  <p>NASA’s DONKI database logs every solar flare, coronal mass ejection and <em>solar energetic particle</em> (SEP) storm. The game replays them on the real calendar:
  when a SEP storm happened on your mission date, you get a radiation alert.
  ${currentMonth ? `Your mission is in <strong>${esc(fmtMonth(currentMonth))}</strong> (highlighted).` : 'Missions start on 1 May 2024 by default, right before the biggest storms of the cycle.'}</p>
  ${spaceWeatherChart(months, currentMonth)}
  <p class="dl-caption">Totals in the snapshot: ${fmtInt(totals.C)} C-class, ${fmtInt(totals.M)} M-class and ${fmtInt(totals.X)} X-class flares, and ${fmtInt(totals.sep)} SEP events.
  Flare classes step up by 10×: an X1 flare is ten times stronger than an M1.</p>
  <p class="dl-cme"><strong>Coronal mass ejections (CMEs):</strong> ${fmtInt(cme.count)} giant clouds of solar gas were launched in this period.
  ${cme.fastest ? `The fastest left the Sun at <strong>${fmtInt(cme.fastest.v)} km/s</strong> on ${esc(fmtDate(cme.fastest.t))}; a typical one travels about ${fmtInt(cme.median)} km/s. At that speed the fastest would cross the Earth–Moon distance in under two minutes.` : ''}</p>
  <p class="dl-source-line">Source: ${sourceLink('donki')}. Snapshot fetched ${esc(fmtDate(donki.fetched))}.</p>
</section>`;
}

const truncate = (text, n = 150) => {
  const t = String(text ?? '').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n).replace(/\s+\S*$/, '')}…`;
};

function gallerySection(gallery) {
  if (!gallery?.items?.length) return `<section class="dl-section" id="datalab-gallery"><h2>Photo gallery</h2><p class="dl-empty">Gallery not loaded.</p></section>`;
  const topics = [...new Set(gallery.items.map((i) => i.topic))];
  return `
<section class="dl-section" id="datalab-gallery">
  <h2>Photo gallery: ${gallery.items.length} real NASA images</h2>
  <p>Pictures from the NASA Image and Video Library of the rovers, storms, habitats and Moon missions this game is based on.</p>
  <div class="dl-filters" role="group" aria-label="Filter photos by topic">
    <button type="button" class="dl-filter is-active" data-topic="all">All</button>
    ${topics.map((t) => `<button type="button" class="dl-filter" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}
  </div>
  <div class="dl-gallery">
    ${gallery.items.map((item) => `
    <figure class="dl-photo" data-topic="${esc(item.topic)}">
      <img loading="lazy" src="${esc(BASE)}images/${esc(item.file)}" alt="${esc(item.title)}">
      <figcaption>
        <strong>${esc(item.title)}</strong>
        <span class="dl-photo-meta">${esc(fmtDate(item.date))} · Credit: NASA${item.center ? `/${esc(item.center)}` : ''}</span>
        <span class="dl-photo-desc">${esc(truncate(item.description))}</span>
      </figcaption>
    </figure>`).join('')}
  </div>
  <p class="dl-source-line">Source: ${sourceLink('images')}. Snapshot fetched ${esc(fmtDate(gallery.fetched))}.</p>
</section>`;
}

function mosaic(body, currentSiteId) {
  const tiles = [];
  for (let row = 0; row < TILE_GRID.rows; row += 1) {
    for (let col = 0; col < TILE_GRID.cols; col += 1) {
      tiles.push(`<img src="${esc(BASE)}tiles/${body}/${row}_${col}.jpg" alt="" loading="lazy" draggable="false">`);
    }
  }
  const sites = SITES.filter((s) => s.body === body);
  const markers = sites.map((s) => {
    const { x, y } = siteToMosaic(s);
    const current = s.id === currentSiteId;
    const side = x < 14 ? 'is-left' : x > 86 ? 'is-right' : '';
    const vert = y > 80 ? 'is-above' : y < 12 ? 'is-below' : 'is-above';
    return `<div class="dl-marker ${current ? 'is-current' : ''} ${side} ${vert}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" title="${esc(s.name)}: ${s.lat}°, ${s.lon}°E">
      <span class="dl-marker-dot"></span><span class="dl-marker-label">${esc(s.name)}${current ? ' (you)' : ''}</span></div>`;
  }).join('');
  return `
<figure class="dl-map">
  <figcaption><strong>${BODY_NAMES[body]}</strong> · ${esc(MAP_CREDIT[body])}</figcaption>
  <div class="dl-mosaic" style="--dl-cols:${TILE_GRID.cols};--dl-rows:${TILE_GRID.rows}" role="img" aria-label="${BODY_NAMES[body]} global map with landing sites">
    ${tiles.join('')}
    <div class="dl-graticule" aria-hidden="true"><span class="dl-lon">180°W</span><span class="dl-lon dl-lon-mid">0°</span><span class="dl-lon dl-lon-end">180°E</span></div>
    ${markers}
  </div>
  <ul class="dl-sites">
    ${sites.map((s) => `<li${s.id === currentSiteId ? ' class="is-current"' : ''}><strong>${esc(s.name)}</strong> (${s.lat}°, ${s.lon}°E): ${esc(s.blurb)}</li>`).join('')}
  </ul>
</figure>`;
}

function mapsSection(state) {
  const currentSiteId = state?.site?.id ?? null;
  const bodies = state?.body ? [state.body, ...Object.keys(BODY_NAMES).filter((b) => b !== state.body)] : Object.keys(BODY_NAMES);
  return `
<section class="dl-section" id="datalab-maps">
  <h2>Landing-site maps</h2>
  <p>Each world is stitched from ${TILE_GRID.cols * TILE_GRID.rows} map tiles downloaded from NASA’s Solar System Treks. The maps are <em>equirectangular</em>: the whole globe is unrolled flat,
  180° west on the left, 180° east on the right, north pole at the top. Each tile covers 45° × 45°. Sites are placed by their real latitude and longitude${currentSiteId ? '; your outpost is highlighted' : ''}.</p>
  ${bodies.map((b) => mosaic(b, currentSiteId)).join('')}
  <p class="dl-source-line">Source: ${sourceLink('trek')}. Site data: ${sourceLink('mars-sites')}, ${sourceLink('artemis')}.</p>
</section>`;
}

function sourceLink(id) {
  const s = SOURCES[id];
  if (!s) return esc(id);
  return `<a href="#source-${esc(id)}" class="dl-source-ref" data-source-id="${esc(id)}">${esc(s.title)}</a>`;
}

function sourcesSection() {
  return `
<section class="dl-section" id="datalab-sources">
  <h2>Sources</h2>
  <p>Every number in the game points at one of these. Data badges (📊) inside the game jump here.</p>
  <ol class="dl-sources">
    ${Object.entries(SOURCES).map(([id, s]) => `
    <li id="source-${esc(id)}" data-source-id="${esc(id)}">
      <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>
      <span class="dl-source-org">${esc(s.org)} · <span class="dl-kind">${esc(s.kind)}</span></span>
      <span class="dl-source-use">${esc(s.use)}</span>
    </li>`).join('')}
  </ol>
</section>`;
}

// ---------- public API ----------

/**
 * Fill `container` with the Data Lab.
 * @param {HTMLElement} container
 * @param {{ rems: object|null, donki: object|null, gallery: object|null, state: object|null }} data
 * @returns {HTMLElement} the container
 */
export function renderDataLab(container, { rems = null, donki = null, gallery = null, state = null } = {}) {
  container.classList.add('data-lab');
  container.innerHTML = [
    bannerSection({ rems, donki, gallery }),
    weatherSection(rems, state),
    spaceWeatherSection(donki, state),
    gallerySection(gallery),
    mapsSection(state),
    sourcesSection(),
  ].join('\n');

  // Gallery topic filter.
  const filters = container.querySelectorAll('.dl-filter');
  const photos = container.querySelectorAll('.dl-photo');
  filters.forEach((button) => button.addEventListener('click', () => {
    const topic = button.dataset.topic;
    filters.forEach((b) => b.classList.toggle('is-active', b === button));
    photos.forEach((p) => { p.hidden = topic !== 'all' && p.dataset.topic !== topic; });
  }));

  // Inline source references highlight the bibliography entry.
  container.querySelectorAll('.dl-source-ref').forEach((link) => link.addEventListener('click', () => {
    highlightSource(container, link.dataset.sourceId);
  }));
  return container;
}

/** Scroll to and flash a bibliography entry inside a rendered Data Lab. */
export function highlightSource(container, sourceId) {
  const target = container.querySelector(`#source-${sourceId}`);
  if (!target) return false;
  container.querySelectorAll('.dl-sources li.is-highlight').forEach((li) => li.classList.remove('is-highlight'));
  target.classList.add('is-highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

/**
 * A small "📊 NASA data" pill. Click dispatches `open-source` on document with { detail: { sourceId } }.
 * @param {string} sourceId id from SOURCES
 * @returns {HTMLButtonElement}
 */
export function dataBadge(sourceId) {
  const source = SOURCES[sourceId];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'data-badge';
  button.dataset.sourceId = sourceId;
  button.textContent = '📊 NASA data';
  button.title = source ? `${source.title} (${source.org})` : 'NASA data source';
  button.setAttribute('aria-label', source ? `Data source: ${source.title}` : 'Data source');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    document.dispatchEvent(new CustomEvent('open-source', { detail: { sourceId } }));
  });
  return button;
}
