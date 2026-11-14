// Data Lab · Space Weather: real 2024–2025 solar flares, CMEs and SEP events from NASA DONKI.
import { h, mount } from '../../dom.js';
import { barChart } from '../../charts.js';
import { sourceBadge, termButton } from '../../components/common.js';
import { loadDonki } from '../../../state/nasaData.js';
import { monthlyActivity, flareStrength } from '../../../engine/spaceWeather.js';
import { donkiHighlights } from '../../../engine/dataLab.js';
import { statCard, statGrid, sectionHead, caption, withData, fmtNum, fmtDate, fmtMonth } from './shared.js';

const STORM_MONTH = '2024-05';
const COLORS = { C: '#4fe3ff', M: '#fbbf24', X: '#ff5d6c', cme: '#5eead4', sep: '#f472b6' };
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

const FLARE_LADDER = [
  { letter: 'A', power: 1, note: 'Tiny. Background glow.' },
  { letter: 'B', power: 10, note: 'Small. Happens all the time.' },
  { letter: 'C', power: 100, note: 'Common. Little effect on Earth.' },
  { letter: 'M', power: 1000, note: 'Medium. Can cause short radio blackouts.' },
  { letter: 'X', power: 10000, note: 'Biggest. Radio blackouts and radiation storms.' },
];

const monthLabel = (m) => `${SHORT.format(new Date(`${m}-15T12:00:00Z`))} ’${m.slice(2, 4)}`;

function strongestFlare(flares) {
  return flares.reduce((best, f) => (!best || flareStrength(f.c) > flareStrength(best.c) ? f : best), null);
}

function inMonth(list, month) {
  return (list ?? []).filter((item) => item.t?.startsWith(month));
}

function monthDetail(donki, entry) {
  const flares = inMonth(donki.flares, entry.month);
  const top = strongestFlare(flares);
  const fastest = inMonth(donki.cmes, entry.month)
    .filter((c) => Number.isFinite(c.v))
    .reduce((best, c) => (!best || c.v > best.v ? c : best), null);
  const isStorm = entry.month === STORM_MONTH;
  return h('div', { class: ['card', 'dl-month', isStorm && 'dl-month-storm'] },
    h('div', { class: 'row between' },
      h('h3', null, `📆 ${fmtMonth(entry.month)}`),
      isStorm ? h('span', { class: 'badge danger' }, '⚡ Game chapter: Solar Maximum') : null),
    h('div', { class: 'dl-month-grid' },
      h('div', null, h('span', null, 'C-class'), h('strong', { style: { color: COLORS.C } }, entry.C)),
      h('div', null, h('span', null, 'M-class'), h('strong', { style: { color: COLORS.M } }, entry.M)),
      h('div', null, h('span', null, 'X-class'), h('strong', { style: { color: COLORS.X } }, entry.X)),
      h('div', null, h('span', null, 'CMEs'), h('strong', { style: { color: COLORS.cme } }, entry.cme)),
      h('div', null, h('span', null, 'SEP reports'), h('strong', { style: { color: COLORS.sep } }, entry.sep))),
    h('p', null, top
      ? ['Strongest flare: ', h('strong', null, top.c), ` on ${fmtDate(top.t)}`, top.loc ? `, fired from position ${top.loc} on the Sun.` : '.']
      : 'No C, M or X flares were catalogued this month.'),
    fastest ? h('p', { class: 'muted' }, `Fastest CME: ${fmtNum(fastest.v)} km/s. At that speed it could cross from the Sun to Earth in about ${Math.round(149.6e6 / fastest.v / 3600)} hours.`) : null,
    isStorm ? h('p', { class: 'dl-storm-note' },
      'This is the Gannon storm. In early May 2024 sunspot region 3664 fired a burst of X-class flares and CMEs that gave Earth its strongest geomagnetic storm in over 20 years. People saw auroras far from the poles. Later that month a huge X-class flare hit Mars, and Curiosity’s RAD measured 8,100 micrograys, about 30 chest X-rays’ worth for an astronaut standing outside. ',
      sourceBadge('rad-2024', { label: 'Source' })) : null);
}

function ladder() {
  return h('section', { class: 'card dl-ladder', 'aria-labelledby': 'dl-ladder-title' },
    h('h3', { id: 'dl-ladder-title' }, '🪜 Flare classes: each step is 10× stronger'),
    h('ol', { class: 'dl-ladder-list' }, FLARE_LADDER.map((step, i) => h('li', { style: { '--w': `${12 + i * 22}%` } },
      h('span', { class: 'dl-ladder-letter' }, step.letter),
      h('span', { class: 'dl-ladder-bar', 'aria-hidden': 'true' }),
      h('span', { class: 'dl-ladder-text' }, h('strong', null, `${fmtNum(step.power)}×`), ` ${step.note}`)))),
    h('p', { class: 'muted dl-small' }, 'The number after the letter says how strong it is inside its class: an X2 is twice as strong as an X1, and an M5 is half of an X1.'));
}

function yearCompare(byYear) {
  const years = Object.keys(byYear ?? {}).sort();
  if (years.length < 2) return null;
  return years.map((y) => `${y}: ${fmtNum(byYear[y].flares)} flares, ${byYear[y].x} X`).join(' · ');
}

