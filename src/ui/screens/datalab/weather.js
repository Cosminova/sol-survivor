// Data Lab · Mars Weather: real Curiosity REMS data from Gale Crater, averaged by season (Ls).
import { h, mount } from '../../dom.js';
import { lineChart } from '../../charts.js';
import { sourceBadge, termButton } from '../../components/common.js';
import { loadRems } from '../../../state/nasaData.js';
import { marsTime, seasonName } from '../../../engine/marsTime.js';
import { remsHighlights } from '../../../engine/dataLab.js';
import {
  toRecords, withMarsYears, bucketByLs, perYearSeries, yearsIn, typicalAt, EARTH_PRESSURE_PA,
} from './remsStats.js';
import { seasonCycleCard } from './seasonCycle.js';
import { statCard, statGrid, sectionHead, caption, withData, fmtNum, fmtDate } from './shared.js';

const COLORS = { max: '#ff9a5c', min: '#4fe3ff', pressure: '#5eead4', today: '#4ade80' };
const FAINT = { max: 'rgba(255, 154, 92, 0.28)', min: 'rgba(79, 227, 255, 0.26)', pressure: 'rgba(177, 151, 252, 0.3)' };
const DUST_BAND = { from: 180, to: 330, color: 'rgba(255, 122, 61, 0.13)' };
const SEASON_BANDS = ['N. spring', 'N. summer', 'N. autumn', 'N. winter']
  .map((label, i) => ({ from: i * 90, to: i * 90 + 90, color: 'transparent', label }));
const SEASON_MARKERS = [90, 180, 270].map((x) => ({ x, color: '#56628a' }));

const QUARTER_NOTES = [
  'Mars is near its farthest point from the Sun (aphelion, Ls 71°), so sunlight is weakest and the sky is usually clear.',
  'Winter at the south pole: so much carbon dioxide freezes into a giant ice cap that the air gets thinner everywhere.',
  'Dust storm season begins. Mars swings closest to the Sun (perihelion, Ls 251°), warming the ground and lifting dust.',
  'The south polar ice turns back into gas, so the air is thickest. Dust storms can still blow until about Ls 330°.',
];

const lsFormat = (v) => `${Math.round(v)}°`;

// Extra room above the data keeps the season labels clear of the lines.
function paddedDomain(seriesList, step, headroom) {
  const ys = seriesList.flatMap((ser) => ser.map((p) => p.y)).filter(Number.isFinite);
  return [Math.floor(Math.min(...ys) / step) * step, Math.ceil(Math.max(...ys) / step) * step + headroom];
}

function buildBuckets(records) {
  return {
    maxC: bucketByLs(records, 'maxC', 2),
    minC: bucketByLs(records, 'minC', 2),
    pressurePa: bucketByLs(records, 'pressurePa', 2),
  };
}

function perYearLines(records, field, color) {
  return perYearSeries(records, field, 6).map(({ values }) => ({ color, values, width: 1 }));
}

function todayMarker() {
  return { x: marsTime(new Date()).ls, label: 'Today', color: COLORS.today };
}

function tempChart(records, buckets, showYears) {
  const faint = showYears ? [...perYearLines(records, 'maxC', FAINT.max), ...perYearLines(records, 'minC', FAINT.min)] : [];
  return lineChart({
    title: 'Gale Crater temperature by Mars season',
    desc: 'Average afternoon high and pre-dawn low temperature for every 2 degrees of solar longitude, from Curiosity REMS.',
    width: 720,
    height: 290,
    xDomain: [0, 360],
    xLabel: 'Season (solar longitude, Ls)',
    yLabel: 'Temperature (°C)',
    xFormat: lsFormat,
    yFormat: (v) => `${v}°`,
    yDomain: paddedDomain([buckets.maxC, buckets.minC, ...faint.map((f) => f.values)], 10, 20),
    bands: [DUST_BAND, ...SEASON_BANDS],
    markers: [...SEASON_MARKERS, todayMarker()],
    series: [
      ...faint,
      { label: 'Average daily high', color: COLORS.max, values: buckets.maxC, width: 2.6 },
      { label: 'Average nightly low', color: COLORS.min, values: buckets.minC, width: 2.6 },
    ],
  });
}

