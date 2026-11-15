// View toggle for the play stage: the orbiting 3D outpost backdrop (src/ui/outpost3d/, the default), the painted
// 2D map (src/ui/scene/) and the walkable 3D outpost (src/world3d/). Only the view in front renders.
import { h } from '../../dom.js';
import { getState, update } from '../../../state/store.js';
import { openTermPopover } from '../../components/termPopover.js';
import { keycaps } from '../../components/keycaps.js';
import { createModeTours } from '../../tutorial/modeTours.js';

const WORLD3D = import.meta.glob('../../../world3d/index.js');
const loader = WORLD3D['../../../world3d/index.js'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

export function applyPenalty(m, { crewId, kind, amount = 1 }) {
  const crew = m.crew.map((c) => {
    if (c.id !== crewId) return c;
    if (kind === 'radiation') return { ...c, doseMsv: round1(c.doseMsv + amount) };
    return { ...c, health: clamp(c.health - amount, 0, 100), morale: clamp(c.morale - amount, 0, 100) };
  });
  return { ...m, crew };
}

export function applyTaskResult(m, { crewId, taskId, quality = 0, skipped }) {
  if (skipped || quality <= 0) return m;
  if (taskId === 'science') return { ...m, science: round1(m.science + 2 * quality) };
  const crew = m.crew.map((c) => (c.id === crewId ? { ...c, morale: clamp(c.morale + 2 * quality, 0, 100) } : c));
  return { ...m, crew };
}

export function applyHazard(m, { phase, moduleId }) {
  if (!moduleId || (phase !== 'micrometeoroid' && phase !== 'expired')) return m;
  return { ...m, broken: { ...m.broken, [moduleId]: (m.broken[moduleId] ?? 0) + 1 } };
}

export const VIEW_MODES = ['outpost', 'map', 'walk'];

// onMode(mode) lets the play screen show/hide and pause the outpost backdrop and the 2D map canvas.
// tours: false turns off the per-view tours (the training mission runs its own walkthrough).
export function viewToggle({ onMode, getMission, commit, onTask, onToggle, onEndSol, tours: toursOn = true }) {
  // Walk 3D is a full-screen mode: the mount leaves the play stage and covers the viewport between the site
  // header and the telemetry ticker, with a slim bar (Back to base + the view toggle) on top of the world.
  const worldEl = h('div', { class: 'walk-world' });
  const backBtn = h('button', { type: 'button', class: 'chip walk-back', title: 'Back to base (Esc)', onclick: () => exitWalk() }, '← Back to base');
  const barSlot = h('div', { class: 'walk-bar-toggle' });
  const bar = h('div', { class: 'walk-bar' }, backBtn, h('span', { class: 'walk-bar-hint', 'aria-hidden': 'true' }, keycaps([['Esc']]), ' to go back'), barSlot);
  const mountEl = h('div', { id: 'play-3d-mount', class: 'play-3d-mount', hidden: true, 'aria-label': '3D outpost view' }, bar, worldEl);
  let world = null;
  let mode = 'outpost';
  let lastFlat = 'outpost';
  let toggleHome = null; // where the view toggle lives while not walking

  const buttons = {
    outpost: h('button', { type: 'button', class: 'chip', 'data-view': 'outpost', 'aria-pressed': 'true', title: 'Look around your outpost in 3D', onclick: () => setMode('outpost') }, 'Outpost 3D'),
    map: h('button', { type: 'button', class: 'chip', 'data-view': 'map', 'aria-pressed': 'false', title: 'Flat picture of your outpost', onclick: () => setMode('map') }, 'Map 2D'),
    walk: h('button', {
      type: 'button',
      class: 'chip',
      'data-view': 'walk',
      'aria-pressed': 'false',
      disabled: !loader,
      title: loader ? 'Walk around your outpost in 3D' : '3D outpost unavailable',
      onclick: () => setMode('walk'),
    }, 'Walk 3D'),
  };
  const tours = createModeTours({
    currentMode: () => mode,
    onEnd: (ended) => { if (ended === 'walk' && mode === 'walk') focusWorld(); },
  });
  const helpBtn = h('button', {
    type: 'button', class: 'chip view-help', title: 'How this view works', 'aria-label': 'How this view works',
    onclick: () => tours.start(mode),
  }, '?');
  const toggle = h('div', { class: 'view-toggle', role: 'group', 'aria-label': 'Outpost view' }, buttons.outpost, buttons.map, buttons.walk, helpBtn);

  const options = () => {
    const { settings, world3d } = getState();
    const m = getMission();
    return {
      mission: m,
      difficulty: m.config.difficulty,
      reducedMotion: settings.reducedMotion,
      readAloud: settings.readAloud,
      muted: !settings.sound,
      progress: world3d,
      onAssignTask: (crewId, taskId) => onTask(crewId, taskId),
      onToggleModule: (id) => onToggle(id),
      onEndSol: () => onEndSol(),
      onPenalty: (p) => commit(applyPenalty(getMission(), p)),
      onTaskResult: (r) => commit(applyTaskResult(getMission(), r)),
      onHazard: (hz) => commit(applyHazard(getMission(), hz)),
      onProgress: (p) => update((st) => ({ ...st, world3d: p })),
      onOpenTerm: (id) => openTermPopover(id, mountEl),
      onExit: () => exitWalk(),
    };
  };

  function exitWalk() {
    if (mode === 'walk') setMode(lastFlat === 'outpost' && buttons.outpost.disabled ? 'map' : lastFlat);
  }

  // Escape leaves walk mode, unless a dialog, popup, mini-game or the intro wants the key first.
  const onKey = (e) => {
    if (mode !== 'walk' || e.key !== 'Escape' || e.defaultPrevented) return;
    const a = document.activeElement;
    if (a && a !== document.body && !mountEl.contains(a)) return;
    // Only dialogs that are actually on screen count: some (the Mission details drawer) hide a wrapper, not themselves.
    const shown = (el) => (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0);
    if ([...document.querySelectorAll('.modal-backdrop, [role="dialog"], .w3d-host[data-cinematic="true"]')].some(shown)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exitWalk();
  };

  function setFullScreen(on) {
    document.documentElement.classList.toggle('walk-full', on);
    if (on) {
      const header = document.querySelector('.site-header');
      if (header) mountEl.style.setProperty('--walk-top', `${Math.max(0, header.offsetTop - window.scrollY) + header.offsetHeight}px`);
      if (mountEl.parentElement !== document.body) document.body.append(mountEl);
      toggleHome = { parent: toggle.parentNode, next: toggle.nextSibling };
      barSlot.append(toggle);
      window.addEventListener('keydown', onKey, true);
    } else {
      window.removeEventListener('keydown', onKey, true);
      if (toggleHome?.parent?.isConnected) toggleHome.parent.insertBefore(toggle, toggleHome.next?.parentNode === toggleHome.parent ? toggleHome.next : null);
      toggleHome = null;
    }
  }

  const focusWorld = () => worldEl.querySelector('canvas')?.focus({ preventScroll: true });

  async function setMode(next) {
    if (next === mode) return;
    tours.stop();
    const wasWalk = mode === 'walk';
    mode = next;
    if (mode !== 'walk') lastFlat = mode;
    for (const id of VIEW_MODES) buttons[id].setAttribute('aria-pressed', String(mode === id));
    mountEl.hidden = mode !== 'walk';
    if (wasWalk !== (mode === 'walk')) setFullScreen(mode === 'walk');
    onMode?.(mode);
    if (toursOn) tours.maybeStart(mode);
    if (wasWalk) buttons[mode].focus({ preventScroll: true });
    if (mode === 'walk' && !world && loader) {
      try {
        const mod = await loader();
        if (!mod.isWebGLAvailable()) {
          worldEl.textContent = 'The 3D view needs WebGL, which this device does not support.';
          return;
        }
        world = mod.mountOutpost3D(worldEl, options());
        if (import.meta.env.DEV) window.__walk3d = world; // dev-only hook for browser checks (lighting, fps)
        if (mode === 'walk') focusWorld(); // so the walking keys work straight away
      } catch (err) {
        console.error('[play] 3D view failed', err);
        worldEl.textContent = 'The 3D view could not start on this device.';
      }
    } else if (world) {
      world.resize();
      if (mode === 'walk') focusWorld();
    }
  }

  if (toursOn) tours.maybeStart(mode); // the default view's tour, once nothing else is on screen

  return {
    mount: mountEl,
    toggle,
    mode: () => mode,
    // No WebGL (or three.js failed to load): the orbit view is off and the 2D map takes over as the backdrop.
    outpostUnavailable: () => {
      buttons.outpost.disabled = true;
      buttons.outpost.title = 'The 3D outpost needs WebGL, which this device has switched off';
      if (mode === 'outpost') setMode('map');
    },
    update: (mission) => world?.update(mission),
    stop: () => {
      tours.stop();
      if (mode === 'walk') setFullScreen(false);
      world?.dispose();
      world = null;
      mountEl.remove();
      if (import.meta.env.DEV && window.__walk3d) delete window.__walk3d;
    },
  };
}
