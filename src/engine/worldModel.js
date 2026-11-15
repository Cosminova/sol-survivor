// World physics: turns a World profile (src/data/worlds.js) plus a landing site into the plain numbers the
// simulation runs on. Pure functions only. The Moon and Mars keep their own older code paths in sim.js
// (REMS weather, dust seasons, the 29.5-day lunar day); every other world is driven from here.
//
// Every number in a profile comes from world.facts. Where a fact is 'generated' the data layer has already
// labelled it; this file never invents facts, it only applies the same rules to whatever numbers it is given.
// The RULES below are game-model knobs (how strongly a fact acts on the outpost), not measurements.
import { POWER, SHIELDING, LIFE_SUPPORT, RADIATION, EARTH_SOLAR_CONSTANT } from '../data/constants.js';
import { worldById } from '../data/worlds.js';
import { siteById } from '../data/sites.js';

export const LEGACY_WORLD_IDS = ['moon', 'mars'];

export const RULES = {
  // Day length. A world whose day is 18–36 h is played one local day per turn (like a Mars sol). Anything
  // slower or faster is played in 24 h Earth-day turns and the Sun rises and sets across the turns.
  minDailyTurnHours: 18,
  maxDailyTurnHours: 36,
  earthDayHours: 24,
  litTurnFraction: 0.25, // a turn counts as "daytime" if the Sun is up for at least a quarter of it
  longNightTurns: 2, // a night this many turns long gets a nightfall warning card
  // Tidally locked worlds: the star never moves in the sky. mu = cos(angle from the point right under the star).
  twilightBand: 0.17, // |mu| below this (within ~10° of the day/night line) is permanent twilight
  twilightSunFraction: 0.25, // low Sun through a long path: a quarter of full starlight on upright panels
  flatPanelGeometry: 2 / Math.PI, // a Sun that arcs across the sky, averaged over the daylight hours
  // Air and light. Thick air dims the Sun at the ground.
  thinAirPa: 100, // below this the world is treated as airless (micrometeoroids, no dust in the air)
  denseAirPa: 1000,
  hazeFloor: 0.02,
  thinAirTransmission: 0.85,
  transmissionPerDecade: 0.2,
  stormDimming: 0.35, // same exponent as Mars dust: exp(-0.35 · tau)
  // Heat. In a vacuum a habitat only loses heat as infrared glow (∝ T⁴), so −220 °C is barely worse than
  // −130 °C. The glow term is calibrated to the lunar-night heat leak the Moon chapters already use.
  // Thick air adds heat carried away (or pushed in) by the gas itself.
  calibrationColdC: -130,
  convectionKwPerDegreePerDecade: 0.005,
  coolAboveC: 35,
  coolKwPerDegree: 0.021,
  coolAirBoostPerDecade: 0.25,
  // Radiation. The first 2 mSv/day is treated as cosmic rays (hard to stop, SHIELDING.gcrFactor). Anything
  // above that is trapped-belt or stellar particles, which a dug-in habitat stops far better.
  hardDoseCapMsv: 2,
  softFactor: [0.005, 0.002, 0.001, 0.0005],
  evaDayFraction: 1 / 3, // a walk outside lasts about 8 hours
  acuteDoseStepMsv: 20, // each 20 mSv taken in one turn costs 1 health
  remoteDoseMsv: 20, // a walk outside that would cost this much (enough to make a person ill) is never made: robots go instead
  deadlyDoseMsvPerDay: 1000, // open-ground dose the guide calls deadly
  remoteHeatC: 150,
  crushPa: 5e6,
  remoteWorkFactor: 0.5, // robots driven from inside do half the science and half the digging
  stayLimitHorizonSols: 60, // a stay limit is only announced when it is shorter than this
  minStaySols: 2,
  // Flares and solar storms.
  flareAirFactor: 0.05, // air thicker than flareShieldPa stops 95% of storm particles
  flareShieldPa: 1e4,
  flareThinAirFactor: 0.7,
  flareMagnetic: { strong: 0.3, weak: 0.7, none: 1 },
  flareMinFactor: 0.1, // below this a storm is not worth an alert
  flareMaxDistanceBoost: 4,
  stellarFlareChancePerDay: 0.12, // 'flares' hazard worlds around other stars
  stellarFlareDoseBoost: 3, // planets of small red stars orbit very close in, so a flare hits harder than at Earth's distance
  stellarFlareSeverity: [['minor', 0.6], ['moderate', 0.9], ['major', 1]],
  // Suits and muscle.
  lightSuitMinPa: 3e4,
  lightSuitMaxPa: 5e5,
  lightSuitO2Saving: 0.1,
  evaO2Base: 1.2,
  evaO2PerG: 0.25,
  evaO2MaxG: 1.6,
  buildSpeedBase: 1.15,
  buildSpeedPerG: 0.4,
  buildSpeedMin: 0.6,
  buildSpeedMax: 1.1,
  // Water.
  surfaceWaterAccess: 1.5,
  maxIceAccess: 1.5,
  // Dust and storms.
  dustPerSolAirless: 0.0005,
  dustPerSolAir: 0.001,
  stormDustMultiplier: 5,
  worldStormChance: 0.03,
  beltDoseMsv: 20, // moons above this sit inside a planet's radiation belts
};

