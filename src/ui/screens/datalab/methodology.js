// Data Lab · Sources & Methodology: every source in SOURCES, grouped by kind, plus how the sim uses them.
import { h, mount } from '../../dom.js';
import { sourceBadge } from '../../components/common.js';
import { SOURCES } from '../../../data/sources.js';
import { loadRems, loadDonki, loadGallery } from '../../../state/nasaData.js';
import { sectionHead, fmtDate } from './shared.js';

const KINDS = [
  ['dataset', '🛰️ Datasets'],
  ['algorithm', '🧮 Algorithms'],
  ['report', '📘 Technical reports'],
  ['standard', '📏 Standards'],
  ['paper', '🔬 Science papers'],
  ['reference', '📚 Fact sheets & references'],
  ['news', '📰 NASA news'],
];

const PIPELINE = [
  { icon: '🌡️', title: 'Weather by season', source: 'rems', text: 'Each game sol looks up Curiosity’s real REMS readings for the same season (Ls), then adjusts for your site’s latitude and height.' },
  { icon: '☀️', title: 'Storms replayed by date', source: 'donki', text: 'Real 2024–2025 solar flares and SEP radiation events from DONKI are replayed sol by sol on the dates they happened.' },
  { icon: '🫁', title: 'Life support rates', source: 'bvad', text: 'Oxygen, water, food and CO₂ per astronaut per day come from NASA’s life support handbook (BVAD).' },
  { icon: '☢️', title: 'Radiation doses', source: 'rad-2014', text: 'Daily doses use Curiosity RAD measurements on Mars and Chang’e-4 LND on the Moon, checked against NASA’s career limit.' },
  { icon: '🗺️', title: 'Real maps', source: 'trek', text: 'Landing site maps are stitched from NASA Mars Trek and Moon Trek global mosaics.' },
  { icon: '🕰️', title: 'Mars time', source: 'mars24', text: 'Sols, Mars Years and seasons use NASA GISS’s Mars24 formulas, the same math mission planners use.' },
];

function groupByKind() {
  const entries = Object.entries(SOURCES).map(([id, src]) => ({ id, ...src }));
  const known = KINDS.map(([kind, label]) => ({ kind, label, items: entries.filter((e) => e.kind === kind) }));
  const others = entries.filter((e) => !KINDS.some(([kind]) => kind === e.kind));
  return [...known, { kind: 'other', label: '📎 Other', items: others }].filter((g) => g.items.length);
}

function sourceItem(src) {
  return h('li', { class: 'dl-source' },
    h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', class: 'dl-source-title' },
      src.title, h('span', { class: 'sr-only' }, ' (opens in a new tab)'), h('span', { 'aria-hidden': 'true' }, ' ↗')),
    h('span', { class: 'faint dl-small' }, src.org),
    src.use ? h('span', { class: 'dl-source-use' }, h('strong', null, 'We use it for: '), src.use) : null);
}

function snapshotStatus(result) {
  if (result.status !== 'fulfilled') return 'not loaded on this device';
  return result.value?.fetched ? `archived ${fmtDate(result.value.fetched)}` : 'bundled with the game';
}

function snapshotNote() {
  const list = h('ul', { class: 'dl-snapshots' }, h('li', { class: 'faint' }, 'Checking snapshot dates…'));
  const rows = [['Curiosity REMS weather', loadRems], ['DONKI space weather', loadDonki], ['NASA photos', loadGallery]];
  Promise.allSettled(rows.map(([, load]) => load())).then((results) => {
    mount(list, results.map((r, i) => h('li', null, h('strong', null, rows[i][0]), `: ${snapshotStatus(r)}`)));
  });
  return h('section', { class: 'card dl-offline', 'aria-labelledby': 'dl-offline-title' },
    h('h3', { id: 'dl-offline-title' }, '📦 Archived snapshot · works offline'),
    h('p', { class: 'muted' }, 'We downloaded copies of the NASA data and bundled them with the game, so it runs on a Chromebook with no internet. The numbers won’t update live, but every one of them came from a real NASA source listed below.'),
    list);
}

export function renderMethodology(container) {
  const groups = groupByKind();
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  mount(container,
    sectionHead({
      kicker: `${total} sources`,
      title: 'Sources & Methodology',
      intro: 'Good scientists show their work. Here is every NASA dataset, paper and fact sheet behind the numbers in Sol Survivor.',
    }),
    h('div', { class: 'dl-split' },
      h('section', { class: 'card', 'aria-labelledby': 'dl-how-title' },
        h('h3', { id: 'dl-how-title' }, '⚙️ How the simulation uses real data'),
        h('ol', { class: 'dl-pipeline' }, PIPELINE.map((step) => h('li', null,
          h('span', { class: 'dl-pipeline-icon', 'aria-hidden': 'true' }, step.icon),
          h('div', null, h('strong', null, step.title), h('p', { class: 'muted' }, step.text), sourceBadge(step.source, { label: 'Source' })))))),
      snapshotNote()),
    groups.map((g) => h('section', { class: 'dl-source-group', 'aria-labelledby': `dl-kind-${g.kind}` },
      h('h3', { id: `dl-kind-${g.kind}`, class: 'panel-title' }, `${g.label} (${g.items.length})`),
      h('ul', { class: 'dl-source-list' }, g.items.map(sourceItem)))));
}
