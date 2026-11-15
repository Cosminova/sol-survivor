// World look: turns a world profile (src/data/worlds.js) into everything the three outpost views need to paint
// it. Pure: no three.js, no DOM. The look derives from the world's facts and palette; where a fact is generated
// the look is too (the UI labels provenance, not the renderer).
//
// Fact -> look:
//   ground        -> reliefStyle, accent colours, rockDensity
//   waterIce      -> iceCoverage (scaled by how cold the surface is and the site's iceAccess)
//   liquidWater   -> water pools when 'surface'; methane lakes on methane-rain worlds (Titan), in palette.liquid's colour
//   pressurePa    -> airless (black sky, stars by day, no dust) or haze thickness
//   air, palette  -> sky and haze colours
//   hazards       -> lava glow, dust, methane drizzle, plumes
//   tidal lock    -> the engine's lightMode(world, site): the star stands still, high (day), on the horizon
//                    (twilight) or out of sight (night)
//   star + orbit  -> star colour (teffK) and apparent size (radius / orbit)
//   parent        -> Jupiter or Saturn hanging in the sky of their moons
import { worldById } from '../data/worlds.js';
import { lightMode } from '../engine/worldModel.js';
import { hashString, clamp } from '../world3d/rng.js';
import { blackbodyRgb, rgbToHex, mixHex, darken, lighten, mixRgb } from './color.js';

export const AIRLESS_PRESSURE_PA = 10; // below this the sky is black: Io, Europa, Mercury, Pluto
export const SUN_TEFF_K = 5772;
const SUN_RADIUS_AU = 0.00465047;
const EARTH_RADIUS_M = 6371000;
const EARTH_GRAVITY = 9.80665;
const SOLAR_CONSTANT_WM2 = 1361;
const HOT_ROCK_C = 500; // hotter than this, airless rock is drawn as fractured basalt instead of craters
const HOT_AIR_C = 250;
const PARENT_HIDDEN_HAZE = 0.6; // Titan's haze hides Saturn

// Worlds that keep their NASA lidar terrain and hand-tuned look.
const LEGACY_IDS = new Set(['moon', 'mars']);
export const isLegacyWorld = (world) => !world || LEGACY_IDS.has(world.id);

// Sun distance of the planets that moons borrow when their own orbitAu is the orbit around the parent.
const PARENT_ORBIT_AU = { earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07, pluto: 39.48 };

// Giant planets seen from their moons. Radii and moon orbits in km (NASA planetary fact sheets).
const GIANTS = {
  jupiter: { radiusKm: 71492, bands: ['#c9b08a', '#a8744c', '#e6d7b8', '#8f5a3c', '#d8c3a0', '#b98a62'], rings: false, defaultDeg: 10 },
  saturn: { radiusKm: 60268, bands: ['#e3d3a4', '#cdb880', '#efe4c0', '#bfa56c', '#e8dab0'], rings: true, defaultDeg: 6 },
  uranus: { radiusKm: 25559, bands: ['#a8dfe6', '#9ad4de', '#b6e6ea'], rings: false, defaultDeg: 4 },
  neptune: { radiusKm: 24764, bands: ['#3f66d6', '#3558c0', '#4c78e0'], rings: false, defaultDeg: 4 },
};
const MOON_ORBIT_KM = { io: 421700, europa: 671100, ganymede: 1070400, callisto: 1882700, titan: 1221870, enceladus: 238040, triton: 354760 };

const ROCK_DENSITY = { regolith: 0.5, basalt: 0.7, 'iron-oxide': 0.6, sulfur: 0.3, 'ice-shell': 0.35, 'organic-dunes': 0.12, lava: 0.5, 'iron-rich': 0.65 };
const ACCENTS = {
  sulfur: ['#d9c341', '#e88b2c', '#f1ecd2', '#7a2a1c'], // yellow sulfur, orange, white SO2 frost, red vent ring
  'ice-shell': ['#8a5a44', '#b9d3e6'], // reddish salt stains along ridges, blue fresh ice
  'organic-dunes': ['#2f2118', '#c7a777'], // dark organic sand, pale icy gravel between dunes
  lava: ['#1b1513', '#ff7a1a'],
  'iron-oxide': ['#8a3e22', '#d9a37a'],
  'iron-rich': ['#3a3d44', '#8d6b52'],
};
const DEFAULT_ACCENTS = ['#4a4541', '#bdb6ac'];
const METHANE_COLOR = '#17110c';
const WATER_COLOR = '#1f4a66';
const LAVA_COLOR = '#ff6a1a';
const DEFAULT_ICE = '#dfe8ef';

