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

export const real = (v, src) => ({ v, origin: 'real', src });
export const derived = (v, src) => ({ v, origin: 'derived', src });
export const generated = (v) => ({ v, origin: 'generated', src: 'game-model' });

export const isMeasured = (fact) => fact?.origin === 'real' || fact?.origin === 'derived';
export const factLabel = (fact) => (isMeasured(fact) ? 'Real · NASA' : 'Generated · game model');

// Moon and Mars mirror src/data/constants.js and src/data/sites.js (the data agent wires them, not copies).
export const WORLDS = [
  {
    id: 'moon', name: 'The Moon', kind: 'moon', parent: 'earth', system: 'sol', analog: 'moon', sky: null, star: null,
    facts: {
      radiusEarth: real(0.2727, 'moon-fact'), massEarth: real(0.0123, 'moon-fact'), densityGcc: real(3.344, 'moon-fact'),
      gravityG: real(0.1654, 'moon-fact'), dayHours: real(708.7, 'moon-fact'), yearDays: real(365.25, 'moon-fact'),
      orbitAu: real(1.0, 'moon-fact'), sunlightWm2: real(1361, 'moon-fact'),
      tempDayC: real(120, 'moon-fact'), tempNightC: real(-130, 'moon-fact'), pressurePa: real(0, 'moon-fact'),
      air: real([], 'moon-fact'), magneticField: real('none', 'moon-fact'), radiationMsvPerDay: real(1.37, 'lnd-2020'),
      waterIce: real(0.5, 'moon-fact'), liquidWater: real('none', 'moon-fact'), ground: real('regolith', 'moon-fact'),
      hazards: real(['flares', 'micrometeoroids', 'long-night'], 'moon-fact'),
    },
    palette: { ground: '#8d8a85', rock: '#5d5a56', ice: '#dfe8ef', sky: '#000000', haze: null, liquid: null },
    sites: [], // filled from src/data/sites.js
    blurb: 'Our closest neighbour. No air, two-week days and two-week nights.',
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', parent: null, system: 'sol', analog: 'mars', sky: null, star: null,
    facts: {
      radiusEarth: real(0.532, 'mars-fact'), massEarth: real(0.107, 'mars-fact'), densityGcc: real(3.933, 'mars-fact'),
      gravityG: real(0.379, 'mars-fact'), dayHours: real(24.6597, 'mars-fact'), yearDays: real(687, 'mars-fact'),
      orbitAu: real(1.52371, 'mars-fact'), sunlightWm2: real(586.2, 'mars-fact'),
      tempDayC: real(-5, 'rems'), tempNightC: real(-75, 'rems'), pressurePa: real(610, 'mars-fact'),
      air: real([{ gas: 'CO2', pct: 95 }, { gas: 'N2', pct: 2.8 }, { gas: 'Ar', pct: 2 }], 'mars-fact'),
      magneticField: real('none', 'mars-fact'), radiationMsvPerDay: real(0.64, 'rad-2014'),
      waterIce: real(0.6, 'mars-fact'), liquidWater: real('none', 'mars-fact'), ground: real('iron-oxide', 'mars-fact'),
      hazards: real(['dust-storms', 'flares'], 'mars-fact'),
    },
    palette: { ground: '#b5603a', rock: '#7a3b22', ice: '#f1ece6', sky: '#c9a27e', haze: '#d9b48f', liquid: null },
    sites: [],
    blurb: 'The red planet. Thin carbon dioxide air, dust storms and buried ice.',
  },
  // Example exoplanet showing the provenance mix. Values from the NASA Exoplanet Archive (pscomppars); the data
  // agent re-fetches and verifies them, and the generated facts come from the game model.
  {
    id: 'proxima-cen-b', name: 'Proxima Centauri b', kind: 'exoplanet', parent: 'Proxima Cen', system: 'Proxima Cen', analog: 'moon',
    sky: { ra: 217.3934657, dec: -62.6761821 },
    star: {
      name: 'Proxima Centauri', teffK: real(2900, 'exo-archive'), radiusSol: real(0.141, 'exo-archive'), massSol: real(0.1221, 'exo-archive'),
      luminositySol: derived(0.0014, 'radius+teff'), spectralType: real('M5.5 V', 'exo-archive'), distanceLy: derived(4.24, 'exo-archive'),
    },
    facts: {
      radiusEarth: real(1.02, 'exo-archive'), massEarth: real(1.055, 'exo-archive'), densityGcc: real(5.46, 'exo-archive'),
      gravityG: derived(1.01, 'mass+radius'), dayHours: derived(268.4, 'tidal-lock'), yearDays: real(11.18465, 'exo-archive'),
      orbitAu: real(0.04848, 'exo-archive'), sunlightWm2: derived(889, 'luminosity+orbit'),
      tempDayC: generated(30), tempNightC: generated(-150), pressurePa: generated(0),
      air: generated([]), magneticField: generated('weak'), radiationMsvPerDay: generated(5),
      waterIce: generated(0.4), liquidWater: generated('none'), ground: generated('basalt'),
      hazards: generated(['flares', 'tidal-lock']),
    },
    palette: { ground: '#6b5a4e', rock: '#3f3530', ice: '#d8e4ee', sky: '#1a0d08', haze: null, liquid: null },
    sites: [],
    blurb: 'The closest exoplanet to Earth, circling a small red star that flares often.',
  },
];

export const worldById = (id) => WORLDS.find((w) => w.id === id) ?? null;
export const worldsInSystem = (system) => WORLDS.filter((w) => w.system === system);
