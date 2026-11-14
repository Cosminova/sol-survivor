// Reusable responsive SVG charts: lineChart, barChart (stacked), sparkline. No dependencies.
import { h, s } from './dom.js';

const PAD = { top: 16, right: 16, bottom: 36, left: 52 };

function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => span / m <= count) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 1e-6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const extent = (values) => values.reduce(([lo, hi], v) => [Math.min(lo, v), Math.max(hi, v)], [Infinity, -Infinity]);

function legend(series) {
  return h('div', { class: 'chart-legend' }, series.filter((x) => x.label).map((x) => h('span', { class: 'chart-key' },
    h('span', { class: 'chart-swatch', style: { background: x.color }, 'aria-hidden': 'true' }), x.label)));
}

function frame({ title, desc, width, height }) {
  return s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': title, preserveAspectRatio: 'xMidYMid meet' },
    desc ? s('desc', null, desc) : null);
}

function axes(svg, { width, height, x, y, xTicks, yTicks, xFormat, yFormat, xLabel, yLabel }) {
  const g = s('g', { class: 'chart-axes' });
  for (const t of yTicks) {
    g.append(s('line', { x1: PAD.left, x2: width - PAD.right, y1: y(t), y2: y(t), class: 'chart-grid' }));
    g.append(s('text', { x: PAD.left - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'chart-tick' }, yFormat(t)));
  }
  for (const t of xTicks) {
    g.append(s('text', { x: x(t), y: height - PAD.bottom + 18, 'text-anchor': 'middle', class: 'chart-tick' }, xFormat(t)));
  }
  if (xLabel) g.append(s('text', { x: (PAD.left + width - PAD.right) / 2, y: height - 4, 'text-anchor': 'middle', class: 'chart-label' }, xLabel));
  if (yLabel) g.append(s('text', { x: 12, y: PAD.top + (height - PAD.top - PAD.bottom) / 2, transform: `rotate(-90 12 ${PAD.top + (height - PAD.top - PAD.bottom) / 2})`, 'text-anchor': 'middle', class: 'chart-label' }, yLabel));
  svg.append(g);
}

// series: [{ label, color, values: [{x, y}], area?: bool, dashed?: bool }]
// bands: [{ from, to, color, label }] shaded x ranges; markers: [{ x, label, color }]
export function lineChart({
  series, title = 'Chart', desc, width = 640, height = 260, xLabel, yLabel,
  xFormat = (v) => String(Math.round(v)), yFormat = (v) => String(v), xDomain, yDomain, bands = [], markers = [], yZero = false,
}) {
  const points = series.flatMap((x) => x.values).filter((p) => p && Number.isFinite(p.y));
  const [x0, x1] = xDomain ?? extent(points.map((p) => p.x));
  let [y0, y1] = yDomain ?? extent(points.map((p) => p.y));
  if (yZero) y0 = Math.min(0, y0);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const yTicks = niceTicks(y0, y1, 5);
  y0 = Math.min(y0, yTicks[0]);
  y1 = Math.max(y1, yTicks[yTicks.length - 1]);
  const x = (v) => PAD.left + ((v - x0) / (x1 - x0 || 1)) * (width - PAD.left - PAD.right);
  const y = (v) => height - PAD.bottom - ((v - y0) / (y1 - y0 || 1)) * (height - PAD.top - PAD.bottom);

  const svg = frame({ title, desc, width, height });
  for (const b of bands) {
    svg.append(s('rect', { x: x(Math.max(b.from, x0)), y: PAD.top, width: Math.max(0, x(Math.min(b.to, x1)) - x(Math.max(b.from, x0))), height: height - PAD.top - PAD.bottom, fill: b.color, class: 'chart-band' }));
    if (b.label) svg.append(s('text', { x: x(Math.max(b.from, x0)) + 4, y: PAD.top + 12, class: 'chart-band-label' }, b.label));
  }
  axes(svg, { width, height, x, y, xTicks: niceTicks(x0, x1, Math.max(3, Math.round(width / 110))), yTicks, xFormat, yFormat, xLabel, yLabel });

  series.forEach((ser, i) => {
    const pts = ser.values.filter((p) => p && Number.isFinite(p.y));
    if (!pts.length) return;
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
    if (ser.area) {
      const area = `${d}L${x(pts[pts.length - 1].x).toFixed(1)},${y(y0)}L${x(pts[0].x).toFixed(1)},${y(y0)}Z`;
      svg.append(s('path', { d: area, fill: ser.color, opacity: 0.16 }));
    }
    svg.append(s('path', { d, fill: 'none', stroke: ser.color, 'stroke-width': ser.width ?? 2.2, 'stroke-dasharray': ser.dashed ? '5 4' : null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'chart-line', style: `--i:${i}` }));
    if (pts.length <= 40) {
      for (const p of pts) svg.append(s('circle', { cx: x(p.x), cy: y(p.y), r: 2.6, fill: ser.color }, s('title', null, `${ser.label ?? ''} ${xFormat(p.x)}: ${yFormat(p.y)}`)));
    }
  });
  for (const m of markers) {
    if (m.x < x0 || m.x > x1) continue;
    svg.append(s('line', { x1: x(m.x), x2: x(m.x), y1: PAD.top, y2: height - PAD.bottom, stroke: m.color ?? '#ffd166', 'stroke-dasharray': '3 3', 'stroke-width': 1.5 }));
    if (m.label) svg.append(s('text', { x: x(m.x) + 4, y: PAD.top + 24, class: 'chart-marker-label', fill: m.color ?? '#ffd166' }, m.label));
  }
  return h('figure', { class: 'chart' }, svg, legend(series));
}