function pressureChart(records, buckets, showYears) {
  const faint = showYears ? perYearLines(records, 'pressurePa', FAINT.pressure) : [];
  return lineChart({
    title: 'Gale Crater air pressure by Mars season',
    desc: 'Average daily air pressure in pascals for every 2 degrees of solar longitude, from Curiosity REMS.',
    width: 720,
    height: 260,
    xDomain: [0, 360],
    xLabel: 'Season (solar longitude, Ls)',
    yLabel: 'Pressure (Pa)',
    xFormat: lsFormat,
    yDomain: paddedDomain([buckets.pressurePa, ...faint.map((f) => f.values)], 50, 100),
    bands: [DUST_BAND, ...SEASON_BANDS],
    markers: [...SEASON_MARKERS, todayMarker()],
    series: [
      ...faint,
      { label: 'Average air pressure', color: COLORS.pressure, values: buckets.pressurePa, width: 2.6, area: !showYears },
    ],
  });
}

const readingDetail = (r) => (r ? `Sol ${fmtNum(r.sol)} · ${fmtDate(r.earthDate)} · Ls ${r.ls}°` : null);

function summaryCards(hl) {
  return statGrid([
    statCard({ icon: '🥶', label: 'Coldest night', value: `${hl.coldest?.minC ?? '–'} °C`, detail: readingDetail(hl.coldest), tone: 'cyan' }),
    statCard({ icon: '🌤️', label: 'Warmest afternoon', value: `${hl.warmest?.maxC ?? '–'} °C`, detail: readingDetail(hl.warmest), tone: 'mars' }),
    statCard({ icon: '🎈', label: 'Thinnest air', value: `${hl.lowestPressure?.pressurePa ?? '–'} Pa`, detail: readingDetail(hl.lowestPressure), tone: 'violet' }),
    statCard({ icon: '🌬️', label: 'Thickest air', value: `${hl.highestPressure?.pressurePa ?? '–'} Pa`, detail: readingDetail(hl.highestPressure), tone: 'violet' }),
    statCard({ icon: '📅', label: 'Sols of weather', value: fmtNum(hl.sols), detail: `${fmtDate(hl.firstDate)} → ${fmtDate(hl.lastDate)}`, tone: 'gold' }),
    statCard({ icon: '🌡️', label: 'Typical sol', value: `${hl.avgMaxC ?? '–'} / ${hl.avgMinC ?? '–'} °C`, detail: `Average high / low · Earth air is ${fmtNum(EARTH_PRESSURE_PA)} Pa`, tone: 'mars' }),
  ]);
}

function swingStats(buckets) {
  const p = buckets.pressurePa.map((b) => b.y);
  const lowest = buckets.pressurePa.reduce((a, b) => (b.y < a.y ? b : a), buckets.pressurePa[0]);
  const daily = buckets.maxC.map((b, i) => b.y - (buckets.minC[i]?.y ?? b.y));
  return {
    pressureSwingPct: p.length ? Math.round(((Math.max(...p) - Math.min(...p)) / Math.max(...p)) * 100) : 0,
    lowestLs: lowest ? Math.round(lowest.x) : 150,
    dailySwing: daily.length ? Math.round(daily.reduce((a, b) => a + b, 0) / daily.length) : 0,
  };
}