function summaryCards(hl, months) {
  const busiest = months.reduce((a, b) => (b.C + b.M + b.X > a.C + a.M + a.X ? b : a), months[0]);
  return statGrid([
    statCard({ icon: '☀️', label: 'Solar flares', value: fmtNum(hl.flares), detail: `Busiest: ${busiest ? fmtMonth(busiest.month) : '–'}`, tone: 'gold' }),
    statCard({ icon: '💥', label: 'X-class flares', value: fmtNum(hl.xFlares), detail: yearCompare(hl.byYear) ?? 'The most powerful kind', tone: 'danger' }),
    statCard({ icon: '🌊', label: 'CMEs', value: fmtNum(hl.cmes), detail: 'Clouds of solar plasma', tone: 'violet' }),
    statCard({ icon: '☢️', label: 'SEP reports', value: fmtNum(hl.seps), detail: 'Radiation storm alerts', tone: 'rad' }),
    statCard({ icon: '🏆', label: 'Strongest flare', value: hl.strongestFlare?.classType ?? '–', detail: hl.strongestFlare ? fmtDate(hl.strongestFlare.time) : null, tone: 'mars' }),
    statCard({ icon: '🚀', label: 'Fastest CME', value: hl.fastestCme ? `${fmtNum(hl.fastestCme.speedKmS)} km/s` : '–', detail: hl.fastestCme ? `${fmtDate(hl.fastestCme.time)} · Sun to Earth in about ${Math.round(149.6e6 / hl.fastestCme.speedKmS / 3600)} h` : null, tone: 'cyan' }),
  ]);
}

function build(donki) {
  const months = monthlyActivity(donki);
  if (!months.length) return h('div', { class: 'panel empty' }, 'No solar events found in this snapshot.');
  const categories = months.map((m) => monthLabel(m.month));
  const stormIndex = months.findIndex((m) => m.month === STORM_MONTH);
  let selected = stormIndex >= 0 ? stormIndex : 0;
  const detail = h('div', { 'aria-live': 'polite' });
  const charts = h('div', { class: 'stack' });
  const labelEvery = months.length > 18 ? 3 : 1;

  const select = (i, fromChart = null) => {
    selected = i;
    mount(detail, monthDetail(donki, months[i]));
    drawCharts();
    if (fromChart == null) return;
    const card = charts.querySelectorAll('.dl-chart-card')[fromChart];
    card?.querySelectorAll('.chart-bar')[i]?.focus();
  };
  const drawCharts = () => {
    const highlight = new Set([selected, stormIndex].filter((i) => i >= 0));
    mount(charts,
      h('div', { class: 'dl-chart-card' }, barChart({
        title: 'Solar flares per month by class, 2024 to 2025',
        desc: 'Stacked bars of C, M and X class flares each month from NASA DONKI. Select a bar for details.',
        width: 720, height: 280, categories, labelEvery, highlight, yLabel: 'Flares', onBar: (i) => select(i, 0),
        series: [
          { label: 'C-class', color: COLORS.C, values: months.map((m) => m.C) },
          { label: 'M-class', color: COLORS.M, values: months.map((m) => m.M) },
          { label: 'X-class', color: COLORS.X, values: months.map((m) => m.X) },
        ],
      })),
      h('div', { class: 'dl-chart-card' }, barChart({
        title: 'CMEs and solar energetic particle reports per month',
        desc: 'Side-by-side bars of coronal mass ejections and SEP event reports each month from NASA DONKI. Select a bar for details.',
        width: 720, height: 220, categories, labelEvery, highlight, yLabel: 'Events', stacked: false, onBar: (i) => select(i, 1),
        series: [
          { label: 'CMEs', color: COLORS.cme, values: months.map((m) => m.cme) },
          { label: 'SEP reports', color: COLORS.sep, values: months.map((m) => m.sep) },
        ],
      })));
    labelBars();
  };
  const labelBars = () => {
    charts.querySelectorAll('.dl-chart-card').forEach((card) => {
      card.querySelectorAll('.chart-bar').forEach((bar, i) => {
        const m = months[i];
        if (!m) return;
        bar.setAttribute('aria-label', `${fmtMonth(m.month)}: ${m.C} C, ${m.M} M, ${m.X} X flares, ${m.cme} CMEs, ${m.sep} SEP reports`);
        bar.setAttribute('aria-pressed', String(i === selected));
      });
    });
  };
  select(selected);

  return h('div', { class: 'stack' },
    summaryCards(donkiHighlights(donki), months),
    h('div', { class: 'dl-split' },
      h('div', { class: 'stack' }, charts,
        caption('👆', 'Tap or press Enter on any month to see what the Sun did. The gold dashed box marks May 2024, the storm the game’s Solar Maximum chapter replays sol by sol.'),
        caption('🔎', 'Data detective tip: forecasters log almost every M and X flare in DONKI, but only some of the small C-class ones. That’s why C bars look short even though C flares are the most common kind.')),
      h('div', { class: 'stack' }, detail, ladder())),
    caption('🔄', 'The Sun has an 11-year cycle. NASA and NOAA announced in October 2024 that it had reached solar maximum, which is why these two years are so stormy.'));
}

export function renderStorms(container) {
  const body = h('div');
  mount(container,
    sectionHead({
      kicker: 'NASA DONKI · 2024–2025',
      title: 'Space Weather Center',
      intro: 'The Sun throws flares (flashes of light), CMEs (giant clouds of plasma) and SEPs (showers of fast particles). On Mars there is no magnetic field to protect you, so mission control watches every one.',
    }),
    h('div', { class: 'row dl-terms' },
      h('span', { class: 'faint dl-small' }, 'Words to know:'),
      termButton('solar-flare', 'solar flare'), termButton('cme', 'CME'), termButton('sep', 'SEP'),
      sourceBadge('donki', { label: 'Data' }), sourceBadge('solar-storms', { label: 'Learn more' })),
    body);
  return withData(body, { loader: loadDonki, message: 'Listening to the Sun…', build });
}