const val = (fact, fallback) => (fact && fact.v !== undefined && fact.v !== null ? fact.v : fallback);
const num = (fact, fallback) => {
  const v = Number(val(fact, fallback));
  return Number.isFinite(v) ? v : fallback;
};

export const lookSeed = (worldId, siteId) => hashString(`${worldId ?? 'world'}:${siteId ?? 'site'}`);

/** Disc colour of a star from its effective temperature. Cool stars are pushed a little redder so they read at a glance. */
export function starColorFromTeff(teffK = SUN_TEFF_K) {
  const rgb = blackbodyRgb(teffK);
  const cool = clamp((4200 - teffK) / 1800, 0, 1);
  return rgbToHex(mixRgb(rgb, [rgb[0], rgb[1] * 0.72, rgb[2] * 0.45], cool));
}

/** Apparent width of the star in the sky, in degrees (the Sun from Earth is 0.53). */
export function starAngularSizeDeg(radiusSol = 1, orbitAu = 1) {
  const a = Math.max(orbitAu, radiusSol * SUN_RADIUS_AU * 1.05);
  return (2 * Math.atan((radiusSol * SUN_RADIUS_AU) / a) * 180) / Math.PI;
}

function starDistanceAu(world) {
  const own = num(world.facts?.orbitAu, 1);
  const viaParent = PARENT_ORBIT_AU[String(world.parent ?? '').toLowerCase()];
  // A moon listed with its orbit around the planet still sees the Sun from the planet's distance.
  if (world.kind === 'moon' && viaParent && own < viaParent * 0.5) return viaParent;
  return own > 0 ? own : 1;
}

function reliefStyleFor({ ground, airless, tempDayC, hazards }) {
  if (ground === 'ice-shell') return 'ice-chaos';
  if (ground === 'organic-dunes' || /dune/.test(ground)) return 'dunes';
  if (ground === 'lava' || ground === 'sulfur') return 'lava-flows';
  if (tempDayC >= HOT_ROCK_C || (!airless && tempDayC >= HOT_AIR_C)) return 'fractured-basalt';
  if (airless) return 'craters';
  return hazards.includes('dust-storms') && /sand/.test(ground) ? 'dunes' : 'plains';
}

function parentFor(world, haze) {
  const key = String(world.parent ?? '').toLowerCase();
  const giant = GIANTS[key];
  if (!giant || world.kind !== 'moon') return null;
  const orbitKm = MOON_ORBIT_KM[world.id];
  const angularSizeDeg = orbitKm ? (2 * Math.atan(giant.radiusKm / orbitKm) * 180) / Math.PI : giant.defaultDeg;
  return { id: key, angularSizeDeg, bands: giant.bands, rings: giant.rings, visible: haze < PARENT_HIDDEN_HAZE };
}

function iceCoverageFor({ waterIce, ground, site, ...world }) {
  if (ground === 'ice-shell') return clamp(Math.max(0.6, waterIce), 0, 1);
  // A site can be colder than its world (the twilight ring of a tidally locked planet).
  const tempDayC = Number.isFinite(site?.tempDayC) ? site.tempDayC : world.tempDayC;
  const tempNightC = Number.isFinite(site?.tempNightC) ? site.tempNightC : world.tempNightC;
  // Ice lasts in the open where days stay below freezing; on warmer worlds only the shadows keep some.
  const cold = tempDayC <= 0 ? 1 : tempNightC <= -50 ? 0.5 : 0.1;
  const siteK = Number.isFinite(site?.iceAccess) ? 0.6 + 0.7 * clamp(site.iceAccess, 0, 1) : 1;
  return clamp(waterIce * 0.5 * cold * siteK, 0, 0.8);
}

function liquidFor({ liquidWater, hazards, palette, declared }) {
  // Methane rain means methane lakes, even though the world's water is frozen or buried.
  const methane = declared === 'methane' || hazards.includes('methane-rain');
  if (!methane && liquidWater !== 'surface' && declared !== 'water') return null;
  return { kind: methane ? 'methane' : 'water', color: palette.liquid ?? (methane ? METHANE_COLOR : WATER_COLOR), coverage: methane ? 0.12 : 0.2 };
}

