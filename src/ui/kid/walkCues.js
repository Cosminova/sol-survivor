// Cues that send players outside: Walk 3D is where crew jobs are done by hand (bonus science and XP, repairs,
// taking cover), but nothing forces a player to open it, so many never do until a machine is already broken.
// Pure: the play screen decides where to show these and whether the player has been outside today.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { KID_MODULE_NAMES } from './words.js';
import { moduleById } from '../../data/modules.js';

export const NEW_DAY_REMINDER_DAYS = 3; // remind at the start of the first few days only, so it never nags

const moduleName = (id) => KID_MODULE_NAMES[id] ?? moduleById(id)?.name.split(' (')[0] ?? id;

/**
 * @param {object} mission
 * @param {{ visitedToday: boolean }} opts
 * @returns {{ show: boolean, urgent: string[], bonus: string }}
 */
export function walkCues(mission, { visitedToday }) {
  if (mission?.status && mission.status !== 'active') return { show: false, urgent: [], bonus: '' };
  const broken = Object.entries(mission?.broken ?? {}).filter(([, n]) => n > 0).map(([id]) => id);
  const urgent = broken.map((id) => `The ${moduleName(id)} is broken. Walk to it and hold E to fix it.`);
  const bonus = 'Do crew jobs yourself outside for bonus science and XP.';
  return { show: !visitedToday || urgent.length > 0, urgent, bonus };
}

/** The sidebar card. onGo switches the stage to Walk 3D. */
export function walkCueCard(cues, { onGo }) {
  if (!cues.show) return null;
  return h('section', { class: ['walk-cue', cues.urgent.length && 'urgent'], 'aria-label': 'Jobs outside today' },
    h('p', { class: 'walk-cue-title' }, icon(cues.urgent.length ? 'wrench' : 'rover', { size: 18 }), cues.urgent.length ? 'A job is waiting outside' : 'Jobs outside today'),
    cues.urgent.length
      ? h('ul', { class: 'walk-cue-list' }, cues.urgent.map((line) => h('li', null, line)))
      : h('p', { class: 'walk-cue-text' }, cues.bonus),
    h('button', { type: 'button', id: 'walk-cue-go', class: 'btn btn-cyan btn-sm walk-cue-go', onclick: onGo }, 'Go to Walk 3D'));
}
