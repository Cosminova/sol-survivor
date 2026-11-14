// Loads the bundled (offline) NASA datasets once and builds the simulation context.
import { buildWeatherIndex } from '../engine/environment.js';
import { classifySepEvents } from '../engine/spaceWeather.js';

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
export const loadSimContext = () => once('ctx', async () => {
  const [rems, donki] = await Promise.allSettled([loadRems(), loadDonki()]);
  return {
    weatherIndex: rems.status === 'fulfilled' ? buildWeatherIndex(rems.value) : null,
    seps: donki.status === 'fulfilled' ? classifySepEvents(donki.value) : [],
  };
});
