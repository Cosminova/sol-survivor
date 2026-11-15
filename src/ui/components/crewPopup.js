// Per-astronaut stats, shown only when asked for: a small closable popup opened from a name tag in the 3D
// walk view (the 'sol:crew-select' event) or from the Crew button. Close button, Escape or a click outside
// dismiss it; focus is trapped while it is open and returns to where it was.
import { h, announce } from '../dom.js';
import { icon, TASK_ICONS } from '../icons.js';
import { ROLES } from '../../engine/sim.js';
import { RADIATION } from '../../data/constants.js';
import { KID_TASKS, KID_ROLES } from '../kid/words.js';
import { trapFocus } from './modal.js';
import { meter } from './common.js';

let current = null;

export function closeCrewPopup({ restoreFocus = true } = {}) {
  if (!current) return;
  const { el, onKey, onDown, opener } = current;
  document.removeEventListener('keydown', onKey, true);
  document.removeEventListener('pointerdown', onDown, true);
  el.remove();
  current = null;
  if (restoreFocus && opener && document.contains(opener)) opener.focus();
}

const colorFor = (v) => (v > 60 ? 'var(--good)' : v > 30 ? 'var(--warn)' : 'var(--danger)');

/** One plain sentence about how the astronaut is doing (same thresholds the advisor uses). */
export function crewStatusLine(c) {
  const first = c.name.split(' ')[0];
  if (c.health <= 30) return `${first} is hurt and needs rest now.`;
  if (c.morale < 35) return `${first} is worn out. A rest day would help.`;
  if (c.doseMsv > RADIATION.careerLimitMsv * 0.85) return `${first} is close to the safe radiation limit.`;
  if (c.health > 60 && c.morale > 60) return `${first} feels great.`;
  return `${first} is doing okay.`;
}

const xrays = (msv) => Math.round(msv / RADIATION.chestXrayMsv);

function place(el, anchor) {
  const pad = 12;
  const box = el.getBoundingClientRect();
  const x = anchor?.x ?? window.innerWidth / 2;
  const y = anchor?.y ?? window.innerHeight / 2 - box.height / 2;
  const left = Math.max(pad, Math.min(window.innerWidth - box.width - pad, x - box.width / 2));
  let top = anchor ? y + 14 : y;
  if (top + box.height > window.innerHeight - pad) top = Math.max(pad, (anchor ? y - 14 : y) - (anchor ? box.height : 0));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(Math.max(pad, top))}px`;
}

function show({ label, spoken, anchor, build }) {
  const opener = current?.opener ?? document.activeElement;
  closeCrewPopup({ restoreFocus: false });
  const close = () => closeCrewPopup();
  const closeBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm crew-pop-close', onclick: close }, icon('close', { size: 18 }), 'Close');
  const el = h('div', { class: 'crew-pop', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, closeBtn, ...build(close));
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else trapFocus(el, e);
  };
  const onDown = (e) => { if (!el.contains(e.target)) close(); };
  document.body.append(el);
  place(el, anchor);
  current = { el, onKey, onDown, opener };
  document.addEventListener('keydown', onKey, true);
  // Wait a tick so the click that opened the popup does not close it again.
  window.setTimeout(() => { if (current?.el === el) document.addEventListener('pointerdown', onDown, true); }, 0);
  (el.querySelector('[data-autofocus]') ?? closeBtn).focus({ preventScroll: true });
  announce(spoken);
  return close;
}

/**
 * Stats for one astronaut.
 * @param {string} crewId the mission crew member's id, for example 'c1'
 * @param {object} mission
 * @param {{ anchor?: { x: number, y: number } }} [opts] where the click happened, in viewport pixels
 * @returns {(() => void)|null} close function, or null when the id is unknown
 */
export function openCrewPopup(crewId, mission, { anchor } = {}) {
  const c = mission?.crew?.find((member) => member.id === crewId);
  if (!c) return null;
  const role = ROLES[c.role]?.label ?? c.role;
  const job = KID_TASKS[c.task]?.label ?? c.task;
  const status = crewStatusLine(c);
  const dose = Math.round(c.doseMsv * 10) / 10;
  return show({
    label: `${c.name}, ${role}`,
    spoken: `${c.name}, ${role}. ${status} Health ${Math.round(c.health)} of 100. Mood ${Math.round(c.morale)} of 100. Today: ${job}.`,
    anchor,
    build: () => [
      h('div', { class: 'crew-pop-head' },
        h('span', { class: 'crew-avatar', 'aria-hidden': 'true' }, icon('user', { size: 26 })),
        h('div', null, h('h2', { class: 'crew-pop-name' }, c.name), h('p', { class: 'crew-role' }, role))),
      h('p', { class: 'crew-pop-status' }, status),
      h('dl', { class: 'crew-pop-stats' },
        h('dt', null, 'Health'), h('dd', null, meter(c.health, colorFor(c.health), `Health ${Math.round(c.health)} of 100`), h('span', { class: 'mono' }, `${Math.round(c.health)} of 100`)),
        h('dt', null, 'Mood'), h('dd', null, meter(c.morale, colorFor(c.morale), `Mood ${Math.round(c.morale)} of 100`), h('span', { class: 'mono' }, `${Math.round(c.morale)} of 100`)),
        h('dt', null, 'Radiation'), h('dd', null,
          meter((100 * c.doseMsv) / RADIATION.careerLimitMsv, 'var(--rad)', `Radiation ${dose} of ${RADIATION.careerLimitMsv} millisieverts`),
          h('span', { class: 'mono' }, `${dose} of ${RADIATION.careerLimitMsv} mSv`),
          h('span', { class: 'crew-pop-note' }, `Like ${xrays(c.doseMsv).toLocaleString()} chest X-rays. ${RADIATION.careerLimitMsv} mSv is the safe limit.`)),
        h('dt', null, 'Job today'), h('dd', { class: 'crew-pop-job' }, icon(TASK_ICONS[c.task] ?? 'user', { size: 20 }), job)),
      KID_ROLES[c.role] ? h('p', { class: 'crew-pop-note' }, `${role}: ${KID_ROLES[c.role]}`) : null,
    ],
  });
}

/** The crew as a short list of buttons; each one opens that astronaut's popup. For keyboard and touch users. */
export function openCrewList(mission, { anchor } = {}) {
  return show({
    label: 'Your crew',
    spoken: 'Your crew. Pick an astronaut to see how they are doing.',
    anchor,
    build: () => [
      h('h2', { class: 'crew-pop-name' }, 'Your crew'),
      h('ul', { class: 'crew-pop-list' }, mission.crew.map((c, i) => h('li', null,
        h('button', { type: 'button', class: 'btn crew-pop-pick', 'data-autofocus': i === 0 ? true : null, dataset: { crew: c.id }, onclick: () => openCrewPopup(c.id, mission, { anchor }) },
          icon('user', { size: 20 }), h('span', { class: 'crew-pop-pick-name' }, c.name), h('span', { class: 'crew-role' }, ROLES[c.role]?.label ?? c.role))))),
    ],
  });
}
