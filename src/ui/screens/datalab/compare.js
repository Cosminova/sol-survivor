// Data Lab · Compare Worlds: Earth, Moon and Mars side by side, with gravity and size visuals.
import { h, s, mount } from '../../dom.js';
import { sourceBadge, termButton } from '../../components/common.js';
import { COMPARISON, COMPARISON_ROWS, comparisonSource } from '../../../data/facts.js';
import { SOURCES } from '../../../data/sources.js';
import { MARS, MOON } from '../../../data/constants.js';
import { lightDelaySeconds } from '../../../engine/marsTime.js';
import { sectionHead, caption } from './shared.js';

const WORLDS = [
  { key: 'earth', name: 'Earth', icon: '🌍', color: '#60a5fa', g: 1, diameterKm: 12756 },
  { key: 'moon', name: 'Moon', icon: '🌕', color: '#cfd8ea', g: MOON.gravity, diameterKm: 3475 },
  { key: 'mars', name: 'Mars', icon: '🔴', color: '#ff7a3d', g: MARS.gravity, diameterKm: 6792 },
];
const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

const minutes = (sec) => `${Math.floor(sec / 60)} min ${String(Math.round(sec % 60)).padStart(2, '0')} s`;
const shortOrg = (src) => src.org.split(/[,(]/)[0].trim();

function formatValue(v, unit) {
  if (v == null) return '–';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return `${NUMBER.format(v)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`;
  return String(v);
}

function noteFor(row, world) {
  const note = COMPARISON[world.key]?.notes?.[row.key];
  if (note) return note;
  return row.key === 'lightDelay' && world.key === 'mars' ? `Today: ${minutes(lightDelaySeconds(new Date()))}` : null;
}

// Compact per-cell citation; the full badges are listed under the table.
function sourceLink(id) {
  const src = SOURCES[id];
  if (!src) return null;
  return h('a', { class: 'dl-src-link', href: src.url, target: '_blank', rel: 'noopener noreferrer', title: `${src.title} (${src.org})` },
    h('span', { 'aria-hidden': 'true' }, '🛰️ '), shortOrg(src), h('span', { class: 'sr-only' }, ` source: ${src.title} (opens in a new tab)`));
}

function infoChip(term, label) {
  const chip = termButton(term, 'ⓘ');
  chip?.setAttribute('aria-label', `Explain: ${label}`);
  chip?.classList.add('dl-info-chip');
  return chip;
}

function cell(row, world) {
  const note = noteFor(row, world);
  return h('td', { class: `dl-col-${world.key}` },
    h('span', { class: 'dl-cell-value' }, formatValue(COMPARISON[world.key]?.[row.key], row.unit)),
    note ? h('small', { class: 'dl-cell-note' }, note) : null,
    row.sourceBy ? sourceLink(comparisonSource(row, world.key)) : null);
}

function rowHeader(row) {
  return h('th', { scope: 'row' },
    row.label, row.term ? [' ', infoChip(row.term, row.label)] : null,
    !row.sourceBy && row.source ? h('span', { class: 'dl-src-under' }, sourceLink(row.source)) : null);
}

function table() {
  return h('div', { class: 'table-wrap dl-compare-wrap' },
    h('table', { class: 'table dl-compare' },
      h('caption', { class: 'sr-only' }, 'Earth, Moon and Mars compared, with the source of each number'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Fact'),
        WORLDS.map((w) => h('th', { scope: 'col', class: `dl-col-${w.key}` }, h('span', { 'aria-hidden': 'true' }, `${w.icon} `), w.name)))),
      h('tbody', null, COMPARISON_ROWS.map((row) => h('tr', null, rowHeader(row), WORLDS.map((w) => cell(row, w)))))));
}

// One badge per organisation keeps the footer short.
function sourceRow() {
  const ids = [...new Set(COMPARISON_ROWS.flatMap((row) => WORLDS.map((w) => comparisonSource(row, w.key))))].filter((id) => SOURCES[id]);
  const byOrg = ids.filter((id, i) => ids.findIndex((other) => SOURCES[other].org === SOURCES[id].org) === i);
  return h('div', { class: 'row' }, h('span', { class: 'faint dl-small' }, 'Sources:'), byOrg.map((id) => sourceBadge(id, { label: 'Data' })));
}

function gravityTrio() {
  const backpack = 30;
  return h('section', { class: 'card dl-gravity', 'aria-labelledby': 'dl-gravity-title' },
    h('h3', { id: 'dl-gravity-title' }, '🎒 How heavy is a 30 kg backpack?'),
    h('div', { class: 'dl-gravity-bars' }, WORLDS.map((w) => h('div', { class: 'dl-gbar', style: { '--g': w.g, '--c': w.color } },
      h('span', { class: 'dl-gbar-value' }, `${(backpack * w.g).toFixed(1)} kg`),
      h('span', { class: 'dl-gbar-fill', 'aria-hidden': 'true' }),
      h('span', { class: 'dl-gbar-name' }, `${w.icon} ${w.name}`),
      h('span', { class: 'faint dl-small' }, `${w.g} g`)))),
    caption('🦘', `It is the same backpack everywhere. Its mass doesn’t change, but weaker gravity pulls on it less. On the Moon it feels like ${(backpack * MOON.gravity).toFixed(1)} kg, so astronauts bounced around in big hops!`),
    h('div', { class: 'row' }, termButton('gravity', 'gravity'), termButton('low-gravity', 'low gravity')));
}

function sizeDiagram() {
  const gap = 24;
  const radii = WORLDS.map((w) => (w.diameterKm / WORLDS[0].diameterKm) * 90);
  const placed = WORLDS.map((w, i) => {
    const before = radii.slice(0, i).reduce((sum, r) => sum + r * 2 + gap, 0);
    return { ...w, r: radii[i], cx: before + radii[i] };
  });
  const width = radii.reduce((sum, r) => sum + r * 2, 0) + gap * (radii.length - 1);
  const svg = s('svg', { viewBox: `0 0 ${width} 200`, class: 'dl-size-svg', role: 'img', 'aria-label': 'Earth, Moon and Mars drawn to the same scale. Mars is about half as wide as Earth; the Moon is about a quarter.' },
    placed.map((w) => s('g', null,
      s('circle', { cx: w.cx, cy: 95, r: w.r, fill: w.color, opacity: 0.9 }),
      s('text', { x: w.cx, y: 196, 'text-anchor': 'middle', class: 'dl-size-label' }, w.name))));
  return h('section', { class: 'card dl-size', 'aria-labelledby': 'dl-size-title' },
    h('h3', { id: 'dl-size-title' }, '📏 Drawn to scale'),
    svg,
    h('p', { class: 'muted dl-small' }, 'Mars is about half as wide as Earth. The Moon is about a quarter as wide. You could fit about 6 Mars-sized balls inside Earth!'));
}

export function renderCompare(container) {
  mount(container,
    sectionHead({
      kicker: 'Planetary fact sheets',
      title: 'Compare Worlds',
      intro: 'Living on the Moon or Mars means planning for very different gravity, days, air and temperatures. Here is how they stack up against home.',
    }),
    h('div', { class: 'dl-split' },
      h('div', { class: 'stack' }, h('div', { class: 'panel dl-flat' }, table()), sourceRow()),
      h('div', { class: 'stack' }, gravityTrio(), sizeDiagram())));
}
