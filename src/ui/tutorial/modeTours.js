// Short "how this view works" tours for the three outpost views: Outpost 3D, Map 2D and Walk 3D. Each tour is
// two or three small coach bubbles (src/ui/tutorial/coach.js) with keycaps for the keys it mentions. A tour
// plays by itself the first time a player opens that view, and the "?" chip next to the view toggle replays it.
// It waits until nothing else is on screen (a dialog, the training tutorial, the Walk 3D intro film).
import { keycaps } from '../components/keycaps.js';
import { createCoach } from './coach.js';

const FLAG = (mode) => `sol-survivor:tour-${mode}`;
const WAIT_STEP_MS = 400;
const WAIT_LIMIT_MS = 120000;
const SETTLE_MS = 600; // let a view draw its first frame before pointing at it

const caps = (keys) => () => keycaps(keys);

export const MODE_TOURS = {
  outpost: [
    { id: 'outpost-look', kind: 'read', target: '.play-stage', text: 'This is your outpost in 3D. Drag to spin around it.', inline: caps(['Drag mouse', 'or', 'Swipe']) },
    { id: 'outpost-reset', kind: 'read', target: '.play-stage', text: 'Lost? Double-click to put the camera back.', inline: caps(['Double-click']) },
    { id: 'outpost-views', kind: 'read', target: '.view-toggle', text: 'Switch views here: Outpost 3D, Map 2D or Walk 3D.' },
  ],
  map: [
    { id: 'map-look', kind: 'read', target: '.play-stage', text: 'Map 2D is a flat picture of your base. Every machine you packed is drawn here.' },
    { id: 'map-live', kind: 'read', target: '.play-stage', text: 'It changes with your mission: day and night, dust storms and astronauts outside.' },
    { id: 'map-views', kind: 'read', target: '.view-toggle', text: 'Tap Walk 3D to go outside with your crew.' },
  ],
  walk: [
    { id: 'walk-move', kind: 'read', target: '.walk-world', text: 'You are outside! Walk around your outpost.', inline: caps([['W', 'A', 'S', 'D'], ['↑', '←', '↓', '→'], 'Hold', ['Shift'], 'to run']) },
    { id: 'walk-use', kind: 'read', target: '.walk-world', text: 'Walk to a glowing station, then press E to do the job.', inline: caps([['E'], 'Help:', ['H']]) },
    { id: 'walk-back', kind: 'read', target: '.walk-back', text: 'Done exploring? Go back to base here.', inline: caps([['Esc']]) },
  ],
};

export const tourSeen = (mode) => {
  try { return localStorage.getItem(FLAG(mode)) === '1'; } catch { return true; }
};
const markSeen = (mode) => {
  try { localStorage.setItem(FLAG(mode), '1'); } catch { /* storage unavailable: the tour shows again next time */ }
};

const visible = (el) => (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0);

/** True while something else owns the screen, so a tour must wait. */
export function screenBusy(doc = document) {
  if (doc.querySelector('.coach')) return true;
  if ([...doc.querySelectorAll('.modal-backdrop, .w3d-modal, .w3d-title.w3d-on')].some(visible)) return true;
  return Boolean(doc.querySelector('.w3d-host[data-cinematic="true"]'));
}

/**
 * @param {{ currentMode: () => string, onEnd?: (mode: string) => void }} opts
 * @returns {{ maybeStart: (mode: string) => void, start: (mode: string) => void, stop: () => void, active: () => boolean }}
 */
export function createModeTours({ currentMode, onEnd }) {
  let coach = null;
  let tourMode = null;
  let waitTimer = 0;

  const cancelWait = () => { window.clearTimeout(waitTimer); waitTimer = 0; };

  function end(seen) {
    if (!coach) return;
    const mode = tourMode;
    coach.stop();
    coach = null;
    tourMode = null;
    if (seen) markSeen(mode);
    onEnd?.(mode);
  }

  function run(mode) {
    const steps = MODE_TOURS[mode];
    if (!steps || currentMode() !== mode) return;
    end(false);
    tourMode = mode;
    coach = createCoach({
      steps,
      onSkip: () => end(true),
      onNext: () => { const i = coach.index() + 1; if (i >= steps.length) end(true); else coach.show(i); },
    });
    coach.start();
    coach.show(0);
  }

  // Wait for a clear screen, then start; give up if the player leaves the view or nothing clears in time.
  function whenClear(mode) {
    cancelWait();
    const startedAt = Date.now();
    let clearSince = 0;
    const tick = () => {
      if (currentMode() !== mode || Date.now() - startedAt > WAIT_LIMIT_MS) { waitTimer = 0; return; }
      if (screenBusy()) clearSince = 0;
      else if (!clearSince) clearSince = Date.now();
      if (clearSince && Date.now() - clearSince >= SETTLE_MS) { waitTimer = 0; run(mode); return; }
      waitTimer = window.setTimeout(tick, WAIT_STEP_MS);
    };
    waitTimer = window.setTimeout(tick, WAIT_STEP_MS);
  }

  return {
    active: () => Boolean(coach),
    maybeStart(mode) { if (MODE_TOURS[mode] && !tourSeen(mode)) whenClear(mode); },
    start(mode) { whenClear(mode); },
    stop() { cancelWait(); end(false); },
  };
}
