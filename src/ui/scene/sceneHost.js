// Keeps the 3D scenes alive across app.js re-renders. Screens are rebuilt with innerHTML, so each render leaves an
// empty `[data-scene="outpost|planet"]` slot; we re-attach a persistent wrapper (renderer + canvas + HUD) into it,
// the same way dataBadge placeholders are swapped in. A scene is created once, updated on every render, and disposed
// when its slot disappears (screen change). Three.js is loaded lazily so the first paint of the app is not blocked.
import { sceneModelFrom, applyScenePresets } from './sceneModel.js';
import { webglAvailable } from './sceneUtil.js';

const host = {
  outpost: null, // { wrap, scene, gen }
  planet: null,
  solStartedAt: 0,
  lastSol: null,
  lastCode: null,
  gen: 0,
};

const devPresets = (() => {
  try {
    return new URLSearchParams(window.location.search).get('scene') || '';
  } catch {
    return '';
  }
})();

const outpostModule = () => (host.outpostImport ??= import('./outpostScene.js'));
const planetModule = () => (host.planetImport ??= import('./planetScene.js'));

function fallback(slot, text) {
  slot.classList.add('scene-fallback');
  slot.innerHTML = `<p class="hint">${text}</p>`;
}

/** Builds the plain model for the outpost from the store, with the dev preset overrides applied. */
export function outpostModel(store) {
  const mission = store.mission;
  const sol = mission?.sol ?? null;
  if (mission?.code !== host.lastCode || sol !== host.lastSol) {
    host.lastCode = mission?.code ?? null;
    host.lastSol = sol;
    host.solStartedAt = performance.now();
  }
  const turnSeconds = (performance.now() - host.solStartedAt) / 1000;
  let model = sceneModelFrom(mission, { turnSeconds, body: store.setup?.body, siteId: store.setup?.siteId });
  if (devPresets) model = applyScenePresets(model, devPresets);
  return model;
}

function attach(entry, slot) {
  if (entry.wrap.parentElement !== slot) {
    slot.replaceChildren(entry.wrap);
    entry.scene?.resize?.();
  }
}

async function mountOutpost(slot, store) {
  if (!webglAvailable()) return fallback(slot, '3D view needs WebGL, which this browser has switched off. The mission works fine without it.');
  const dim = !!store.root?.querySelector('[data-modal]');
  if (!host.outpost) {
    const wrap = document.createElement('div');
    wrap.className = 'hero3d-wrap';
    const entry = { wrap, scene: null, gen: ++host.gen };
    host.outpost = entry;
    slot.replaceChildren(wrap);
    wrap.classList.toggle('dimmed', dim);
    try {
      const { OutpostScene } = await outpostModule();
      if (host.outpost !== entry) return;
      const scene = new OutpostScene();
      scene.mount(wrap);
      entry.scene = scene;
      // the slot may have been re-rendered while three loaded
      const live = store.root?.querySelector('[data-scene="outpost"]');
      if (live) attach(entry, live);
      scene.update(outpostModel(store), { animate: false });
    } catch (err) {
      host.outpost = null;
      fallback(slot, `3D view unavailable here (${err?.message ?? err}). The mission works fine without it.`);
    }
    return;
  }
  attach(host.outpost, slot);
  host.outpost.wrap.classList.toggle('dimmed', dim);
  host.outpost.scene?.update(outpostModel(store), { animate: true });
}

async function mountPlanet(slot, store) {
  if (!webglAvailable()) return fallback(slot, '3D globe needs WebGL. Pick a site from the cards below.');
  const sel = { body: store.setup?.body ?? 'mars', siteId: store.setup?.siteId ?? null };
  if (!host.planet) {
    const wrap = document.createElement('div');
    wrap.className = 'hero3d-wrap';
    const entry = { wrap, scene: null, gen: ++host.gen };
    host.planet = entry;
    slot.replaceChildren(wrap);
    try {
      const { PlanetScene } = await planetModule();
      if (host.planet !== entry) return;
      const scene = new PlanetScene();
      scene.mount(wrap);
      entry.scene = scene;
      const live = store.root?.querySelector('[data-scene="planet"]');
      if (live) attach(entry, live);
      scene.update({ body: store.setup?.body ?? 'mars', siteId: store.setup?.siteId ?? null });
    } catch (err) {
      host.planet = null;
      fallback(slot, `3D globe unavailable here (${err?.message ?? err}). Pick a site from the cards below.`);
    }
    return;
  }
  attach(host.planet, slot);
  host.planet.scene?.update(sel);
}

function disposeEntry(key) {
  const entry = host[key];
  if (!entry) return;
  host[key] = null;
  try {
    entry.scene?.dispose();
  } catch {
    /* already gone */
  }
  entry.wrap.remove();
}

/** Call after every render: attaches scenes to their slots, disposes the ones whose screen went away. */
export function mountScenes(root, store) {
  const outSlot = root.querySelector('[data-scene="outpost"]');
  const planetSlot = root.querySelector('[data-scene="planet"]');
  if (outSlot) mountOutpost(outSlot, store);
  else disposeEntry('outpost');
  if (planetSlot) mountPlanet(planetSlot, store);
  else disposeEntry('planet');
}

export function disposeScenes() {
  disposeEntry('outpost');
  disposeEntry('planet');
}

/** Debug hook for perf checks: current fps of the outpost loop (0 when not running). */
export function sceneStats() {
  return { outpostFps: host.outpost?.scene?.fps?.value ?? 0, planetRunning: !!host.planet?.scene?.running };
}
