// 2D/3D view toggle for the play stage. The 3D walkable outpost lives in src/world3d/ (separate workstream).
// Integration contract: src/world3d/index.js exports mountWorld3d(container, { mission }) -> { update(mission), stop() }.
// Until that module exists, the toggle is shown disabled ("coming soon").
import { h } from '../../dom.js';

const WORLD3D = import.meta.glob('../../../world3d/index.js');
const loader = WORLD3D['../../../world3d/index.js'];

export function viewToggle({ canvas, getMission }) {
  const mountEl = h('div', { id: 'play-3d-mount', class: 'play-3d-mount', hidden: true, 'aria-label': '3D outpost view' });
  let world = null;
  let mode = '2d';

  const btn2d = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', onclick: () => setMode('2d') }, '🖼️ 2D');
  const btn3d = h('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': 'false',
    disabled: !loader,
    title: loader ? 'Walk around your outpost in 3D' : '3D outpost coming soon',
    onclick: () => setMode('3d'),
  }, loader ? '🧊 3D' : '🧊 3D (soon)');
  const toggle = h('div', { class: 'view-toggle', role: 'group', 'aria-label': 'Outpost view' }, btn2d, btn3d);

  async function setMode(next) {
    if (next === mode) return;
    mode = next;
    btn2d.setAttribute('aria-pressed', String(mode === '2d'));
    btn3d.setAttribute('aria-pressed', String(mode === '3d'));
    canvas.hidden = mode === '3d';
    mountEl.hidden = mode !== '3d';
    if (mode === '3d' && !world && loader) {
      try {
        const mod = await loader();
        world = mod.mountWorld3d?.(mountEl, { mission: getMission() }) ?? null;
      } catch (err) {
        console.error('[play] 3D view failed', err);
        mountEl.textContent = 'The 3D view could not start on this device.';
      }
    }
  }

  return {
    mount: mountEl,
    toggle,
    update: (mission) => world?.update?.(mission),
    stop: () => world?.stop?.(),
  };
}
