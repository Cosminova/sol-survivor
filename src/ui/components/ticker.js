// Ticker: a read-only marquee along the bottom of the viewport. On the play screen it shows the player's
// own mission values ("Your mission"); elsewhere it shows facts from the bundled, archived NASA datasets
// ("From NASA records") plus, only when NASA answered in this browser, one item that is labelled live.
// Holds no game state. Static (no scrolling) when motion is reduced.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { MARS, MOON, RADIATION } from '../../data/constants.js';
import { marsTime, seasonName, lightDelaySeconds } from '../../engine/marsTime.js';
import { loadRems, loadDonki } from '../../state/nasaData.js';
import { onLive, liveTickerItem } from '../../live/liveData.js';

const SECONDS_PER_ITEM = 5;
// Off the play screen every readout comes from saved NASA datasets or simple calendar math: say so.
const RECORDS_TAG = 'From NASA records';
const MISSION_TAG = 'Your mission';
let els = null;
let override = null;
let datasetItems = [];
let liveItem = null;
let signature = '';

const fmtDelay = (sec) => (sec < 60 ? `${sec.toFixed(1)} s` : `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`);

function liveItems() {
  const now = new Date();
  const { ls, marsYear } = marsTime(now);
  return [
    { label: 'Mars season today (worked out from the calendar)', value: `Ls ${Math.round(ls)}° · ${seasonName(ls, true)} (north) · Mars year ${marsYear}` },
    { label: 'Radio from Earth to Mars today (worked out)', value: `${fmtDelay(lightDelaySeconds(now))} one way` },
    { label: 'Radio from Earth to the Moon', value: `${MOON.lightSeconds} s one way` },
    { label: 'One Mars day (a sol)', value: `${MARS.dayHours.toFixed(2)} hours` },
    { label: 'Gravity', value: `Mars ${Math.round(MARS.gravity * 100)}% · Moon ${Math.round(MOON.gravity * 100)}% of Earth` },
    { label: 'Astronaut radiation limit', value: `${RADIATION.careerLimitMsv} mSv in a whole career` },
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
    { label: 'Curiosity rover weather records', value: `${rows.length.toLocaleString()} sols of Mars weather saved` },
    { label: 'Newest saved Curiosity reading', value: `sol ${last[col.sol]} · ${last[col.earthDate]} · ${last[col.minC]}° to ${last[col.maxC]}°C · ${last[col.pressurePa]} Pa` },
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
    { label: `Solar flares in NASA records ${span}`, value: `${flares.length.toLocaleString()} recorded · ${xClass} of the biggest kind (X-class)` },
    { label: 'Giant Sun eruptions recorded (CMEs)', value: (donki.cmes?.length ?? 0).toLocaleString() },
    { label: 'Solar radiation storms recorded', value: (donki.seps?.length ?? 0).toLocaleString() },
  ];
}

const group = (items, hidden) => h('ul', { class: 'ticker-group', 'aria-hidden': hidden ? 'true' : null },
  items.map((it) => h('li', { class: ['ticker-item', it.tone] },
    h('span', { class: 'ticker-label' }, it.label), h('span', { class: 'ticker-value' }, it.value))));

function render() {
  if (!els) return;
  const items = override ?? [...(liveItem ? [liveItem] : []), ...liveItems(), ...datasetItems];
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
  const tagText = h('span', { class: 'ticker-tag-text' }, RECORDS_TAG);
  const root = h('aside', { class: 'ticker', 'aria-label': RECORDS_TAG },
    h('span', { class: 'ticker-tag' }, icon('status', { size: 16 }), tagText),
    h('div', { class: 'ticker-window' }, track));
  els = { root, track, tagText };
  render();
  Promise.allSettled([loadRems(), loadDonki()]).then(([rems, donki]) => {
    datasetItems = [
      ...(rems.status === 'fulfilled' ? remsItems(rems.value) : []),
      ...(donki.status === 'fulfilled' ? donkiItems(donki.value) : []),
    ];
    render();
  });
  // One real-time readout from NASA DONKI; absent (not faked) when the network is down.
  onLive((live) => {
    const item = liveTickerItem(live);
    liveItem = item ? { ...item, tone: 'live' } : null;
    render();
  });
  return root;
}

// setTickerItems([{ label, value, tone? }]) shows live readouts; setTickerItems(null) returns to dataset facts.
export function setTickerItems(items) {
  override = items?.length ? items : null;
  if (els) {
    const tag = override ? MISSION_TAG : RECORDS_TAG;
    els.tagText.textContent = tag;
    els.root.setAttribute('aria-label', tag);
  }
  render();
}