// What each kind of ground lets a crew do. oxygenRock: oxide minerals a regolith oxygen plant can cook.
// dig: how fast loose material can be piled on the habitat (1 = Moon or Mars soil).
const GROUND = {
  regolith: { oxygenRock: true, dig: 1 },
  basalt: { oxygenRock: true, dig: 0.8 },
  'iron-oxide': { oxygenRock: true, dig: 1 },
  'iron-rich': { oxygenRock: true, dig: 0.8 },
  lava: { oxygenRock: true, dig: 0.5 },
  sulfur: { oxygenRock: false, dig: 1 },
  'ice-shell': { oxygenRock: false, dig: 0.7 },
  'dirty-ice': { oxygenRock: false, dig: 0.8 },
  'water-rich': { oxygenRock: true, dig: 1 },
  'organic-dunes': { oxygenRock: false, dig: 1.3 },
};
const DEFAULT_GROUND = { oxygenRock: true, dig: 1 };
export const groundTraits = (ground) => GROUND[ground] ?? DEFAULT_GROUND;

// The data layer's hazard words are free text; these patterns fold spelling variants onto the ids cards use.
const HAZARD_ALIASES = [
  [/flare/, 'flares'], [/dust/, 'dust-storms'], [/cryo|plume|geyser/, 'cryovolcanism'], [/volcan/, 'volcanism'],
  [/quake/, 'tidal-quakes'], [/heat/, 'extreme-heat'], [/acid/, 'acid-clouds'], [/methane/, 'methane-rain'],
  [/meteor/, 'micrometeoroids'], [/belt|radiation/, 'radiation-belts'], [/lock/, 'tidal-lock'], [/night/, 'long-night'],
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const round = (v, places = 3) => Math.round(v * 10 ** places) / 10 ** places;
const fact = (world, key) => world?.facts?.[key]?.v;
const pressureDecades = (pa) => Math.max(0, Math.log10(Math.max(pa, 1) / RULES.denseAirPa));

export const isLegacyWorldId = (id) => LEGACY_WORLD_IDS.includes(id);

/** The World a mission config plays on, or null when it is a Moon/Mars mission on the older code path. */
export function worldForConfig(config) {
  const id = config?.worldId;
  if (!id || isLegacyWorldId(id)) return null;
  return worldById(id);
}

/** A stand-in landing site for a world whose site list is still empty: the equator, under the star. */
export function defaultSite(world) {
  return {
    id: `${world.id}-base`, name: `${world.name} landing site`, lat: 0, lon: 0,
    iceAccess: clamp(num(fact(world, 'waterIce'), 0), 0, 1), science: 1,
    blurb: 'A flat, safe place to land.', origin: 'generated',
  };
}

export function resolveSite(config, world) {
  const known = siteById(config.siteId) ?? world?.sites?.find((s) => s.id === config.siteId);
  if (known) return known;
  return world ? defaultSite(world) : null;
}

export function normalizeHazards(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const text = String(raw).toLowerCase();
    const id = HAZARD_ALIASES.find(([pattern]) => pattern.test(text))?.[1] ?? text;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function isTidallyLocked(world) {
  return world?.facts?.dayHours?.src === 'tidal-lock' || normalizeHazards(fact(world, 'hazards')).includes('tidal-lock');
}

// THE TIDAL-LOCK RULE. A world locked to its star has no sunrise or sunset: where you land decides the light.
//   1. A site may say so itself: site.light = 'day' | 'night' | 'twilight'.
//   2. Otherwise longitude 0°, latitude 0° is the point right under the star, and
//      mu = cos(lat) · cos(lon) is how high the star stands (1 overhead, 0 on the horizon, negative below it).
//      mu ≥ 0.17 permanent day, mu ≤ −0.17 permanent night, in between (about 10° either side of the
//      day/night line) permanent twilight.
// Worlds that are not locked to their star return 'cycle': an ordinary day and night.
export function lightMode(world, site) {
  if (!isTidallyLocked(world)) return 'cycle';
  if (['day', 'night', 'twilight'].includes(site?.light)) return site.light;
  const rad = Math.PI / 180;
  const mu = Math.cos(num(site?.lat, 0) * rad) * Math.cos(num(site?.lon, 0) * rad);
  if (mu >= RULES.twilightBand) return 'day';
  if (mu <= -RULES.twilightBand) return 'night';
  return 'twilight';
}

/** Fraction of top-of-atmosphere starlight that reaches the ground through this much air. */
export function airTransmission(pressurePa) {
  if (pressurePa < RULES.thinAirPa) return 1;
  if (pressurePa < RULES.denseAirPa) return RULES.thinAirTransmission;
  return Math.max(RULES.hazeFloor, RULES.thinAirTransmission - RULES.transmissionPerDecade * pressureDecades(pressurePa));
}

function flareModel(world, pressurePa, sunlightWm2, hazards, turnHours) {
  const air = pressurePa >= RULES.flareShieldPa ? RULES.flareAirFactor : pressurePa >= RULES.thinAirPa ? RULES.flareThinAirFactor : 1;
  const magnetic = RULES.flareMagnetic[fact(world, 'magneticField')] ?? 1;
  const inSol = world.system === 'sol';
  // Storm particles thin out with distance from the Sun exactly as sunlight does, so sunlight is the yardstick.
  const distance = inSol ? clamp(sunlightWm2 / EARTH_SOLAR_CONSTANT, 0, RULES.flareMaxDistanceBoost) : RULES.stellarFlareDoseBoost;
  const factor = round(air * magnetic * distance);
  const exposed = factor >= RULES.flareMinFactor;
  return {
    flareDoseFactor: factor,
    solarStorms: inSol && exposed, // real NASA DONKI storms reach this world
    flareChance: !inSol && exposed && hazards.includes('flares') ? round(RULES.stellarFlareChancePerDay * (turnHours / RULES.earthDayHours)) : 0,
  };
}

function remoteReason({ pressurePa, radiationMsvPerDay, hotC }) {
  if (pressurePa > RULES.crushPa) return 'pressure';
  const insideBare = insideDosePerDay(radiationMsvPerDay, 0);
  const walk = insideBare + (radiationMsvPerDay - insideBare) * RULES.evaDayFraction;
  if (walk >= RULES.remoteDoseMsv) return 'radiation';
  if (hotC > RULES.remoteHeatC) return 'heat';
  return null;
}

function insideDosePerDay(doseMsvPerDay, level) {
  const hard = Math.min(doseMsvPerDay, RULES.hardDoseCapMsv);
  return hard * SHIELDING.gcrFactor[level] + (doseMsvPerDay - hard) * RULES.softFactor[level];
}

/**
 * Everything the simulation needs to know about one world at one site, as plain JSON (it is stored in the
 * mission so saves replay without looking the world up again).
 */
export function worldProfile(world, site = defaultSite(world)) {
  const light = lightMode(world, site);
  const cycleHours = Math.max(0.1, num(fact(world, 'dayHours'), RULES.earthDayHours));
  const daily = light === 'cycle' && cycleHours >= RULES.minDailyTurnHours && cycleHours <= RULES.maxDailyTurnHours;
  const turnHours = daily ? cycleHours : RULES.earthDayHours;
  const pressurePa = Math.max(0, num(fact(world, 'pressurePa'), 0));
  const sunlightWm2 = Math.max(0, num(fact(world, 'sunlightWm2'), 0));
  const offset = num(site?.tempOffsetC, 0);
  const dayC = num(site?.tempDayC, num(fact(world, 'tempDayC'), 0)) + offset;
  const nightC = num(site?.tempNightC, num(fact(world, 'tempNightC'), dayC)) + offset;
  const twilightC = Math.round((dayC + nightC) / 2);
  const tempLitC = light === 'night' ? nightC : light === 'twilight' ? twilightC : dayC;
  const tempDarkC = light === 'day' ? dayC : light === 'twilight' ? twilightC : nightC;
  const radiationMsvPerDay = Math.max(0, num(fact(world, 'radiationMsvPerDay'), 1));
  const gravityG = Math.max(0.01, num(fact(world, 'gravityG'), 0.38));
  const ground = fact(world, 'ground') ?? 'regolith';
  const liquidWater = fact(world, 'liquidWater') ?? 'none';
  const waterIce = clamp(num(fact(world, 'waterIce'), 0), 0, 1);
  const siteIce = num(site?.iceAccess, waterIce);
  const iceAccess = liquidWater === 'surface'
    ? RULES.surfaceWaterAccess
    : round(clamp(siteIce * (0.5 + waterIce), 0, RULES.maxIceAccess));

  const stated = normalizeHazards(fact(world, 'hazards'));
  const derivedHazards = [
    pressurePa < RULES.thinAirPa ? 'micrometeoroids' : null,
    world.kind === 'moon' && radiationMsvPerDay >= RULES.beltDoseMsv ? 'radiation-belts' : null,
  ].filter((h) => h && !stated.includes(h));
  const hazards = [...stated, ...derivedHazards];

  const lightSuit = pressurePa >= RULES.lightSuitMinPa && pressurePa <= RULES.lightSuitMaxPa;
  const dusty = pressurePa >= RULES.thinAirPa;

  return {
    worldId: world.id, name: world.name, system: world.system, analog: world.analog, kind: world.kind,
    parent: world.parent ?? null, starName: world.star?.name ?? (world.system === 'sol' ? 'the Sun' : world.system),
    light, cycleHours, turnHours,
    nightTurns: light === 'cycle' ? round(cycleHours / 2 / turnHours, 1) : 0,
    sunlightWm2, transmission: round(airTransmission(pressurePa)),
    tempLitC, tempDarkC, pressurePa,
    radiationMsvPerDay, ...flareModel(world, pressurePa, sunlightWm2, hazards, turnHours),
    gravityG, ground, liquidWater, iceAccess, lightSuit,
    evaO2Multiplier: round(RULES.evaO2Base + RULES.evaO2PerG * Math.min(gravityG, RULES.evaO2MaxG) - (lightSuit ? RULES.lightSuitO2Saving : 0)),
    buildSpeed: round(clamp(RULES.buildSpeedBase - RULES.buildSpeedPerG * gravityG, RULES.buildSpeedMin, RULES.buildSpeedMax) * groundTraits(ground).dig),
    dustPerSol: dusty ? RULES.dustPerSolAir : RULES.dustPerSolAirless,
    stormChance: hazards.includes('dust-storms') && dusty ? RULES.worldStormChance : 0,
    hazards,
    remote: remoteReason({ pressurePa, radiationMsvPerDay, hotC: Math.min(tempLitC, tempDarkC) }),
    homeDelay: homeDelayText(world, sunlightWm2),
  };
}

// How long a radio message takes to reach Earth, from the speed of light alone.
function homeDelayText(world, sunlightWm2) {
  const ly = num(world.star?.distanceLy?.v, null);
  if (world.system !== 'sol') return ly ? `${ly} years` : 'many years';
  const au = sunlightWm2 > 0 ? Math.sqrt(EARTH_SOLAR_CONSTANT / sunlightWm2) : 1;
  const minutes = Math.max(1, Math.round(au * 8.3));
  return minutes >= 90 ? `about ${Math.round(minutes / 60)} hours` : `about ${minutes} minutes`;
}

// ---------- Per-turn conditions ----------

/** Hours of daylight inside turn number `sol` (the first turn starts at sunrise unless phaseOffsetDays moves it). */
export function daylightHoursAt(profile, sol, phaseOffsetDays = 0) {
  const { light, turnHours, cycleHours } = profile;
  if (light === 'day' || light === 'twilight') return turnHours;
  if (light === 'night') return 0;
  if (cycleHours < 2) return turnHours / 2;
  const start = (Math.max(1, sol) - 1) * turnHours + phaseOffsetDays * RULES.earthDayHours;
  const end = start + turnHours;
  const half = cycleHours / 2;
  let lit = 0;
  for (let k = Math.floor(start / cycleHours); k * cycleHours < end; k += 1) {
    const dawn = k * cycleHours;
    lit += Math.max(0, Math.min(end, dawn + half) - Math.max(start, dawn));
  }
  return clamp(lit, 0, turnHours);
}

export function worldEnv(profile, sol, phaseOffsetDays, prev) {
  const daylightHours = round(daylightHoursAt(profile, sol, phaseOffsetDays), 2);
  const litShare = daylightHours / profile.turnHours;
  const maxC = daylightHours > 0 ? profile.tempLitC : profile.tempDarkC;
  const minC = daylightHours < profile.turnHours ? profile.tempDarkC : profile.tempLitC;
  const storm = prev?.storm ?? null;
  const remote = profile.remote ?? (maxC > RULES.remoteHeatC ? 'heat' : null);
  return {
    ls: null, lit: litShare >= RULES.litTurnFraction, daylightHours,
    minC, maxC, avgC: Math.round(maxC * litShare + minC * (1 - litShare)),
    pressurePa: profile.pressurePa, tau: storm ? storm.tau : 0, storm,
    stormChance: profile.stormChance, remote, reference: null,
  };
}

export function worldSolarKwh(profile, { areaM2, daylightHours, tau = 0, dust = 0 }) {
  if (profile.light === 'night' || daylightHours <= 0) return 0;
  const geometry = profile.light === 'day' ? 1 : profile.light === 'twilight' ? RULES.twilightSunFraction : RULES.flatPanelGeometry;
  const surface = profile.sunlightWm2 * profile.transmission * Math.exp(-RULES.stormDimming * Math.max(0, tau));
  return (surface * geometry * POWER.solarEfficiency * areaM2 * (1 - dust) * daylightHours) / 1000;
}

const KELVIN = 273.15;
const HABITAT_K4 = (POWER.habitatTargetC + KELVIN) ** 4;
const GLOW_KW_PER_K4 = (POWER.heatKwPerDegree * (POWER.habitatTargetC - RULES.calibrationColdC))
  / (HABITAT_K4 - (RULES.calibrationColdC + KELVIN) ** 4);

/** kW the habitat spends on heaters (cold outside) or chillers (hot outside) at this outside temperature. */
export function thermalKw(profile, tempC) {
  const decades = pressureDecades(profile.pressurePa);
  if (tempC > RULES.coolAboveC) return RULES.coolKwPerDegree * (tempC - RULES.coolAboveC) * (1 + RULES.coolAirBoostPerDecade * decades);
  if (tempC >= POWER.habitatTargetC) return 0;
  const glow = GLOW_KW_PER_K4 * (HABITAT_K4 - Math.max(0, tempC + KELVIN) ** 4);
  const carried = RULES.convectionKwPerDegreePerDecade * (POWER.habitatTargetC - tempC) * decades;
  return glow + carried;
}

export const isHot = (tempC) => tempC > RULES.coolAboveC;

// ---------- Radiation ----------

const perTurn = (profile) => profile.turnHours / RULES.earthDayHours;

/** Dose per turn for a crew member who stays inside behind `level` layers of piled-up shielding. */
export const insideDose = (profile, level) => insideDosePerDay(profile.radiationMsvPerDay, level) * perTurn(profile);

/** Dose per turn for a crew member who spends a working shift outside. */
export function evaDose(profile, level) {
  const inside = insideDosePerDay(profile.radiationMsvPerDay, level);
  return (inside + (profile.radiationMsvPerDay - inside) * RULES.evaDayFraction) * perTurn(profile);
}

/** Dose per turn with no habitat at all (the yardstick scoring compares the crew against). */
export const openDose = (profile) => profile.radiationMsvPerDay * perTurn(profile);

export const acuteHealthLoss = (doseMsv) => Math.floor(doseMsv / RULES.acuteDoseStepMsv);

/**
 * Longest stay the radiation allows, in turns, or null when there is no such limit: the number of turns a crew
 * that never leaves the habitat can spend before passing NASA's 600 mSv career limit.
 */
export function stayLimitSols(profile) {
  const perTurnDose = insideDose(profile, 0);
  if (perTurnDose <= 0) return null;
  const turns = Math.floor(RADIATION.careerLimitMsv / perTurnDose);
  return turns < RULES.stayLimitHorizonSols ? Math.max(RULES.minStaySols, turns) : null;
}

export function stellarFlareSeverity(roll) {
  return RULES.stellarFlareSeverity.find(([, upTo]) => roll < upTo)?.[0] ?? 'major';
}

export const evaO2MultiplierFor = (profile) => profile?.evaO2Multiplier ?? LIFE_SUPPORT.evaO2Multiplier;
