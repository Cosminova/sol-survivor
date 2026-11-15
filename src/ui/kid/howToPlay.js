// "How to play": a short three-step card. Opens by itself on the first visit (home or play screen),
// can be skipped with Escape, the close button or "Skip", and reopened from any "How to play" button.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { openModal } from '../components/modal.js';
import { speak, canSpeak } from '../speech.js';
import { keyList, keysText } from '../components/keycaps.js';

const FLAG = 'sol-survivor:howto-seen';

// The keys that work on the play screen, plus the main Walk 3D keys (press H there for the full list).
export const KEY_ROWS = [
  [[['N']], 'Next day'],
  [[['+'], ['−']], 'Zoom the Outpost 3D view in and out'],
  [[['Tab']], 'Move between buttons'],
  [[['Enter'], ['Space']], 'Press the button you are on'],
  [[['Esc']], 'Close a pop-up or leave Walk 3D'],
  [[['W', 'A', 'S', 'D'], ['↑', '←', '↓', '→']], 'Walk (in Walk 3D)'],
  [[['E']], 'Use a glowing station (in Walk 3D)'],
  [[['H']], 'All the Walk 3D keys'],
];

export const STEPS = [
  { icon: 'package', title: 'Pack your lander.', text: 'Choose the machines and supplies your crew will need.' },
  { icon: 'user', title: 'Each day, pick one plan for your crew and press Next day.', text: 'Explore, build a shield, or rest and fix things.' },
  { icon: 'shield', title: 'Keep Air, Power and Shield out of Danger.', text: 'Good is fine. Low means watch out. Danger means act now.' },
];

const seen = () => {
  try { return localStorage.getItem(FLAG) === '1'; } catch { return true; }
};
const markSeen = () => {
  try { localStorage.setItem(FLAG, '1'); } catch { /* storage unavailable: show it again next time */ }
};

export function openHowToPlay() {
  markSeen();
  const keysSpoken = KEY_ROWS.map(([keys, action]) => `${keysText(keys)}: ${action}.`).join(' ');
  const spoken = `How to play. ${STEPS.map((s, i) => `Step ${i + 1}. ${s.title} ${s.text}`).join(' ')} Keys. ${keysSpoken}`;
  return openModal({
    title: 'How to play',
    className: 'howto-modal',
    content: (close) => h('div', { class: 'howto' },
      h('ol', { class: 'howto-steps' }, STEPS.map((s, i) => h('li', { class: 'howto-step' },
        h('span', { class: 'howto-num', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'howto-icon', 'aria-hidden': 'true' }, icon(s.icon, { size: 30 })),
        h('span', { class: 'howto-copy' }, h('strong', null, s.title), h('span', null, s.text))))),
      h('details', { class: 'howto-keys' },
        h('summary', null, 'Keyboard keys'),
        keyList(KEY_ROWS)),
      h('p', { class: 'howto-note' }, 'If a mission ends early, that is okay. You can always try again.'),
      h('div', { class: 'row howto-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-lg btn-caps', 'data-autofocus': true, onclick: close }, icon('play', { size: 18 }), 'Got it'),
        h('a', { class: 'btn', href: '#/play?tutorial=1', onclick: close }, icon('lightbulb', { size: 18 }), 'Show me how (tutorial)'),
        canSpeak() ? h('button', { type: 'button', class: 'btn', onclick: () => speak(spoken, true) }, icon('volume', { size: 18 }), 'Read aloud') : null,
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: close }, 'Skip'))),
  });
}

// Called by the app shell on every route change.
export function maybeShowHowToPlay(routeName) {
  // Home leads with "Start training" instead; the card only greets players who jump straight into a mission.
  if (routeName !== 'play') return;
  if (seen() || /[?&]tutorial=1/.test(location.hash)) return;
  // Wait for the screen to draw; never stack on top of another dialog (for example an event card).
  setTimeout(() => {
    if (seen() || document.querySelector('.modal-backdrop')) return;
    const now = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || 'home';
    if (now === 'play' && !/[?&]tutorial=1/.test(location.hash) && !document.querySelector('.coach')) openHowToPlay();
  }, 500);
}

export function howToPlayButton({ className = 'btn btn-sm' } = {}) {
  return h('button', { type: 'button', class: `${className} howto-btn`, onclick: () => openHowToPlay() }, icon('lightbulb', { size: 18 }), 'How to play');
}
