// "A Mars year at Gale Crater": 12 seasonal bins from remsSeasonalCycle, pressure bars + temperature lines.
import { h, s } from '../../dom.js';
import { remsSeasonalCycle } from '../../../engine/dataLab.js';
import { caption } from './shared.js';

const W = 520;
const H = 300;
const PAD = { top: 26, right: 44, bottom: 58, left: 46 };
const P_MAX = 1000;
// Wide temperature range keeps both lines inside the bars, below the pressure labels.
const T_RANGE = [-90, 60];
const SEASONS = ['N. spring', 'N. summer', 'N. autumn', 'N. winter'];
const COLORS = { bar: '#b197fc', low: '#ffd166', max: '#ff9a5c', min: '#4fe3ff' };

const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;
const slot = innerW / 12;
const xMid = (i) => PAD.left + slot * i + slot / 2;
const yP = (pa) => PAD.top + innerH * (1 - pa / P_MAX);
const yT = (c) => PAD.top + innerH * (1 - (c - T_RANGE[0]) / (T_RANGE[1] - T_RANGE[0]));

function axes() {
  const pTicks = [0, 250, 500, 750, 1000];
  const tTicks = [-75, -50, -25, 0, 25];
  return s('g', { class: 'dl-cycle-axes' },
    pTicks.map((t) => [
      s('line', { x1: PAD.left, x2: W - PAD.right, y1: yP(t), y2: yP(t), class: 'chart-grid' }),
      s('text', { x: PAD.left - 6, y: yP(t) + 4, 'text-anchor': 'end', class: 'chart-tick dl-tick-p' }, String(t)),
    ]),
    tTicks.map((t) => s('text', { x: W - PAD.right + 6, y: yT(t) + 4, class: 'chart-tick dl-tick-t' }, `${t}°`)),
    s('text', { x: 4, y: PAD.top - 10, class: 'chart-label dl-tick-p' }, 'Pa'),
    s('text', { x: W - 4, y: PAD.top - 10, 'text-anchor': 'end', class: 'chart-label dl-tick-t' }, '°C'));
}

function bars(bins, lowIdx, highIdx) {
  return bins.map((b, i) => {
    if (!Number.isFinite(b.pressurePa)) return null;
    const bw = slot * 0.68;
    const top = yP(b.pressurePa);
    const tone = i === lowIdx ? COLORS.low : COLORS.bar;
    return s('g', { class: 'dl-cycle-bar' },
      s('rect', { x: xMid(i) - bw / 2, y: top, width: bw, height: yP(0) - top, rx: 4, fill: tone, opacity: i === lowIdx || i === highIdx ? 0.95 : 0.6 },
        s('title', null, `Ls ${b.lsStart}–${b.lsStart + 30}°: ${b.pressurePa} Pa, high ${b.maxC} °C, low ${b.minC} °C (${b.sols} sols)`)),
      s('text', { x: xMid(i), y: top - 5, 'text-anchor': 'middle', class: ['dl-cycle-val', i === lowIdx && 'dl-cycle-val-low'].filter(Boolean).join(' ') }, String(b.pressurePa)));
  });
}

function tempLine(bins, key, color) {
  const pts = bins.map((b, i) => ({ x: xMid(i), y: Number.isFinite(b[key]) ? yT(b[key]) : null })).filter((p) => p.y != null);
  const d = pts.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  return s('g', null,
    s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    pts.map((p) => s('circle', { cx: p.x, cy: p.y, r: 3.6, fill: color, stroke: '#040714', 'stroke-width': 1.5 })));
}

function xLabels() {
  const ticks = [0, 90, 180, 270, 360];
  return s('g', null,
    ticks.map((ls) => s('text', { x: PAD.left + (ls / 30) * slot, y: H - PAD.bottom + 16, 'text-anchor': 'middle', class: 'chart-tick' }, `${ls}°`)),
    SEASONS.map((label, q) => [
      s('line', { x1: PAD.left + q * 3 * slot + 4, x2: PAD.left + (q + 1) * 3 * slot - 4, y1: H - PAD.bottom + 26, y2: H - PAD.bottom + 26, class: 'dl-cycle-season-line' }),
      s('text', { x: PAD.left + (q * 3 + 1.5) * slot, y: H - PAD.bottom + 40, 'text-anchor': 'middle', class: 'dl-cycle-season' }, label),
    ]),
    s('text', { x: PAD.left + innerW / 2, y: H - 2, 'text-anchor': 'middle', class: 'chart-label' }, 'Season (solar longitude, Ls)'));
}