function seasonExplorer(buckets) {
  const output = h('div', { class: 'dl-season-out', 'aria-live': 'polite' });
  const update = (ls) => {
    const t = typicalAt(ls, buckets);
    const inDust = ls >= DUST_BAND.from && ls <= DUST_BAND.to;
    mount(output,
      h('div', { class: 'dl-season-tags' },
        h('span', { class: 'badge' }, `Ls ${ls}°`),
        h('span', { class: 'badge mars' }, `North: ${seasonName(ls, true)}`),
        h('span', { class: 'badge moon' }, `South (Gale): ${seasonName(ls, false)}`),
        inDust ? h('span', { class: 'badge warn' }, '🌪️ Dust season') : null),
      h('div', { class: 'dl-season-nums' },
        h('div', null, h('span', null, 'Typical high'), h('strong', { class: 'dl-hot' }, `${t.maxC ?? '–'} °C`)),
        h('div', null, h('span', null, 'Typical low'), h('strong', { class: 'dl-cold' }, `${t.minC ?? '–'} °C`)),
        h('div', null, h('span', null, 'Air pressure'), h('strong', { class: 'dl-violet' }, `${t.pressurePa ?? '–'} Pa`),
          h('small', { class: 'faint' }, t.pressurePa ? `${((t.pressurePa / EARTH_PRESSURE_PA) * 100).toFixed(2)}% of Earth’s` : ''))),
      h('p', { class: 'muted dl-season-note' }, QUARTER_NOTES[Math.floor(ls / 90) % 4]));
  };
  const start = Math.round(marsTime(new Date()).ls) % 360;
  const slider = h('input', {
    type: 'range', min: 0, max: 359, step: 1, value: start, id: 'dl-season-ls',
    oninput: (e) => update(Number(e.target.value)),
  });
  update(start);
  return h('section', { class: 'card dl-season', 'aria-labelledby': 'dl-season-title' },
    h('h3', { id: 'dl-season-title' }, '🧭 Season explorer'),
    h('label', { class: 'field', for: 'dl-season-ls' }, h('span', null, 'Slide through one Mars year (starts at today’s season)')),
    slider,
    output);
}

function build(rems) {
  const records = withMarsYears(toRecords(rems));
  if (!records.length) return h('div', { class: 'panel empty' }, 'No weather rows found in this snapshot.');
  const buckets = buildBuckets(records);
  const highlights = remsHighlights(rems);
  const years = yearsIn(records);
  const swing = swingStats(buckets);
  const charts = h('div', { class: 'stack' });
  let showYears = false;

  const toggle = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, '〰️ Show each Mars year');
  const drawCharts = () => {
    toggle.setAttribute('aria-pressed', String(showYears));
    mount(charts,
      h('div', { class: 'dl-chart-card' }, tempChart(records, buckets, showYears),
        caption('🌡️', `Every sol at Gale swings about ${swing.dailySwing} °C between the afternoon high and the pre-dawn low. Thin air can’t hold heat, so nights get bitterly cold even in “summer”.`)),
      h('div', { class: 'dl-chart-card' }, pressureChart(records, buckets, showYears),
        caption('❄️', `Pressure drops in southern winter (lowest near Ls ${swing.lowestLs}°) because CO₂ freezes onto the south pole! That makes the whole atmosphere about ${swing.pressureSwingPct}% thinner until spring turns the ice back into gas.`)));
  };
  toggle.addEventListener('click', () => { showYears = !showYears; drawCharts(); });
  drawCharts();

  return h('div', { class: 'stack' },
    summaryCards(highlights),
    seasonCycleCard(rems, highlights),
    h('div', { class: 'row between dl-toolbar' },
      h('p', { class: 'faint dl-small' }, `Zoom in: ${years.length} Mars years of data (MY ${years[0]}–${years[years.length - 1]}), averaged into 2° slices of the Mars year. Orange shading = dust storm season. Green line = today on Mars.`),
      toggle),
    charts,
    seasonExplorer(buckets));
}

export function renderWeather(container) {
  const body = h('div');
  mount(container,
    sectionHead({
      kicker: 'Curiosity rover · Gale Crater',
      title: 'Mars Weather Station',
      intro: 'Curiosity has measured the weather nearly every sol since 2012. Each line below averages thousands of real readings by season, so you can see what a “normal” Mars year feels like.',
      tone: 'mars',
    }),
    h('div', { class: 'row dl-terms' },
      h('span', { class: 'faint dl-small' }, 'Words to know:'),
      termButton('rems', 'REMS'), termButton('solar-longitude', 'Ls (season)'),
      termButton('atmospheric-pressure', 'air pressure'), termButton('carbon-dioxide', 'CO₂'),
      sourceBadge('rems', { label: 'Data' })),
    body);
  return withData(body, { loader: loadRems, message: 'Downloading Curiosity weather reports…', build });
}
