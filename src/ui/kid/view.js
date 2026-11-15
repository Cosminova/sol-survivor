// Cadet view / Expert view helpers. Cadet view is a presentation layer only: the same mission, the
// same numbers, fewer things on screen at once. Expert view shows everything.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { getState, setSettings } from '../../state/store.js';
import { SOURCES } from '../../data/sources.js';
import { niceDate } from './words.js';

// Short, sayable names for the datasets behind the "Real NASA data" labels.
const SOURCE_NAMES = { rems: 'Curiosity rover (REMS)', donki: 'NASA storm list (DONKI)', trek: 'NASA Trek maps' };

// The tutorial always runs in Cadet view, whatever the saved setting says (the setting itself is untouched).
let forceCadet = false;
export const setForceCadet = (on) => { forceCadet = Boolean(on); };

export const isExpertView = () => !forceCadet && Boolean(getState().settings.expertView);

// Open/closed state of each "More details" box, kept across redraws (the play screen redraws often).
const openState = new Map();

// A clearly labelled disclosure. id must be stable; children are any nodes.
export function moreDetails(id, label, ...children) {
  return h('details', {
    class: 'kid-more',
    open: openState.get(id) ? true : null,
    ontoggle: (e) => openState.set(id, e.currentTarget.open),
  },
  h('summary', null, icon('info', { size: 18 }), h('span', null, label)),
  h('div', { class: 'kid-more-body' }, ...children));
}

// "Real NASA data, recorded on <date>": shown at every moment that replays archived NASA measurements.
// Never says "live". sourceId links to the dataset in src/data/sources.js.
export function realDataLabel(date, sourceId, what) {
  const src = SOURCES[sourceId];
  const text = `Real NASA data, recorded on ${niceDate(date)}`;
  return h('span', { class: 'real-data' },
    icon('satellite', { size: 16 }),
    h('span', null, what ? `${what}: ` : '', text),
    src ? h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', class: 'real-data-src' },
      `Source: ${SOURCE_NAMES[sourceId] ?? src.org.split(',')[0]}`, h('span', { class: 'sr-only' }, ' (opens in a new tab)')) : null);
}

// The Cadet/Expert switch. A real button with a visible label and state, usable in the play header and Settings.
export function viewSwitch({ id = 'view-switch' } = {}) {
  const expert = isExpertView();
  return h('button', {
    type: 'button',
    id,
    class: ['view-switch', expert && 'on'],
    role: 'switch',
    'aria-checked': String(expert),
    title: expert ? 'Showing every number. Switch to the simple Cadet view.' : 'Showing the simple Cadet view. Switch to see every number.',
    // Screens redraw synchronously on the settings change, so hand focus to the fresh switch.
    onclick: () => { setSettings({ expertView: !expert }); document.getElementById(id)?.focus(); },
  },
  h('span', { class: 'view-switch-track', 'aria-hidden': 'true' }, h('span', { class: 'view-switch-knob' })),
  h('span', { class: 'view-switch-text' }, 'Expert view'),
  h('span', { class: 'view-switch-state' }, expert ? 'On' : 'Off'));
}
