// Opens a mini-game inside the modal layer, runs its timer and reports quality (0..1).
import { el } from '../hud.js';
import { MINIGAMES } from '../actions.js';
import { SKIP_QUALITY } from '../minigameScoring.js';
import { createWipe } from './wipe.js';
import { createShovel } from './shovel.js';
import { createWater } from './water.js';
import { createScan } from './scan.js';
import { createRepair } from './repair.js';
import { createDrill } from './drill.js';

const FACTORIES = { wipe: createWipe, shovel: createShovel, water: createWater, scan: createScan, repair: createRepair, drill: createDrill };

const HOW = {
  wipe: 'Drag across the panel to wipe off the dust. Keyboard: arrow keys move the cloth.',
  shovel: 'Press Space / E / tap when the needle is in the green zone.',
  water: 'Hold Space or the Pour button, and let go inside the green band. Don’t drown the roots!',
  scan: 'Move the spectrometer over the rock. The signal beeps faster as you get close. Hold still on the hot spot.',
  repair: 'Connect each wire to the matching shape on the other side. Use Tab and Enter, or tap.',
  drill: 'Hold Space or Drill to dig. Let go before the drill overheats, then keep going.',
};

export function runMinigame(kind, { modals, audio, assist = false, ease = 1, rng, role, harvestReady = false, crewName = 'Crew', onDone }) {
  const factory = FACTORIES[kind];
  if (!factory) { onDone({ quality: 1, skipped: false }); return () => {}; }
  const spec = MINIGAMES[kind];
  const limit = spec.seconds * (assist ? 1.5 : 1) * Math.max(1, ease);
  const area = el('div', { class: 'w3d-mg' });
  const timerFill = el('i', { style: 'width:100%' });
  const status = el('div', { class: 'w3d-hint', 'aria-live': 'polite' });
  let elapsed = 0;
  let done = false;
  let raf = 0;
  let last = performance.now();
  let game = null;

  function finish(quality, skipped = false) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    game?.destroy?.();
    modals.close();
    onDone({ quality: Math.max(0, Math.min(1, quality)), skipped });
  }

  const handle = modals.open({
    title: `${spec.label} · ${crewName.split(' ')[0]}`,
    label: spec.label,
    className: 'w3d-mg-modal',
    body: [el('p', { class: 'w3d-hint' }, HOW[kind], assist ? ' (Easy mode is on.)' : ''), el('div', { class: 'w3d-timer' }, timerFill), area, status],
    buttons: [{ label: 'Skip (half credit)', onClick: () => finish(SKIP_QUALITY, true), keep: true }],
    dismiss: null,
    capture: {
      keydown: (e) => {
        if (e.code === 'Escape') { finish(SKIP_QUALITY, true); return true; }
        return game?.keydown?.(e) === true;
      },
      keyup: (e) => game?.keyup?.(e),
    },
  });

  game = factory({ root: area, assist, ease, rng, role, audio, harvestReady, limit, setStatus: (t) => { status.textContent = t; }, finish });

  function frame(now) {
    if (done) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    timerFill.style.width = `${Math.max(0, 1 - elapsed / limit) * 100}%`;
    game.tick?.(dt, elapsed);
    if (elapsed >= limit && !done) finish(game.timeout ? game.timeout(elapsed) : 0.4);
    if (!done) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => { if (!done) { done = true; cancelAnimationFrame(raf); game?.destroy?.(); handle.close(); } };
}
