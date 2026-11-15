// Mounts the two three.js scenes into the app: the outpost as the full-bleed backdrop of the play screen and the
// globe as the free-play site picker. three.js is imported lazily so it never blocks the first paint, and both
// mounts degrade to the existing 2D views when WebGL is missing.
import '../../styles/outpost3d.css';
import { outpostModelFrom, applyScenePresets } from './outpostModel.js';
import { webglAvailable } from './sceneUtil.js';

const devPresets = (() => {
  try {
    return new URLSearchParams(window.location.search).get('scene') || '';
  } catch {
    return '';
  }
})();

const el = (className, attrs = {}) => {
  const node = document.createElement('div');
  node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

/**
 * Full-bleed outpost backdrop for the play screen.
 * @param {{ reducedMotion?: () => boolean, onUnavailable?: (reason: string) => void }} [opts]
 * @returns {{ layer: HTMLElement, overlay: HTMLElement, available: boolean, update: (m: object, description?: string) => void,
 *   setDimmed: (on: boolean) => void, setActive: (on: boolean) => void, stop: () => void, stats: () => { fps: number, running: boolean } }}
 */
export function createOutpostBackdrop({ reducedMotion = () => false, onUnavailable } = {}) {
  const layer = el('outpost3d-layer');
  const overlay = el('outpost3d-overlay');
  // Zoom: the wheel over the open outpost, these buttons, or the + and - keys. "Whole camp" frames every module.
  const zoomButton = (label, text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip o3d-zoom-btn';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  };
  const zoomBar = el('o3d-zoom', { role: 'group', 'aria-label': 'Zoom the outpost view' });
  zoomBar.append(
    zoomButton('Zoom in (+)', '+', () => scene?.zoomIn()),
    zoomButton('Zoom out (-)', '−', () => scene?.zoomOut()),
    zoomButton('Zoom out to see the whole camp', 'Whole camp', () => scene?.showWholeCamp()));
  overlay.append(zoomBar);
  const onZoomKey = (e) => {
    if (!active || !scene || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-backdrop, .coach')) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); scene.zoomIn(); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); scene.zoomOut(); }
  };
  document.addEventListener('keydown', onZoomKey);
  let scene = null;
  let mission = null;
  let description = '';
  let active = true;
  let stopped = false;
  let available = webglAvailable();
  let solKey = null;
  let solStartedAt = performance.now();
  let driftTimer = 0;

  const fail = (reason) => {
    available = false;
    api.available = false;
    onUnavailable?.(reason);
  };

  const model = () => {
    const key = mission ? `${mission.code}:${mission.config?.id}:${mission.sol}` : null;
    if (key !== solKey) { solKey = key; solStartedAt = performance.now(); }
    const base = outpostModelFrom(mission, { turnSeconds: (performance.now() - solStartedAt) / 1000, reducedMotion: reducedMotion() });
    return devPresets ? applyScenePresets(base, devPresets) : base;
  };

  // Keep the base in the middle of the clear stage window (the overlay fills it), following page scroll.
  const refocus = () => {
    if (!scene || !active || !overlay.isConnected) return;
    const r = overlay.getBoundingClientRect();
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    if (!r.width || !r.height) return;
    // the scene's own label plate sits under whatever alerts the HUD has stacked in the top-left of the window
    const alerts = overlay.parentElement?.querySelector('.scene-alerts');
    overlay.style.setProperty('--o3d-top', `${alerts?.childElementCount ? alerts.offsetHeight + 18 : 34}px`);
    scene.setFocus({
      x: Math.min(w * 0.8, Math.max(w * 0.2, r.left + r.width / 2)),
      y: Math.min(hgt * 0.78, Math.max(hgt * 0.3, r.top + r.height / 2)),
    });
  };
  const resizeObserver = new ResizeObserver(refocus);
  resizeObserver.observe(overlay);
  window.addEventListener('scroll', refocus, { passive: true });
  window.addEventListener('resize', refocus);

  const push = (animate) => {
    if (!scene || !mission) return;
    scene.update(model(), { animate });
    if (description) scene.renderer?.domElement.setAttribute('aria-label', description);
  };

  if (available) {
    import('./outpostScene.js').then(({ OutpostScene }) => {
      if (stopped) return;
      const s = new OutpostScene();
      s.mount(layer, { hudContainer: overlay, zoom: true, backdrop: true });
      scene = s;
      s.setPaused(!active);
      refocus();
      push(false);
      // the afternoon sun keeps creeping while the player plans the sol
      driftTimer = window.setInterval(() => { if (active && !document.hidden) push(true); }, 5000);
    }).catch((err) => fail(err?.message ?? String(err)));
  } else {
    queueMicrotask(() => fail('WebGL is switched off in this browser'));
  }

  const api = {
    layer,
    overlay,
    available,
    update(m, text) {
      mission = m;
      if (text) description = text;
      push(true);
      refocus();
    },
    setDimmed(on) { layer.classList.toggle('dimmed', Boolean(on)); },
    setActive(on) {
      active = Boolean(on);
      layer.hidden = !active;
      overlay.hidden = !active;
      scene?.setPaused(!active);
      if (active) { scene?.resize(); refocus(); push(false); }
    },
    stop() {
      stopped = true;
      window.clearInterval(driftTimer);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', refocus);
      window.removeEventListener('resize', refocus);
      document.removeEventListener('keydown', onZoomKey);
      try { scene?.dispose(); } catch { /* already gone */ }
      scene = null;
      layer.remove();
      overlay.remove();
    },
    stats: () => ({ fps: scene?.fps?.value ?? 0, running: Boolean(scene?.running) }),
  };
  if (import.meta.env?.DEV) window.__outpost3d = { ...window.__outpost3d, backdrop: api, scene: () => scene };
  return api;
}

/* ---------- globe site picker ---------- */
// The loadout screen rebuilds its panels on every change, so the globe lives in one persistent wrapper that is
// re-attached to each new slot (keeping its spin and WebGL context) and is thrown away after leaving the screen.
const globe = { wrap: null, scene: null, loading: null, onSelect: null, sel: null, failed: false };

function disposeGlobe() {
  try { globe.scene?.dispose(); } catch { /* already gone */ }
  globe.wrap?.remove();
  globe.wrap = null;
  globe.scene = null;
  globe.loading = null;
}

function watchGlobe() {
  const check = () => {
    if (!globe.wrap) return;
    if (globe.wrap.isConnected) { window.setTimeout(check, 1500); return; }
    disposeGlobe();
  };
  window.setTimeout(check, 1500);
}

/** True when the globe can be shown; the caller keeps its flat map as the fallback otherwise. */
export const globeAvailable = () => !globe.failed && webglAvailable();

/**
 * @param {{ body: 'mars'|'moon', worldId?: string|null, worldName?: string, selectedId: string|null, onSelect: (siteId: string) => void }} opts
 *   worldId: any world from src/data/worlds.js (the Cosminova sky picker); it wears the game's own painted map.
 * @returns {HTMLElement} a slot holding the (persistent) 3D globe
 */
export function globePicker({ body, worldId = null, worldName = null, selectedId, onSelect }) {
  const other = worldId && worldId !== 'moon' && worldId !== 'mars';
  const name = other ? (worldName ?? 'This world') : body === 'mars' ? 'Mars' : 'Moon';
  const slot = el(`globe3d globe3d-${other ? 'world' : body}`, {
    role: 'group',
    'aria-label': other
      ? `${name} globe, drawn by the game from NASA numbers. Drag to turn it. Tap a pin to choose a landing site.`
      : `${name} globe from NASA Trek mosaics. Tap a pin to choose a landing site.`,
  });
  const credit = el('globe3d-credit');
  credit.textContent = other ? 'Game drawing from NASA numbers · not a photo' : body === 'mars' ? 'Viking MDIM 2.1 · NASA Mars Trek' : 'LRO WAC · NASA Moon Trek';
  globe.onSelect = onSelect;
  globe.sel = { body, worldId: other ? worldId : null, siteId: selectedId };
  if (!globe.wrap) {
    const wrap = el('globe3d-wrap');
    wrap.addEventListener('select-site', (ev) => globe.onSelect?.(ev.detail.siteId));
    globe.wrap = wrap;
    globe.loading = import('./planetScene.js').then(({ PlanetScene }) => {
      if (globe.wrap !== wrap) return;
      const scene = new PlanetScene();
      scene.mount(wrap);
      globe.scene = scene;
      scene.update(globe.sel);
    }).catch(() => {
      globe.failed = true;
      const host = wrap.parentElement;
      disposeGlobe();
      if (host) host.hidden = true;
    });
    watchGlobe();
    if (import.meta.env?.DEV) window.__outpost3d = { ...window.__outpost3d, globe };
  }
  slot.append(globe.wrap, credit);
  if (globe.scene) {
    queueMicrotask(() => { globe.scene?.resize(); globe.scene?.update(globe.sel); });
  }
  return slot;
}
