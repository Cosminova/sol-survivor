// World profiles: every place the player can land, from the Moon and Mars to rocky planets of nearby stars.
// CONTRACT FILE for the world-picker work. The data agent fills WORLDS from NASA sources; the engine, the
// sky picker and the terrain painter read only the shape documented here.
//
// Provenance is per fact, never per world. Each fact is { v, origin, src }:
//   origin 'real'      measured or published by NASA (src is an id in src/data/sources.js)
//   origin 'derived'   computed from real facts with plain physics (src names the inputs, e.g. 'mass+radius')
//   origin 'generated' a game model's guess where NASA has no measurement (src: 'game-model')
// The UI must show 'Real · NASA' for real and derived facts and 'Generated · game model' for generated ones.
//
// Mission wiring (all agents): a mission config carries worldId and siteId; config.body stays 'moon'|'mars' and is set
// to world.analog so the existing body-specific UI keeps working. siteById() in src/data/sites.js resolves sites of
// every world. Renderers and the engine look the world up with worldById(config.worldId ?? config.body).
//
// Optional extras the data adds (never required by readers): fact.note (a plain-words caveat such as "minimum mass"),
// site.worldId/body/sunlit/tempDayC/tempNightC/source, and on exoplanets world.discovery, world.disputed (the archive
// flags the planet as controversial) and world.tidallyLocked (a generated fact).
//
// Where the data lives: solWorlds.js (NASA fact sheets), exoWorlds.generated.js (NASA Exoplanet Archive snapshot,
// refreshed by `npm run fetch-worlds`), exoWorlds.js (turns the snapshot into worlds), worldModel.js (the documented
// game model behind every 'generated' fact) and worldPalette.js (colours from ground, ice, liquid and haze).
//
// analog says which existing code path a world borrows where the game has no general rule yet:
// 'moon' = airless or near-airless, 'mars' = has an atmosphere. Engine numbers always come from facts.

/** @typedef {'real'|'derived'|'generated'} Origin */
/** @typedef {{ v: any, origin: Origin, src: string }} Fact */

/**
 * @typedef {{
 *   id: string, name: string,
 *   kind: 'planet'|'moon'|'dwarf-planet'|'exoplanet',
 *   parent: string|null,                // 'jupiter' for Europa, the host star name for an exoplanet, null for planets
 *   system: 'sol'|string,               // 'sol' or the host star name
 *   analog: 'moon'|'mars',
 *   sky: { ra: number, dec: number }|null,   // host star position (deg, J2000) for exoplanets; null = computed from ephemeris
 *   star: { name: string, teffK: Fact, radiusSol: Fact, massSol: Fact, luminositySol: Fact, spectralType: Fact, distanceLy: Fact }|null,
 *   facts: {
 *     radiusEarth: Fact, massEarth: Fact, densityGcc: Fact, gravityG: Fact,
 *     dayHours: Fact,                   // solar day length (tidally locked exoplanets: = orbital period, flagged derived)
 *     yearDays: Fact, orbitAu: Fact,
 *     sunlightWm2: Fact,                // starlight at the top of the atmosphere
 *     tempDayC: Fact, tempNightC: Fact, // surface temperature range
 *     pressurePa: Fact,                 // surface pressure (0 = airless)
 *     air: Fact,                        // [{ gas: 'CO2', pct: 95 }, ...] or []
 *     magneticField: Fact,              // 'none'|'weak'|'strong'
 *     radiationMsvPerDay: Fact,         // surface dose for an unshielded astronaut
 *     waterIce: Fact,                   // 0..1, how easy it is to dig up ice
 *     liquidWater: Fact,                // 'none'|'subsurface'|'surface'
 *     ground: Fact,                     // 'basalt'|'regolith'|'iron-oxide'|'sulfur'|'ice-shell'|'organic-dunes'|'lava'|'iron-rich'|...
 *     hazards: Fact,                    // ['flares','dust-storms','volcanism','acid-clouds','extreme-heat','tidal-quakes','methane-rain',...]
 *   },
 *   palette: { ground: string, rock: string, ice: string|null, sky: string, haze: string|null, liquid: string|null },
 *   sites: Array<{ id: string, name: string, lat: number, lon: number, iceAccess: number, science: number, blurb: string, origin: Origin }>,
 *   blurb: string,
 * }} World
 */

import { EXO_WORLDS } from './exoWorlds.js';
import { SITES } from './sites.js';
import { SOL_WORLDS } from './solWorlds.js';

export { real, derived, generated, isMeasured, factLabel } from './worldFacts.js';
export { EXO_RETRIEVED } from './exoWorlds.js';

// Moon and Mars keep their sites in sites.js; here they are only tagged with the world they belong to.
const withBodySites = (world) => {
  const bodySites = SITES.filter((site) => site.body === world.id);
  return bodySites.length ? { ...world, sites: bodySites.map((site) => ({ ...site, worldId: world.id, origin: 'real' })) } : world;
};

/** @type {World[]} */
export const WORLDS = [...SOL_WORLDS.map(withBodySites), ...EXO_WORLDS];

const WORLD_INDEX = new Map(WORLDS.map((world) => [world.id, world]));

export const worldById = (id) => WORLD_INDEX.get(id) ?? null;
export const worldsInSystem = (system) => WORLDS.filter((w) => w.system === system);
