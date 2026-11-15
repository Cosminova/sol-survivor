// Keeps one sky scene alive while the Cosminova tab is on screen. The loadout rebuilds its panels on every change,
// so the WebGL canvas lives in a persistent wrapper that is re-attached to each new panel and thrown away (WebGL
// context and all) once it has been off the page for a moment. three.js and the star catalogue load lazily here.
import { webglAvailable } from '../outpost3d/sceneUtil.js';

const DISPOSE_CHECK_MS = 1500;
const sky = { wrap: null, scene: null, loading: null, failed: false, onPick: null, onReady: null, onFail: null, assets: null };

let assetsPromise = null;
/** Loads three.js + the sky scene and the star catalogue once. */
export function loadSkyAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all([import('./skyScene.js'), import('../../data/skyStars.json')])
      .then(([sceneModule, starModule]) => {
        const data = starModule.default ?? starModule;
        if (!Array.isArray(data?.stars)) throw new Error('The star catalogue is missing');
        sky.assets = { SkyScene: sceneModule.SkyScene, stars: data.stars, names: data.names ?? {} };
        return sky.assets;
      })
      .catch((err) => {
        assetsPromise = null;
        throw err;
      });
  }
  return assetsPromise;
}

function disposeSky() {
  try { sky.scene?.dispose(); } catch (err) { console.warn('[worldPicker] sky dispose failed', err); }
  sky.wrap?.remove();
  sky.wrap = null;
  sky.scene = null;
  sky.loading = null;
}

function watchSky() {
  const check = () => {
    if (!sky.wrap) return;
    if (sky.wrap.isConnected) { window.setTimeout(check, DISPOSE_CHECK_MS); return; }
    disposeSky();
  };
  window.setTimeout(check, DISPOSE_CHECK_MS);
}

/** True when a 3D sky can be drawn; otherwise the target list alone is the picker. */
export const skyAvailable = () => !sky.failed && webglAvailable();

/** The scene once mounted, or null. */
export const skyScene = () => sky.scene;

/**
 * The persistent sky canvas wrapper.
 * @param {{ onPick: (targetId: string) => void, onReady: (scene: object) => void, onFail: (err: Error) => void }} opts
 * @returns {HTMLElement}
 */
export function skyStage({ onPick, onReady, onFail }) {
  sky.onPick = onPick;
  sky.onReady = onReady;
  sky.onFail = onFail;
  if (!sky.wrap) {
    const wrap = document.createElement('div');
    wrap.className = 'wp-sky-wrap';
    sky.wrap = wrap;
    sky.loading = loadSkyAssets().then(({ SkyScene, stars, names }) => {
      if (sky.wrap !== wrap) return;
      const scene = new SkyScene();
      scene.mount(wrap, { stars, names, onPick: (id) => sky.onPick?.(id) });
      sky.scene = scene;
      sky.onReady?.(scene);
    }).catch((err) => {
      console.error('[worldPicker] the night sky could not load', err);
      sky.failed = true;
      disposeSky();
      sky.onFail?.(err);
    });
    watchSky();
    if (import.meta.env?.DEV) window.__worldPicker = { sky };
  } else if (sky.scene) {
    queueMicrotask(() => { sky.scene?.resize(); sky.onReady?.(sky.scene); });
  }
  return sky.wrap;
}
