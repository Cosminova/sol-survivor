// Landing sites. Map positions are planetocentric lat/lon (east-positive).
// tempOffsetC adjusts Gale Crater REMS readings for a site's latitude and elevation.
import { EXO_WORLDS } from './exoWorlds.js';
import { SOL_WORLDS } from './solWorlds.js';

export const SITES = [
  {
    id: 'jezero', body: 'mars', name: 'Jezero Crater', lat: 18.4, lon: 77.5,
    iceAccess: 0.2, science: 1.6, tempOffsetC: -6, sunlit: 1, source: 'mars-sites',
    blurb: 'An ancient river delta where Perseverance hunts for signs of past life. Amazing science, but little ice.',
  },
  {
    id: 'gale', body: 'mars', name: 'Gale Crater', lat: -4.6, lon: 137.4,
    iceAccess: 0.15, science: 1.3, tempOffsetC: 0, sunlit: 1, source: 'rems',
    blurb: 'Curiosity’s home since 2012. Warm for Mars, sunny all year, and the source of our weather data.',
  },
  {
    id: 'arcadia', body: 'mars', name: 'Arcadia Planitia', lat: 40.0, lon: -150.0,
    iceAccess: 1.0, science: 0.9, tempOffsetC: -18, sunlit: 1, source: 'ice',
    blurb: 'Flat plains with water ice just under the surface. Easy water, colder nights, weaker winter sun.',
  },
  {
    id: 'utopia', body: 'mars', name: 'Utopia Planitia', lat: 47.6, lon: 134.0,
    iceAccess: 0.8, science: 1.0, tempOffsetC: -22, sunlit: 1, source: 'mars-sites',
    blurb: 'Viking 2 landed here in 1976 and photographed winter frost. Icy ground, harsh winters.',
  },
  {
    id: 'shackleton', body: 'moon', name: 'Shackleton Crater Rim', lat: -89.7, lon: 129.8,
    iceAccess: 0.9, science: 1.3, tempDayC: -50, tempNightC: -170, sunlit: 0.85, source: 'artemis',
    blurb: 'Artemis country. Sunlit about 85% of the time and next to shadowed craters full of ice.',
  },
  {
    id: 'tranquility', body: 'moon', name: 'Mare Tranquillitatis', lat: 0.67, lon: 23.47,
    iceAccess: 0, science: 1.1, tempDayC: 120, tempNightC: -130, sunlit: 0.5, source: 'moon-fact',
    blurb: 'Where Apollo 11 landed in 1969. Two weeks of blazing sun, then two weeks of freezing night.',
  },
];

// Sites of every other world live on the world itself (solSites.js for real named places, exoSites.js for the
// game model's guesses). They are read from the leaf modules, not from worlds.js, to avoid a circular import.
const OTHER_WORLD_SITES = [...SOL_WORLDS, ...EXO_WORLDS].flatMap((world) => world.sites);
const SITE_INDEX = new Map([...SITES, ...OTHER_WORLD_SITES].map((site) => [site.id, site]));

/** Resolves a site of any world: Moon, Mars, another solar-system world or an exoplanet. */
export const siteById = (id) => SITE_INDEX.get(id) ?? null;

/** Moon and Mars sites only, for the existing body-specific screens. */
export const sitesForBody = (body) => SITES.filter((s) => s.body === body);

/** Every site of one world, by world id ('moon', 'europa', 'proxima-cen-b', ...). */
export const sitesForWorld = (worldId) => {
  const bodySites = SITES.filter((site) => site.body === worldId);
  return bodySites.length ? bodySites : OTHER_WORLD_SITES.filter((site) => site.worldId === worldId);
};
