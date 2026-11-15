// Loads the bundled (offline) NASA datasets once and builds the simulation context.
// Campaign chapters always use the archived 2024–2025 records, so they stay deterministic.
// A "Today's real Sun" mission carries its own live storms (frozen in config.live.seps when it was
// built), and loadSimContext() adds them for that mission only.
import { buildWeatherIndex } from '../engine/environment.js';
import { classifySepEvents } from '../engine/spaceWeather.js';
import { loadLive } from '../live/liveData.js';
import { liveSeps, mergeSeps } from '../live/liveMission.js';
import { getState } from './store.js';

const cache = new Map();

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return res.json();
}

function once(key, loader) {
  if (!cache.has(key)) {
    cache.set(key, loader().catch((err) => {
      cache.delete(key);
      throw err;
    }));
  }
  return cache.get(key);
}

export const loadRems = () => once('rems', () => fetchJson('./data/rems.json'));
export const loadDonki = () => once('donki', () => fetchJson('./data/donki.json'));
export const loadGallery = () => once('gallery', () => fetchJson('./data/gallery.json'));

// ctx = { weatherIndex, seps } as expected by createMission/beginSol. Falls back to an empty ctx
// (engine uses built-in fallbacks) so the game still runs if a data file fails to load.
const loadArchiveContext = () => once('ctx', async () => {
  const [rems, donki] = await Promise.allSettled([loadRems(), loadDonki()]);
  return {
    weatherIndex: rems.status === 'fulfilled' ? buildWeatherIndex(rems.value) : null,
    seps: donki.status === 'fulfilled' ? classifySepEvents(donki.value) : [],
  };
});

function savedLiveSeps() {
  try { return getState().savedMission?.config?.live?.seps ?? []; } catch { return []; }
}

/**
 * The simulation context.
 *  - loadSimContext()                 archive only, plus the saved mission's own frozen live storms (if it is a live mission).
 *  - loadSimContext({ seps })         archive plus the given live storms (used when launching a live mission).
 *  - loadSimContext({ live: true })   archive plus storms derived from NASA DONKI right now.
 * Live storms are dated 2026 or later and the archive ends in 2025, so campaign chapters never see them.
 * @param {{ live?: boolean, seps?: object[] }} [opts]
 */
export async function loadSimContext(opts = {}) {
  const base = await loadArchiveContext();
  let extra = opts.seps ?? savedLiveSeps();
  let source = extra.length ? 'mission' : 'archive';
  if (opts.live) {
    const live = await loadLive();
    extra = live.sun.source === 'live' ? liveSeps(live.donki) : [];
    source = live.sun.source;
  }
  if (!extra.length) return base;
  return { ...base, seps: mergeSeps(base.seps, extra), liveSource: source, liveCount: extra.length };
}