function lavaFor({ ground, hazards, tempDayC }) {
  const amount = (ground === 'lava' ? 0.3 : 0) + (hazards.includes('volcanism') ? 0.1 : 0) + (tempDayC >= 900 ? 0.15 : 0);
  return clamp(amount, 0, 0.5);
}

function skyFor({ airless, haze, palette }) {
  if (airless) return { skyTop: '#000000', skyHorizon: '#000000', hazeColor: '#000000' };
  const base = palette.sky ?? '#8fa3b8';
  const hazeColor = palette.haze ?? lighten(base, 0.2);
  return {
    skyTop: mixHex(darken(base, 0.45 * (1 - haze)), hazeColor, haze * 0.5),
    skyHorizon: mixHex(base, hazeColor, 0.5 + 0.5 * haze),
    hazeColor,
  };
}

/**
 * @param {import('../data/worlds.js').World} world
 * @param {{ id?: string, lat?: number, lon?: number, iceAccess?: number }|null} [site]
 */
export function worldLook(world, site = null) {
  const facts = world.facts ?? {};
  const palette = world.palette ?? {};
  const hazards = [].concat(val(facts.hazards, []) ?? []);
  const ground = String(val(facts.ground, 'regolith'));
  const pressurePa = Math.max(0, num(facts.pressurePa, 0));
  const tempDayC = num(facts.tempDayC, 0);
  const tempNightC = num(facts.tempNightC, tempDayC - 80);
  const waterIce = clamp(num(facts.waterIce, 0), 0, 1);
  const airless = pressurePa < AIRLESS_PRESSURE_PA;
  // 0.3 for thin Mars air, 0.7 under Titan's smog, 1 under Venus's clouds.
  const haze = airless ? 0 : clamp((Math.log10(pressurePa) - 1) / 6, 0.05, 1);
  const base = palette.ground ?? '#8d8a85';
  const rock = palette.rock ?? darken(base, 0.35);
  const sky = skyFor({ airless, haze, palette });
  const liquid = liquidFor({ liquidWater: val(facts.liquidWater, 'none'), hazards, palette, declared: world.liquid ?? null });
  const lava = lavaFor({ ground, hazards, tempDayC });
  const sunlight = num(facts.sunlightWm2, SOLAR_CONSTANT_WM2);
  const teffK = num(world.star?.teffK, SUN_TEFF_K);
  const dusty = !airless && hazards.includes('dust-storms');
  const light = lightMode(world, site); // 'cycle' or, on tidally locked worlds, 'day' | 'twilight' | 'night'

  return {
    worldId: world.id,
    seed: lookSeed(world.id, site?.id),
    ground,
    reliefStyle: reliefStyleFor({ ground, airless, tempDayC, hazards }),
    groundColors: {
      base, rock,
      dark: darken(base, 0.22),
      light: lighten(base, 0.2),
      dust: mixHex(lighten(base, 0.3), sky.hazeColor === '#000000' ? base : sky.hazeColor, airless ? 0 : 0.25),
      ice: palette.ice ?? DEFAULT_ICE,
      accents: ACCENTS[ground] ?? DEFAULT_ACCENTS,
    },
    rockDensity: clamp((ROCK_DENSITY[ground] ?? 0.5) * (haze > 0.8 ? 0.8 : 1), 0, 1),
    iceCoverage: iceCoverageFor({ waterIce, ground, tempDayC, tempNightC, site }),
    liquid,
    lava,
    lavaColor: LAVA_COLOR,
    airless,
    haze,
    ...sky,
    starColor: starColorFromTeff(teffK),
    starAngularSizeDeg: starAngularSizeDeg(num(world.star?.radiusSol, 1), starDistanceAu(world)),
    light,
    starFixed: light !== 'cycle',
    // Eyes adapt, so brightness follows the fourth root of the starlight; thick haze takes most of the direct beam.
    lightScale: clamp((sunlight / SOLAR_CONSTANT_WM2) ** 0.25, 0.45, 1.25),
    directLight: 1 - haze * 0.8,
    parent: parentFor(world, haze),
    particles: {
      dust: dusty,
      methaneRain: hazards.includes('methane-rain'),
      plumes: hazards.some((h) => h === 'cryovolcanism' || h === 'plumes' || h === 'geysers') || (airless && hazards.includes('volcanism')),
      plumeColor: ground === 'sulfur' ? '#d8e2b0' : hazards.includes('volcanism') ? '#8f8580' : '#dcefff', // sulfur gas, ash, or ice spray
      dustColor: sky.hazeColor === '#000000' ? lighten(base, 0.25) : mixHex(sky.hazeColor, base, 0.4),
    },
    gravityMs2: Math.max(0.05, num(facts.gravityG, 0.38)) * EARTH_GRAVITY,
    planetRadiusM: Math.max(50000, num(facts.radiusEarth, 0.5) * EARTH_RADIUS_M),
  };
}

