// Cadet view: the head and foot of the ONE sidebar. The head says which day it is (and, on phones, folds the
// plan sheet away). The foot holds the small tools: the real Sun, the crew, Mission details, Tutorial and the
// Expert view switch. The meters and the Today plan (meters.js, today.js) sit between them.
import { h } from '../../dom.js';
import { icon } from '../../icons.js';
import { openModal } from '../../components/modal.js';
import { liveSunCard } from '../../live/liveSun.js';
import { viewSwitch } from '../../kid/view.js';
import { skyWord } from '../../kid/words.js';

const SUN_WORD = { calm: 'Calm', busy: 'Busy', stormy: 'Stormy' };

function sky(m) {
  const e = m.env;
  if (m.today?.sep) return { icon: 'alert', text: 'Solar storm', warn: true };
  if (m.config.body === 'mars') return { icon: 'wind', text: skyWord(e, m), warn: Boolean(e.storm || e.tau >= 2) };
  return e.lit ? { icon: 'sun', text: 'Sun is up', warn: false } : { icon: 'moon', text: 'Night', warn: true };
}

/** The small "Real Sun today" chip. Opens the full card from the live NASA data layer. */
export function realSunChip(live) {
  const level = live?.sun?.level;
  return h('button', {
    type: 'button',
    id: 'real-sun-chip',
    class: ['kid-tool', 'real-sun-chip', level],
    'aria-haspopup': 'dialog',
    onclick: () => openModal({ title: 'The real Sun today', className: 'real-sun-modal', content: liveSunCard(live, { compact: false }) }),
  }, icon('sun', { size: 20 }), h('span', { class: 'real-sun-label' }, 'Real Sun today'), level ? h('strong', { class: 'real-sun-level' }, SUN_WORD[level] ?? level) : null);
}

/**
 * @param {object} m mission
 * @param {{ live: object|null, sheetOpen: boolean, onSheet: () => void }} opts
 */
export function sideHead(m, { live, sheetOpen, onSheet }) {
  const total = m.config.targetSols;
  const pct = Math.min(100, (100 * m.sol) / total);
  // While planning, the player is choosing for the day that is about to start.
  const dayNow = m.status === 'active' && m.phase === 'plan' ? Math.min(m.sol + 1, total) : m.sol;
  const s = sky(m);
  return h('header', { class: 'kid-side-head' },
    h('h1', { class: 'kid-side-title' }, m.config.title),
    realSunChip(live),
    h('div', { class: 'kid-side-day' },
      h('span', { class: 'kid-day-text' }, 'Day ', h('strong', null, String(dayNow)), ` of ${total}`),
      h('span', { class: ['kid-sky', s.warn && 'warn'] }, icon(s.icon, { size: 18 }), s.text),
      h('span', { class: 'kid-sci' }, icon('flask', { size: 18 }), h('span', { class: 'sr-only' }, 'Science points: '), `${Math.round(m.science)} of ${m.config.scienceGoal}`)),
    h('div', { class: 'meter kid-day-meter', role: 'progressbar', 'aria-label': 'Mission progress', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100, style: { '--pct': `${pct}%`, '--meter-color': 'var(--cyan)' } }, h('span')),
    h('button', { type: 'button', id: 'sheet-toggle', class: 'kid-sheet-toggle', 'aria-expanded': String(sheetOpen), 'aria-controls': 'kid-today', onclick: onSheet },
      h('span', { class: ['plan-arrow', sheetOpen ? 'down' : 'up'], 'aria-hidden': 'true' }), sheetOpen ? 'Hide' : 'Plans', h('span', { class: 'sr-only' }, sheetOpen ? ' the plans' : ': show the plans')));
}

/**
 * @param {{ tutorial: boolean, onCrew: (e: Event) => void, onDetails: () => void, onTutorial: () => void }} opts
 */
export function sideTools({ tutorial, onCrew, onDetails, onTutorial }) {
  return h('footer', { class: 'kid-side-tools' },
    h('button', { type: 'button', id: 'crew-btn', class: 'kid-tool', 'aria-haspopup': 'dialog', onclick: onCrew }, icon('user', { size: 20 }), 'Crew'),
    h('button', { type: 'button', id: 'mission-details-btn', class: 'kid-tool', 'aria-haspopup': 'dialog', onclick: onDetails }, icon('info', { size: 20 }), 'Details'),
    h('button', { type: 'button', id: 'tutorial-btn', class: 'kid-tool', onclick: onTutorial }, icon('lightbulb', { size: 20 }), tutorial ? 'Restart' : 'Tutorial'),
    tutorial ? h('a', { class: 'kid-tool', href: '#/home' }, icon('arrow-left', { size: 20 }), 'Leave') : viewSwitch());
}
