// View toggle for the play stage: the orbiting 3D outpost backdrop (src/ui/outpost3d/, the default), the painted
// 2D map (src/ui/scene/) and the walkable 3D outpost (src/world3d/). Only the view in front renders.
import { h } from '../../dom.js';
import { getState, update } from '../../../state/store.js';
import { openTermPopover } from '../../components/termPopover.js';

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
export function viewToggle({ onMode, getMission, commit, onTask, onToggle, onEndSol }) {
  const mountEl = h('div', { id: 'play-3d-mount', class: 'play-3d-mount', hidden: true, 'aria-label': '3D outpost view' });
  let world = null;
  let mode = 'outpost';

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
  const toggle = h('div', { class: 'view-toggle', role: 'group', 'aria-label': 'Outpost view' }, buttons.outpost, buttons.map, buttons.walk);

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
      onExit: () => setMode(buttons.outpost.disabled ? 'map' : 'outpost'),
    };
  };

  async function setMode(next) {
    if (next === mode) return;
    mode = next;
    for (const id of VIEW_MODES) buttons[id].setAttribute('aria-pressed', String(mode === id));
    mountEl.hidden = mode !== 'walk';
    onMode?.(mode);
    if (mode === 'walk' && !world && loader) {
      try {
        const mod = await loader();
        if (!mod.isWebGLAvailable()) {
          mountEl.textContent = 'The 3D view needs WebGL, which this device does not support.';
          return;
        }
        world = mod.mountOutpost3D(mountEl, options());
      } catch (err) {
        console.error('[play] 3D view failed', err);
        mountEl.textContent = 'The 3D view could not start on this device.';
      }
    } else if (world) {
      world.resize();
    }
  }

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
    stop: () => { world?.dispose(); world = null; },
  };
}
