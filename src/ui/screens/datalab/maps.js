// Data Lab · Map Explorer: NASA Trek mosaics with game landing sites and real historic landers.
import { h, mount } from '../../dom.js';
import { mapView, formatLatLon } from '../../mapView.js';
import { meter, sourceBadge } from '../../components/common.js';
import { sitesForBody } from '../../../data/sites.js';
import { sectionHead, signed } from './shared.js';

// Planetocentric, east-positive longitudes (west values converted to negative).
const LANDERS = {
  mars: [
    { name: 'Viking 1', year: 1976, lat: 22.27, lon: -47.95, who: 'NASA' },
    { name: 'Viking 2', year: 1976, lat: 47.64, lon: 134.29, who: 'NASA' },
    { name: 'Pathfinder', year: 1997, lat: 19.13, lon: -33.22, who: 'NASA' },
    { name: 'Spirit', year: 2004, lat: -14.57, lon: 175.47, who: 'NASA' },
    { name: 'Opportunity', year: 2004, lat: -1.95, lon: -5.53, who: 'NASA' },
    { name: 'Phoenix', year: 2008, lat: 68.22, lon: -125.75, who: 'NASA' },
    { name: 'Curiosity', year: 2012, lat: -4.59, lon: 137.44, who: 'NASA' },
    { name: 'InSight', year: 2018, lat: 4.5, lon: 135.62, who: 'NASA' },
    { name: 'Perseverance', year: 2021, lat: 18.44, lon: 77.45, who: 'NASA' },
    { name: 'Zhurong', year: 2021, lat: 25.1, lon: 109.9, who: 'CNSA' },
  ],
  moon: [
    { name: 'Apollo 11', year: 1969, lat: 0.67, lon: 23.47, who: 'NASA' },
    { name: 'Apollo 12', year: 1969, lat: -3.01, lon: -23.42, who: 'NASA' },
    { name: 'Apollo 14', year: 1971, lat: -3.65, lon: -17.47, who: 'NASA' },
    { name: 'Apollo 15', year: 1971, lat: 26.13, lon: 3.63, who: 'NASA' },
    { name: 'Apollo 16', year: 1972, lat: -8.97, lon: 15.5, who: 'NASA' },
    { name: 'Apollo 17', year: 1972, lat: 20.19, lon: 30.77, who: 'NASA' },
    { name: 'Chang’e 4', year: 2019, lat: -45.44, lon: 177.6, who: 'CNSA' },
    { name: 'Chandrayaan-3', year: 2023, lat: -69.37, lon: 32.32, who: 'ISRO' },
  ],
};

const NEAR_DEG = 4;
const isNear = (a, b) => Math.abs(a.lat - b.lat) < NEAR_DEG && Math.abs(a.lon - b.lon) < NEAR_DEG;
const BODY_LABEL = { mars: 'Mars', moon: 'Moon' };

function climateLine(site) {
  if (site.body === 'mars' && Number.isFinite(site.tempOffsetC)) {
    return site.tempOffsetC === 0
      ? 'Temperatures: exactly what Curiosity measures (this is Gale!).'
      : `Temperatures: about ${signed(site.tempOffsetC)} °C compared with Gale Crater.`;
  }
  if (Number.isFinite(site.tempDayC)) return `Temperatures: ${site.tempDayC} °C in daylight, ${site.tempNightC} °C at night.`;
  return null;
}

function meterRow(icon, label, pct, color, shown) {
  return h('div', { class: 'dl-meter-row' },
    h('span', null, `${icon} ${label}`),
    meter(pct, color, `${label}: ${shown}`),
    h('strong', null, shown));
}

function siteCard(site, landersHere) {
  if (!site) return h('div', { class: 'card dl-site empty' }, h('span', { class: 'big', 'aria-hidden': 'true' }, '📍'), 'Pick a glowing pin to inspect a landing site.');
  const climate = climateLine(site);
  return h('article', { class: ['card', 'dl-site', `dl-site-${site.body}`] },
    h('span', { class: ['kicker', site.body === 'mars' && 'mars'] }, `${BODY_LABEL[site.body]} landing site`),
    h('h3', null, site.name),
    h('p', { class: 'dl-coords' }, formatLatLon(site.lat, site.lon)),
    h('p', null, site.blurb),
    meterRow('💧', 'Ice access', site.iceAccess * 100, '#60a5fa', `${Math.round(site.iceAccess * 100)}%`),
    meterRow('🔬', 'Science value', Math.min(100, (site.science / 2) * 100), '#5eead4', `×${site.science}`),
    Number.isFinite(site.sunlit) ? meterRow('☀️', 'Sunlight', site.sunlit * 100, '#fde047', `${Math.round(site.sunlit * 100)}%`) : null,
    climate ? h('p', { class: 'muted dl-small' }, climate) : null,
    landersHere.length ? h('p', { class: 'dl-small' }, '🛬 Real landers here: ', landersHere.map((l) => `${l.name} (${l.year})`).join(', ')) : null,
    sourceBadge(site.source, { label: 'Source' }));
}

