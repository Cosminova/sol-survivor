// "MISSION TELEMETRY" ticker: a read-only marquee along the bottom of the viewport. On the play screen
// it shows live mission values (set from the dashboard's draw cycle); elsewhere it shows facts computed
// from the bundled NASA datasets. Holds no game state. Static (no scrolling) when motion is reduced.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { MARS, MOON, RADIATION } from '../../data/constants.js';
import { marsTime, seasonName, lightDelaySeconds } from '../../engine/marsTime.js';
import { loadRems, loadDonki } from '../../state/nasaData.js';

const SECONDS_PER_ITEM = 5;
let els = null;
let override = null;
let datasetItems = [];
let signature = '';

const fmtDelay = (sec) => (sec < 60 ? `${sec.toFixed(1)} s` : `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`);

function liveItems() {
  const now = new Date();
  const { ls, marsYear } = marsTime(now);
  return [
    { label: 'Mars season now', value: `Ls ${Math.round(ls)}° · ${seasonName(ls, true)} (north) · Mars year ${marsYear}` },
    { label: 'Earth to Mars signal', value: `${fmtDelay(lightDelaySeconds(now))} one way` },
    { label: 'Earth to Moon signal', value: `${MOON.lightSeconds} s one way` },
    { label: 'Mars sol length', value: `${MARS.dayHours.toFixed(2)} h` },
    { label: 'Gravity', value: `Mars ${Math.round(MARS.gravity * 100)}% · Moon ${Math.round(MOON.gravity * 100)}% of Earth` },
    { label: 'Career dose limit', value: `${RADIATION.careerLimitMsv} mSv` },
  ];
}

function remsItems(rems) {
  const rows = rems?.rows ?? [];
  if (!rows.length) return [];
  const col = Object.fromEntries((rems.columns ?? []).map((name, i) => [name, i]));
  const last = rows[rows.length - 1];
  const temps = rows.filter((r) => r[col.minC] != null && r[col.maxC] != null);
  const coldest = temps.reduce((lo, r) => Math.min(lo, r[col.minC]), Infinity);
  const warmest = temps.reduce((hi, r) => Math.max(hi, r[col.maxC]), -Infinity);
  const items = [
    { label: 'Curiosity REMS archive', value: `${rows.length.toLocaleString()} sols of Mars weather` },
    { label: 'Latest REMS reading', value: `sol ${last[col.sol]} · ${last[col.earthDate]} · ${last[col.minC]}° to ${last[col.maxC]}°C · ${last[col.pressurePa]} Pa` },
  ];
  if (temps.length) items.push({ label: 'Gale Crater extremes', value: `${coldest}°C to ${warmest}°C` });
  return items;
}

function donkiItems(donki) {
  const flares = donki?.flares ?? [];
  if (!flares.length) return [];
  const xClass = flares.filter((f) => String(f.c).startsWith('X')).length;
  const span = donki.range?.length === 2 ? `${donki.range[0].slice(0, 4)} to ${donki.range[1].slice(0, 4)}` : 'archive';
  return [
    { label: `DONKI solar flares ${span}`, value: `${flares.length.toLocaleString()} recorded · ${xClass} X-class` },
    { label: 'Coronal mass ejections', value: (donki.cmes?.length ?? 0).toLocaleString() },
    { label: 'Solar particle events', value: (donki.seps?.length ?? 0).toLocaleString() },
  ];
}

const group = (items, hidden) => h('ul', { class: 'ticker-group', 'aria-hidden': hidden ? 'true' : null },
  items.map((it) => h('li', { class: ['ticker-item', it.tone] },
    h('span', { class: 'ticker-label' }, it.label), h('span', { class: 'ticker-value' }, it.value))));

function render() {
  if (!els) return;
  const items = override ?? [...liveItems(), ...datasetItems];
  const next = items.map((it) => `${it.label}=${it.value}|${it.tone ?? ''}`).join(';');
  if (next === signature) return;
  const sameShape = items.length * 2 === els.track.querySelectorAll('.ticker-item').length
    && items.every((it, i) => els.track.querySelectorAll('.ticker-label')[i]?.textContent === it.label);
  signature = next;
  if (sameShape) {
    // Same readouts, new numbers: patch the text in place so the marquee does not restart.
    els.track.querySelectorAll('.ticker-group').forEach((ul) => {
      [...ul.children].forEach((li, i) => {
        li.className = ['ticker-item', items[i].tone].filter(Boolean).join(' ');
        li.lastElementChild.textContent = items[i].value;
      });
    });
    return;
  }
  els.track.replaceChildren(group(items, false), group(items, true));
  els.track.style.setProperty('--ticker-dur', `${Math.max(30, items.length * SECONDS_PER_ITEM)}s`);
}

// Builds the ticker bar once. Call from the app shell.
export function createTicker() {
  const track = h('div', { class: 'ticker-track' });
  const root = h('aside', { class: 'ticker', 'aria-label': 'Mission telemetry' },
    h('span', { class: 'ticker-tag' }, icon('status', { size: 16 }), h('span', { class: 'ticker-tag-text' }, 'Mission telemetry')),
    h('div', { class: 'ticker-window' }, track));
  els = { root, track };
  render();
  Promise.allSettled([loadRems(), loadDonki()]).then(([rems, donki]) => {
    datasetItems = [
      ...(rems.status === 'fulfilled' ? remsItems(rems.value) : []),
      ...(donki.status === 'fulfilled' ? donkiItems(donki.value) : []),
    ];
    render();
  });
  return root;
}

// setTickerItems([{ label, value, tone? }]) shows live readouts; setTickerItems(null) returns to dataset facts.
export function setTickerItems(items) {
  override = items?.length ? items : null;
  render();
}