function srTable(bins) {
  return h('table', { class: 'sr-only' },
    h('caption', null, 'Average weather at Gale Crater for each 30 degrees of solar longitude'),
    h('thead', null, h('tr', null, ['Ls', 'Pressure (Pa)', 'High (°C)', 'Low (°C)', 'Sols'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', null, bins.map((b) => h('tr', null,
      h('th', { scope: 'row' }, `${b.lsStart}–${b.lsStart + 30}°`), h('td', null, b.pressurePa), h('td', null, b.maxC), h('td', null, b.minC), h('td', null, b.sols)))));
}

const indexBy = (bins, pick) => bins.reduce((best, b, i) => (Number.isFinite(b.pressurePa) && (best < 0 || pick(b.pressurePa, bins[best].pressurePa)) ? i : best), -1);

function legend() {
  return h('div', { class: 'chart-legend' },
    [['Air pressure', COLORS.bar], ['Thinnest air', COLORS.low], ['Daily high', COLORS.max], ['Nightly low', COLORS.min]]
      .map(([label, color]) => h('span', { class: 'chart-key' }, h('span', { class: 'chart-swatch', style: { background: color }, 'aria-hidden': 'true' }), label)));
}

export function seasonCycleCard(rems, highlights) {
  const bins = remsSeasonalCycle(rems);
  const lowIdx = indexBy(bins, (a, b) => a < b);
  const highIdx = indexBy(bins, (a, b) => a > b);
  if (lowIdx < 0) return null;
  const low = bins[lowIdx];
  const high = bins[highIdx];
  const dropPct = Math.round(((high.pressurePa - low.pressurePa) / high.pressurePa) * 100);
  const dayLow = highlights?.lowestPressure;
  const dayHigh = highlights?.highestPressure;
  const dayPct = dayLow && dayHigh ? Math.round(((dayHigh.pressurePa - dayLow.pressurePa) / dayHigh.pressurePa) * 100) : null;

  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'chart-svg dl-cycle-svg', role: 'img',
    'aria-label': `A Mars year at Gale Crater. Average air pressure is highest near Ls ${high.lsStart}° (${high.pressurePa} pascals) and lowest near Ls ${low.lsStart}° (${low.pressurePa} pascals), a drop of about ${dropPct} percent.`,
  }, axes(), bars(bins, lowIdx, highIdx), tempLine(bins, 'maxC', COLORS.max), tempLine(bins, 'minC', COLORS.min), xLabels());

  return h('section', { class: 'dl-chart-card dl-cycle', 'aria-labelledby': 'dl-cycle-title' },
    h('h3', { id: 'dl-cycle-title', class: 'dl-h4' }, '🪐 A Mars year at Gale Crater'),
    h('p', { class: 'faint dl-small' }, 'Every Curiosity reading sorted into 12 seasons of 30° each. Bars = air pressure, lines = average daily high and low.'),
    h('figure', { class: 'chart' }, svg, legend()),
    srTable(bins),
    caption('🧊', `In southern winter it gets so cold at Mars’s south pole that carbon dioxide, the main gas in Mars’s air, freezes into dry-ice frost on the polar cap. With part of the air frozen on the ground, the pressure all over the planet drops: the average falls about ${dropPct}% from Ls ${high.lsStart}° to Ls ${low.lsStart}°`,
      dayPct ? `, and from the thickest day (${dayHigh.pressurePa} Pa) to the thinnest (${dayLow.pressurePa} Pa) it drops about ${dayPct}%. ` : '. ',
      'In spring the ice turns back into gas and the air thickens again. A smaller dip near Ls 330°–30° comes from the north pole’s winter frost.'));
}
