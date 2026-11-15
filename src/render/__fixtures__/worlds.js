// Small synthetic worlds for the look tests and the visual check, shaped like src/data/worlds.js entries.
// They pin each look rule to a fixed input so the tests do not move when the real catalogue is refreshed; the
// values are rough and every fact is marked generated.
import { generated } from '../../data/worlds.js';

const baseFacts = {
  radiusEarth: generated(0.4), massEarth: generated(0.02), densityGcc: generated(2), gravityG: generated(0.14),
  dayHours: generated(100), yearDays: generated(4000), orbitAu: generated(5.2), sunlightWm2: generated(50),
  tempDayC: generated(-150), tempNightC: generated(-180), pressurePa: generated(0), air: generated([]),
  magneticField: generated('none'), radiationMsvPerDay: generated(1), waterIce: generated(0),
  liquidWater: generated('none'), ground: generated('regolith'), hazards: generated([]),
};

const site = (id, lat, lon, iceAccess = 0.5) => ({ id, name: id, lat, lon, iceAccess, science: 1, blurb: '', origin: 'generated' });

const world = (id, extra, facts, palette, sites) => ({
  id, name: id, kind: 'moon', parent: null, system: 'sol', analog: 'moon', sky: null, star: null, blurb: '',
  ...extra,
  facts: { ...baseFacts, ...Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, generated(v)])) },
  palette: { ground: '#8d8a85', rock: '#5d5a56', ice: null, sky: '#000000', haze: null, liquid: null, ...palette },
  sites,
});

export const TITAN_LIKE = world('fx-titan', { parent: 'saturn', analog: 'mars' }, {
  radiusEarth: 0.404, gravityG: 0.138, orbitAu: 9.54, sunlightWm2: 15, tempDayC: -179, tempNightC: -180, pressurePa: 146700,
  air: [{ gas: 'N2', pct: 95 }, { gas: 'CH4', pct: 5 }], waterIce: 0.3, liquidWater: 'surface', ground: 'organic-dunes', hazards: ['methane-rain'],
}, { ground: '#6b4a2a', rock: '#8a7a66', ice: '#cfc7b8', sky: '#b9742c', haze: '#d98a32', liquid: '#17110c' }, [site('fx-titan-shore', 68, 310, 0.3)]);

export const IO_LIKE = world('fx-io', { parent: 'jupiter' }, {
  radiusEarth: 0.286, gravityG: 0.183, sunlightWm2: 50, tempDayC: -130, tempNightC: -180, ground: 'sulfur', hazards: ['volcanism', 'flares', 'tidal-quakes'],
}, { ground: '#c9b24a', rock: '#6e5a2c', sky: '#000000' }, [site('fx-io-plain', 12, 20, 0)]);

export const EUROPA_LIKE = world('fx-europa', { parent: 'jupiter' }, {
  radiusEarth: 0.245, gravityG: 0.134, sunlightWm2: 50, tempDayC: -160, tempNightC: -220, waterIce: 1, liquidWater: 'subsurface', ground: 'ice-shell',
  hazards: ['flares', 'cryovolcanism'],
}, { ground: '#cfd6da', rock: '#9aa7b0', ice: '#eef6fb', sky: '#000000' }, [site('fx-europa-chaos', -9, 25, 1)]);

export const HOT_EXOPLANET = world('fx-hot', {
  kind: 'exoplanet', parent: 'Fixture Star', system: 'Fixture Star',
  star: { name: 'Fixture Star', teffK: generated(3300), radiusSol: generated(0.2), massSol: generated(0.2), luminositySol: generated(0.004), spectralType: generated('M4 V'), distanceLy: generated(20) },
}, {
  radiusEarth: 1.3, gravityG: 1.4, dayHours: 36, yearDays: 1.5, orbitAu: 0.015, sunlightWm2: 24000, tempDayC: 1100, tempNightC: 300,
  ground: 'lava', hazards: ['extreme-heat', 'volcanism', 'tidal-lock'],
}, { ground: '#3a2a26', rock: '#1e1716', sky: '#000000' }, [site('fx-hot-shore', 20, 40, 0)]);

// Airless rock held face-on to a red dwarf, like the first sketch of Proxima Centauri b.
export const RED_DWARF_ROCK = world('fx-red-rock', {
  kind: 'exoplanet', parent: 'Fixture Dwarf', system: 'Fixture Dwarf',
  star: { name: 'Fixture Dwarf', teffK: generated(2900), radiusSol: generated(0.141), massSol: generated(0.12), luminositySol: generated(0.0014), spectralType: generated('M5.5 V'), distanceLy: generated(4.2) },
}, {
  radiusEarth: 1.02, gravityG: 1.01, dayHours: 268.4, yearDays: 11.18465, orbitAu: 0.04848, sunlightWm2: 889, tempDayC: 30, tempNightC: -150,
  waterIce: 0.4, ground: 'basalt', hazards: ['flares', 'tidal-lock'],
}, { ground: '#6b5a4e', rock: '#3f3530', ice: '#d8e4ee', sky: '#1a0d08' }, []);

export const FIXTURE_WORLDS = [TITAN_LIKE, IO_LIKE, EUROPA_LIKE, HOT_EXOPLANET, RED_DWARF_ROCK];