// categories: string[]; series: [{ label, color, values: number[] }]; highlight: Set of category indices
export function barChart({
  categories, series, title = 'Bar chart', desc, width = 640, height = 260, yLabel, stacked = true,
  highlight = new Set(), labelEvery = 1, yFormat = (v) => String(v), onBar,
}) {
  const totals = categories.map((_, i) => (stacked ? series.reduce((sum, ser) => sum + (ser.values[i] ?? 0), 0) : Math.max(...series.map((ser) => ser.values[i] ?? 0))));
  const max = Math.max(1, ...totals);
  const yTicks = niceTicks(0, max, 4);
  const top = Math.max(max, yTicks[yTicks.length - 1]);
  const innerW = width - PAD.left - PAD.right;
  const slot = innerW / categories.length;
  const barW = Math.max(2, slot * 0.72);
  const y = (v) => height - PAD.bottom - (v / top) * (height - PAD.top - PAD.bottom);
  const svg = frame({ title, desc, width, height });
  const g = s('g', { class: 'chart-axes' });
  for (const t of yTicks) {
    g.append(s('line', { x1: PAD.left, x2: width - PAD.right, y1: y(t), y2: y(t), class: 'chart-grid' }));
    g.append(s('text', { x: PAD.left - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'chart-tick' }, yFormat(t)));
  }
  if (yLabel) g.append(s('text', { x: 12, y: height / 2, transform: `rotate(-90 12 ${height / 2})`, 'text-anchor': 'middle', class: 'chart-label' }, yLabel));
  svg.append(g);

  categories.forEach((cat, i) => {
    const cx = PAD.left + slot * i + (slot - barW) / 2;
    if (highlight.has(i)) svg.append(s('rect', { x: PAD.left + slot * i, y: PAD.top, width: slot, height: height - PAD.top - PAD.bottom, class: 'chart-highlight' }));
    let base = 0;
    const group = s('g', { class: 'chart-bar', tabindex: onBar ? 0 : null, role: onBar ? 'button' : null });
    series.forEach((ser, k) => {
      const v = ser.values[i] ?? 0;
      if (!v) return;
      const bx = stacked ? cx : cx + (barW / series.length) * k;
      const bw = stacked ? barW : barW / series.length;
      const yTop = y(stacked ? base + v : v);
      group.append(s('rect', { x: bx, y: yTop, width: bw, height: Math.max(0, y(stacked ? base : 0) - yTop), fill: ser.color, rx: Math.min(3, bw / 3) }, s('title', null, `${cat} · ${ser.label}: ${yFormat(v)}`)));
      if (stacked) base += v;
    });
    if (onBar) {
      group.addEventListener('click', () => onBar(i));
      group.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBar(i); } });
    }
    svg.append(group);
    if (i % labelEvery === 0) svg.append(s('text', { x: cx + barW / 2, y: height - PAD.bottom + 16, 'text-anchor': 'middle', class: ['chart-tick', highlight.has(i) && 'chart-tick-hot'].filter(Boolean).join(' ') }, cat));
  });
  return h('figure', { class: 'chart' }, svg, legend(series));
}

export function sparkline(values, { color = '#4fe3ff', width = 120, height = 32, label = 'trend', min, max } = {}) {
  const clean = values.filter(Number.isFinite);
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'sparkline', role: 'img', 'aria-label': label, preserveAspectRatio: 'none' });
  if (clean.length < 2) return svg;
  const [lo0, hi0] = extent(clean);
  const lo = min ?? lo0;
  const hi = max ?? hi0;
  const x = (i) => (i / (clean.length - 1)) * width;
  const y = (v) => height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 4);
  const d = clean.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  svg.append(s('path', { d: `${d}L${width},${height}L0,${height}Z`, fill: color, opacity: 0.15 }));
  svg.append(s('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.8, 'vector-effect': 'non-scaling-stroke' }));
  svg.append(s('circle', { cx: x(clean.length - 1), cy: y(clean[clean.length - 1]), r: 2.4, fill: color }));
  return svg;
}
