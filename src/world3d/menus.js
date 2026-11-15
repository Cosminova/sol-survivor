// Modal layer: pause menu, controls help, fact cards and the end-of-sol summary.
import { el } from './hud.js';
import { keyList } from '../ui/components/keycaps.js';

export function createModals(layer, controls, { onOpen, onClose }) {
  let active = null;

  function close(silent = false) {
    if (!active) return;
    const a = active;
    active = null;
    layer.classList.remove('w3d-on');
    layer.replaceChildren();
    controls.setCapture(null);
    if (!silent) a.onClosed?.();
    onClose?.();
  }

  // buttons: [{ label, primary, onClick, keep }]; dismiss runs on Esc (null = not dismissible).
  function open({ title, body = [], buttons = [], dismiss = null, className = '', capture = null, label }) {
    close(true);
    const row = el('div', { class: 'w3d-row' }, ...buttons.map((b) => el('button', {
      class: `w3d-b${b.primary ? ' w3d-primary' : ''}`,
      onclick: () => { if (!b.keep) close(true); b.onClick?.(); },
    }, b.label)));
    const modal = el('div', { class: `w3d-modal ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label ?? title ?? 'Dialog' },
      title ? el('h2', null, title) : null, ...[body].flat(), buttons.length ? row : null);
    layer.replaceChildren(modal);
    layer.classList.add('w3d-on');
    active = { modal, onClosed: dismiss };
    controls.setCapture({
      keydown: (e) => {
        if (capture?.keydown?.(e) === true) return true;
        if (e.code === 'Escape' && dismiss) { close(true); dismiss(); return true; }
        return false; // let Tab / Enter / Space reach the focused button
      },
      keyup: (e) => capture?.keyup?.(e),
    });
    onOpen?.();
    requestAnimationFrame(() => (modal.querySelector('.w3d-primary') ?? modal.querySelector('button'))?.focus({ preventScroll: true }));
    return { modal, close: () => close(true) };
  }

  return { open, close: () => close(true), isOpen: () => Boolean(active) };
}

// Each row: [keys, what it does], drawn as keycaps (see src/ui/components/keycaps.js for the keys spec).
export const CONTROL_ROWS = [
  [[['W', 'A', 'S', 'D'], ['↑', '←', '↓', '→']], 'Walk'],
  [[['Shift']], 'Hold while walking to run'],
  [['Drag mouse'], 'Look around'],
  [['Mouse wheel'], 'Zoom camera'],
  [[['E'], ['Enter'], ['Space']], 'Use / start a job'],
  [[['Q']], 'Why this matters (dictionary)'],
  [[['C'], ['1', '2', '3', '4']], 'Switch astronaut'],
  [[['Tab'], 'then', ['Enter']], 'Pick a name tag to see that astronaut’s stats'],
  [[['H']], 'This help'],
  [[['M']], 'Sound on/off'],
  [[['P']], 'Pause menu'],
  [[['Esc']], 'Back to base'],
  [['Touch'], 'Left stick to walk, drag to look, E button to use'],
];

export function controlsTable() {
  return keyList(CONTROL_ROWS, el, 'w3d-kbd');
}

export function helpBody(body) {
  return [
    el('p', null, 'Keep your crew alive and finish the day’s objectives before the Sun sets. Walk to a glowing station, press E and play the job. Doing it well earns XP and helps your outpost!'),
    el('p', null, `Watch your suit oxygen on EVA. Refill at the airlock${body === 'mars' ? ' or in the rover' : ' or in the rover if you packed one'}. When CAPCOM warns of a solar storm, get inside!`),
    controlsTable(),
  ];
}

export function summaryBody(summary, { auto = false } = {}) {
  return [
    auto ? el('p', null, '🌙 Night has fallen. Everyone is back inside the habitat.') : el('p', null, 'You cycle through the airlock and pop off your helmet. Great work out there!'),
    el('table', null, el('tbody', null,
      el('tr', null, el('td', null, 'Jobs done'), el('td', null, String(summary.tasks))),
      el('tr', null, el('td', null, 'Average quality'), el('td', null, `${summary.avgQuality}%`)),
      el('tr', null, el('td', null, 'Rock samples'), el('td', null, String(summary.samples))),
      el('tr', null, el('td', null, 'Artifacts found'), el('td', null, String(summary.collected))),
      el('tr', null, el('td', null, 'Suit oxygen used'), el('td', null, `${summary.o2UsedPct}%`)),
      el('tr', null, el('td', null, 'Your radiation dose today'), el('td', null, `${summary.doseMsv} mSv`)),
      el('tr', null, el('td', null, 'XP earned'), el('td', null, `+${summary.xp}`)))),
    el('ul', { style: 'margin:10px 0 0;padding-left:18px' }, ...summary.objectives.map((o) => el('li', null, `${o.done ? '✅' : '⬜'} ${o.label}`))),
  ];
}

export function factCard({ icon, title, text }) {
  return el('div', { class: 'w3d-fact' }, el('span', { 'aria-hidden': 'true' }, icon), el('div', null, el('b', null, title), el('p', { style: 'margin:4px 0 0' }, text)));
}