const lookCache = new Map();

/** Look for a mission's world, or null for the Moon and Mars (which keep their lidar terrain and tuned look). */
export function lookFor(worldId, site = null) {
  const world = worldById(worldId);
  if (isLegacyWorld(world)) return null;
  const key = `${world.id}:${site?.id ?? ''}`;
  if (!lookCache.has(key)) lookCache.set(key, worldLook(world, site));
  return lookCache.get(key);
}

const PARENT_AZIMUTH_OFFSET = 1.9; // radians: the giant planet sits well away from the star in the sky
const PARENT_MIN_ELEVATION_DEG = 16; // kept clear of the hills so it can always be found

/** Where the giant planet hangs for a moon that always shows it the same face. */
export const parentDirection = (site) => fixedSkyDirection(site, PARENT_AZIMUTH_OFFSET, PARENT_MIN_ELEVATION_DEG);

export const lookForMission = (mission) => lookFor(mission?.config?.worldId ?? mission?.config?.body, mission?.site ?? null);

const DEG = Math.PI / 180;
const MIN_STAR_ELEVATION_DEG = 2;

/** Where a body that never moves in the sky sits: straight up at lat 0 lon 0, on the horizon 90 degrees away. */
export function fixedSkyDirection(site, azimuthOffset = 0, minElevationDeg = MIN_STAR_ELEVATION_DEG) {
  const lat = (site?.lat ?? 20) * DEG;
  const lon = (site?.lon ?? 30) * DEG;
  const el = Math.max(minElevationDeg * DEG, Math.asin(clamp(Math.cos(lat) * Math.cos(lon), -1, 1)));
  const az = Math.atan2(Math.sin(lon), -Math.sin(lat) * Math.cos(lon) || 1e-6) + azimuthOffset;
  return { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az), elevationDeg: el / DEG };
}

const BELOW_HORIZON = { x: -0.94, y: -0.34, z: 0, elevationDeg: -20 };
const TWILIGHT_ELEVATION_DEG = 6;
const MIN_DAY_ELEVATION_DEG = 12;

/** Where the star of a tidally locked world stands for good, from the site's light mode. */
export function fixedStarDirection(look, site) {
  if (look.light === 'night') return BELOW_HORIZON;
  const free = fixedSkyDirection(site);
  const el = (look.light === 'twilight' ? TWILIGHT_ELEVATION_DEG : Math.max(MIN_DAY_ELEVATION_DEG, free.elevationDeg)) * DEG;
  const flat = Math.hypot(free.x, free.z) || 1;
  return { x: (free.x / flat) * Math.cos(el), y: Math.sin(el), z: (free.z / flat) * Math.cos(el), elevationDeg: el / DEG };
}

/** Star direction for a look. t runs 0..1 across the playable day; a tidally locked world keeps the star still. */
export function starDirection(look, site, t, lit = true) {
  if (look.starFixed) return fixedStarDirection(look, site);
  if (!lit) return BELOW_HORIZON;
  const lat = (site?.lat ?? 0) * DEG;
  const h = (clamp(t, 0, 1.2) - 0.5) * Math.PI * 1.08; // a little before sunrise to a little after sunset
  const el = Math.asin(clamp(Math.cos(lat) * Math.cos(h), -1, 1));
  const az = Math.atan2(-Math.sin(h), -Math.sin(lat) * Math.cos(h));
  return { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az), elevationDeg: el / DEG };
}
