// The training walkthrough: a short script of coach marks over the real play screen, running the real
// engine on the training mission (src/data/missions.js TUTORIAL). The play screen reports what the player
// did through emit(); each "do" step waits for its own signal before moving on.
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { openModal } from '../components/modal.js';
import { loadLive, onLive } from '../../live/liveData.js';
import { liveSunCard } from '../live/liveSun.js';
import { createCoach } from './coach.js';

export const TUTORIAL_FLAG = 'sol-survivor:tutorial-done';
export const TUTORIAL_ROUTE = 'play?tutorial=1';

export const tutorialDone = () => {
  try { return localStorage.getItem(TUTORIAL_FLAG) === '1'; } catch { return true; }
};
export const markTutorialDone = () => {
  try { localStorage.setItem(TUTORIAL_FLAG, '1'); } catch { /* storage unavailable: offer training again next time */ }
};

// The compact "real Sun today" card, filled in as soon as the live data layer answers.
function realSunNow() {
  const slot = h('div', { class: 'coach-sun' }, liveSunCard(null, { compact: true }));
  const fill = (live) => slot.replaceChildren(liveSunCard(live, { compact: true }));
  loadLive().then(fill).catch(() => {});
  const off = onLive(fill);
  window.setTimeout(() => off?.(), 60000);
  return slot;
}

/**
 * kind 'do': the player must use the lit-up control; `on` says which signal from the play screen finishes it.
 * kind 'read': one sentence and a Next button.
 */
export const TUTORIAL_STEPS = [
  { id: 'welcome', kind: 'read', target: '.play-stage', text: 'This is your Moon base. Keep four astronauts safe for three days.' },
  { id: 'meters', kind: 'do', target: '#meter-air', text: 'Tap Air to see how much is left.', why: 'Air, Power and Shield keep your crew alive. Watch all three.', on: (type, v) => type === 'meter' && v === 'air' },
  { id: 'explore', kind: 'do', target: '#plan-explore', text: 'Pick one plan each day. Tap Explore outside.', on: (type, v) => type === 'plan' && v === 'explore' },
  { id: 'air-cost', kind: 'read', target: '#plan-preview', text: 'Exploring finds science but uses more air. No choice is free!', why: 'Astronauts breathe harder when they work outside in a spacesuit.' },
  { id: 'next-1', kind: 'do', target: '#next-sol', text: 'Now press Next day.', on: (type) => type === 'day-end' },
  { id: 'shield', kind: 'do', target: '#plan-shield', text: 'A solar storm could hit any day. Tap Build the shield.', on: (type, v) => type === 'plan' && v === 'shield' },
  { id: 'shield-cost', kind: 'read', target: '#plan-preview', text: 'The shield grows, but nobody finds science today.', why: 'Power drops too: tonight the Sun sets, so the battery drains.' },
  { id: 'next-2', kind: 'do', target: '#next-sol', text: 'Press Next day.', on: (type) => type === 'event-open' || type === 'day-end' },
  { id: 'real-sun', kind: 'read', target: '.kid-event-story', text: 'Real NASA scientists watch the Sun every day. Want to see the real Sun today?', extra: realSunNow },
  { id: 'storm', kind: 'do', target: '.event-choices', text: 'A real solar storm from 2024! Pick how to keep your crew safe.', on: (type) => type === 'event-pick' },
  { id: 'keep-going', kind: 'do', target: '.event-modal [data-autofocus]', text: 'Read what happened. Then press Keep going.', on: (type) => type === 'event-close' },
  { id: 'switch', kind: 'do', target: '#kid-switchboard', text: 'Night: no solar power. Switch off one machine to save power.', on: (type) => type === 'switch' },
  { id: 'power-cost', kind: 'read', target: '#kid-switchboard', text: 'You saved power but lost what that machine makes. That is a trade-off.' },
  { id: 'next-3', kind: 'do', target: '#next-sol', text: 'Press Next day to finish your training.', on: (type) => type === 'mission-over' },
];

export const RECAP = [
  { icon: 'telescope', text: 'Exploring gets science, but uses more air.' },
  { icon: 'shield', text: 'A shield blocks radiation, but costs a day of science.' },
  { icon: 'zap', text: 'At night power is short, so something must be switched off.' },
];

/** The end-of-training card. onAction('mission' | 'again' | 'stay'). */
export function openRecap({ onAction }) {
  markTutorialDone();
  let picked = 'stay';
  return openModal({
    title: 'Training complete!',
    className: 'tutorial-recap',
    onClose: () => onAction(picked),
    content: (close) => h('div', { class: 'recap' },
      h('p', { class: 'recap-lead' }, 'Your crew is safe. You learned:'),
      h('ul', { class: 'recap-list' }, RECAP.map((r) => h('li', null, h('span', { class: 'recap-icon', 'aria-hidden': 'true' }, icon(r.icon, { size: 24 })), h('span', null, r.text)))),
      h('div', { class: 'row recap-actions' },
        h('button', { type: 'button', id: 'recap-start', class: 'btn btn-primary btn-lg btn-caps', 'data-autofocus': true, onclick: () => { picked = 'mission'; close(); } }, icon('play', { size: 20 }), 'Start your first real mission'),
        h('button', { type: 'button', id: 'recap-again', class: 'btn', onclick: () => { picked = 'again'; close(); } }, 'Play training again'))),
  });
}

/**
 * @param {{ onSkip: () => void, onComplete: () => void }} opts
 * @returns {{ start: () => void, emit: (type: string, value?: unknown) => void, stop: () => void, active: () => boolean, stepId: () => string|null }}
 */
export function createTutorial({ onSkip, onComplete }) {
  const steps = TUTORIAL_STEPS;
  let running = false;
  let resume = null; // where to go back to if an unplanned event card interrupts a step
  const idx = (id) => steps.findIndex((s) => s.id === id);
  const finish = () => { api.stop(); onComplete(); };
  const go = (i) => { if (i >= steps.length) finish(); else coach.show(i); };
  const coach = createCoach({
    steps,
    onSkip: () => { api.stop(); markTutorialDone(); onSkip(); },
    onNext: () => go(coach.index() + 1),
  });
  const api = {
    active: () => running,
    stepId: () => (running ? coach.step()?.id ?? null : null),
    start() { running = true; coach.start(); coach.show(0); },
    emit(type, value) {
      if (!running) return;
      const step = coach.step();
      if (!step) return;
      if (type === 'mission-over') { finish(); return; }
      // An event card nobody planned for: walk the player through it, then carry on where they were.
      if (type === 'event-open' && step.id !== 'next-2') { resume = coach.index() + (step.on?.('day-end') ? 1 : 0); go(idx('storm')); return; }
      if (type === 'event-close' && resume != null) { const back = resume; resume = null; go(back); return; }
      if (step.id === 'next-2' && type === 'day-end') { go(idx('switch')); return; }
      if (step.kind === 'do' && step.on?.(type, value)) go(coach.index() + 1);
    },
    stop() { if (!running) return; running = false; coach.stop(); },
  };
  return api;
}