function legend(pins, onHot) {
  return h('ol', { class: 'dl-lander-list', 'aria-label': 'Historic landers shown as numbered pins' },
    pins.map((p, i) => h('li', null, h('button', {
      type: 'button',
      class: 'dl-lander',
      onmouseenter: () => onHot(i),
      onmouseleave: () => onHot(-1),
      onfocus: () => onHot(i),
      onblur: () => onHot(-1),
      onclick: () => onHot(i),
    },
    h('span', { class: 'dl-lander-num', 'aria-hidden': 'true' }, i + 1),
    h('span', null, h('strong', null, p.name), h('small', null, ` ${p.year} · ${p.who} · ${formatLatLon(p.lat, p.lon)}`))))));
}

function bodyView(body, state, rerender) {
  const sites = sitesForBody(body);
  const landers = LANDERS[body];
  const pins = landers.filter((l) => !sites.some((s) => isNear(s, l)));
  const selected = sites.find((s) => s.id === state.selected[body]) ?? null;
  const map = mapView({
    body,
    sites,
    selectedId: selected?.id ?? null,
    onSelect: (id) => rerender({ ...state, selected: { ...state.selected, [body]: id } }, id),
    extraPins: pins.map((p, i) => ({ lat: p.lat, lon: p.lon, label: `${p.name} (${p.year})`, icon: String(i + 1) })),
    label: `${BODY_LABEL[body]} map with ${sites.length} landing sites and ${pins.length} historic landers`,
  });
  const extraEls = [...map.querySelectorAll('.map-pin.extra')];
  const setHot = (i) => extraEls.forEach((el, k) => el.classList.toggle('dl-hot', k === i));
  const landersHere = selected ? landers.filter((l) => isNear(selected, l)) : [];

  return h('div', { class: 'dl-map-layout' },
    h('div', { class: 'stack' },
      h('div', { class: 'dl-map' }, map),
      h('p', { class: 'faint dl-small' },
        body === 'mars' ? 'Map: Viking MDIM 2.1 colour mosaic via NASA Mars Trek. ' : 'Map: LRO Wide Angle Camera mosaic via NASA Moon Trek. ',
        'Cyan pins are game landing sites. Numbered orange pins are real spacecraft landings. ',
        sourceBadge('trek', { label: 'Maps' }))),
    h('div', { class: 'stack' },
      h('div', { 'aria-live': 'polite' }, siteCard(selected, landersHere)),
      h('section', { class: 'card', 'aria-labelledby': `dl-landers-${body}` },
        h('h3', { id: `dl-landers-${body}`, class: 'dl-h4' }, `🛬 Who landed on the ${BODY_LABEL[body]}?`),
        legend(pins, setHot),
        landers.length > pins.length ? h('p', { class: 'faint dl-small' }, 'Landers right next to a game site are listed on that site’s card.') : null)));
}

export function renderMaps(container) {
  const body = h('div');
  const toggles = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Choose a world' });

  const rerender = (state, focusTarget = null) => {
    mount(toggles, ['mars', 'moon'].map((b) => h('button', {
      type: 'button',
      class: ['chip', `dl-chip-${b}`],
      'aria-pressed': String(state.body === b),
      onclick: () => rerender({ ...state, body: b }, 'chip'),
    }, b === 'mars' ? '🔴 Mars' : '🌕 Moon')));
    mount(body, bodyView(state.body, state, rerender));
    if (focusTarget === 'chip') toggles.querySelector('[aria-pressed="true"]')?.focus();
    else if (focusTarget) body.querySelector('.map-pin[aria-pressed="true"]')?.focus();
  };

  mount(container,
    sectionHead({
      kicker: 'NASA Trek · Global mosaics',
      title: 'Map Explorer',
      intro: 'Where would you build an outpost? Compare the game’s landing sites with every place humans and robots have actually landed.',
    }),
    toggles,
    body);
  rerender({ body: 'mars', selected: { mars: 'gale', moon: 'shackleton' } });
}
