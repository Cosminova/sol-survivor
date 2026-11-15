// Plain-language guide to a world for the picker UI: how hard it is, and what it does to a crew.
// Both functions are pure and read only world.facts (through the same profile the simulation uses), so the
// planet card can never promise something the simulation does not do.
import { RULES, worldProfile, defaultSite, stayLimitSols, airTransmission, thermalKw, groundTraits, isTidallyLocked } from './worldModel.js';

const LEVELS = ['easy', 'medium', 'hard', 'extreme'];
const MEDIUM = 1;
const HARD = 2;
const EXTREME = 3;
const MAX_REASONS = 4;
const MEDIUMS_THAT_MAKE_HARD = 3;

const LIMITS = {
  mildRadiationMsv: 2,
  ovenC: 400,
  veryHotC: 150,
  deepColdC: -150,
  coldC: -60,
  dimWm2: 100,
  longNightEarthDays: 5,
  heavyG: 1.3,
  dryIce: 0.15,
};

const cap = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);
const beltSource = (profile) => (profile.kind === 'moon' && profile.parent ? `${cap(profile.parent)}’s radiation belts` : 'space');
const coldest = (profile) => Math.min(profile.tempLitC, profile.tempDarkC);
const hottest = (profile) => Math.max(profile.tempLitC, profile.tempDarkC);
const surfaceLight = (profile) => profile.sunlightWm2 * airTransmission(profile.pressurePa);
const nightEarthDays = (profile) => (profile.nightTurns * profile.turnHours) / RULES.earthDayHours;

function challengeFactors(profile, stayLimit) {
  const factors = [];
  const add = (level, text) => factors.push({ level, text });
  const dose = profile.radiationMsvPerDay;

  if (profile.remote === 'pressure') add(EXTREME, 'The air would crush a spacesuit, so nobody can walk outside.');
  if (stayLimit) add(EXTREME, `Radiation is so strong that a crew can only stay ${stayLimit} days.`);
  else if (dose >= RULES.deadlyDoseMsvPerDay) add(EXTREME, 'Radiation outside is deadly, so robots do all the outdoor work.');
  else if (profile.remote === 'radiation') add(HARD, 'Too much radiation for walks outside, so robots do the outdoor work.');
  else if (dose >= RULES.beltDoseMsv) add(HARD, 'Strong radiation: every walk outside adds a lot of dose.');
  else if (dose > LIMITS.mildRadiationMsv) add(MEDIUM, 'More radiation than on the Moon.');

  if (hottest(profile) >= LIMITS.ovenC) add(profile.pressurePa > RULES.denseAirPa ? EXTREME : HARD, 'Hot enough to melt lead. Chillers eat most of your power.');
  else if (hottest(profile) >= LIMITS.veryHotC) add(HARD, 'Oven-hot outside. The base needs chillers and robots.');

  if (coldest(profile) <= LIMITS.deepColdC) add(HARD, 'Colder than anywhere on Earth by far. Heaters need nuclear power.');
  else if (coldest(profile) <= LIMITS.coldC) add(MEDIUM, 'Freezing cold. The heaters never switch off.');

  if (profile.light === 'night') add(HARD, 'This side never sees its star: no solar power at all.');
  else if (surfaceLight(profile) < LIMITS.dimWm2) add(MEDIUM, 'Sunlight is too dim for solar panels.');
  else if (nightEarthDays(profile) >= LIMITS.longNightEarthDays) add(MEDIUM, `Nights last about ${Math.round(nightEarthDays(profile))} Earth days.`);

  if (profile.flareChance > 0) add(MEDIUM, 'Its star throws out flares often. Pack a storm shelter.');
  if (profile.gravityG >= LIMITS.heavyG) add(MEDIUM, 'Strong gravity makes every job outside harder work.');
  if (profile.iceAccess < LIMITS.dryIce) add(MEDIUM, 'Almost no ice to mine. Bring all your water.');
  return factors.sort((a, b) => b.level - a.level);
}

/**
 * How hard a world is, for the picker.
 * @param {import('../data/worlds.js').World} world
 * @returns {{ level: 'easy'|'medium'|'hard'|'extreme', reasons: string[], maxSols: number|null }}
 *   maxSols: the longest mission the radiation allows (null = no limit). freePlayConfig enforces it.
 */
export function worldChallenge(world) {
  const profile = worldProfile(world, defaultSite(world));
  const maxSols = stayLimitSols(profile);
  const factors = challengeFactors(profile, maxSols);
  const top = factors[0]?.level ?? 0;
  const mediums = factors.filter((f) => f.level === MEDIUM).length;
  const level = top === MEDIUM && mediums >= MEDIUMS_THAT_MAKE_HARD ? HARD : top;
  const reasons = factors.slice(0, MAX_REASONS).map((f) => f.text);
  return { level: LEVELS[level], reasons: reasons.length ? reasons : ['Gentle for a world that is not Earth. A good first trip.'], maxSols };
}

function airLine(profile) {
  if (profile.remote === 'pressure') return 'Crushing air: nobody can walk outside, so robots do the outdoor work';
  if (profile.pressurePa < RULES.thinAirPa) return 'No air: every walk outside needs a full spacesuit, and tiny space rocks hit the ground';
  if (profile.lightSuit) return 'Thick air: a lighter suit works outside, but you still carry your oxygen. Nobody can breathe this air';
  return 'Air you cannot breathe: every walk outside needs a full spacesuit';
}

function temperatureLine(profile) {
  const hot = hottest(profile);
  const cold = coldest(profile);
  if (hot >= LIMITS.veryHotC) return `Scorching heat, up to ${Math.round(hot)} °C: chillers run all the time`;
  if (cold <= LIMITS.deepColdC) return `Deep cold, down to ${Math.round(cold)} °C: heaters need lots of power`;
  if (cold <= LIMITS.coldC) return `Cold, down to ${Math.round(cold)} °C: heaters run every night`;
  if (thermalKw(profile, cold) + thermalKw(profile, hot) < 1) return 'Mild temperatures: the habitat needs little heating';
  return `Temperatures from ${Math.round(cold)} °C to ${Math.round(hot)} °C: some heating or cooling every day`;
}

function radiationLine(profile) {
  const dose = profile.radiationMsvPerDay;
  if (dose >= RULES.deadlyDoseMsvPerDay) return `Deadly radiation from ${beltSource(profile)}: the crew must stay inside, deep under shielding`;
  if (profile.remote === 'radiation') return `Strong radiation from ${beltSource(profile)}: stay inside and let robots work outside`;
  if (dose >= RULES.beltDoseMsv) return `Strong radiation from ${beltSource(profile)}: stay inside or shielded`;
  if (dose > LIMITS.mildRadiationMsv) return 'Extra radiation: build shielding early and keep walks outside short';
  if (profile.pressurePa >= RULES.flareShieldPa) return 'Thick air blocks most space radiation';
  return 'Space radiation every day: shielding keeps the dose down';
}

function lightLine(profile, locked) {
  if (locked) return 'One side always faces its star: where you land decides if you get endless day, twilight or endless night';
  if (profile.light === 'day') return 'The star never sets here: solar panels work all the time';
  if (profile.light === 'night') return 'The star never rises here: solar panels make nothing';
  if (profile.light === 'twilight') return 'The star sits on the horizon forever: weak but steady solar power';
  if (surfaceLight(profile) < LIMITS.dimWm2) return 'Very dim sunlight: solar panels make almost nothing, so bring nuclear power';
  const nightDays = nightEarthDays(profile);
  if (nightDays >= 2) return `Long nights of about ${Math.round(nightDays)} Earth days: no solar power until sunrise`;
  return 'Day and night every turn: batteries carry the base through the dark';
}

function waterLine(profile) {
  if (profile.liquidWater === 'surface') return 'Liquid water on the surface: pumps can fill your tanks';
  if (profile.iceAccess >= 0.5) return 'Lots of ice in the ground: an ice drill makes plenty of water';
  if (profile.iceAccess >= LIMITS.dryIce) return 'A little ice in the ground: an ice drill helps, slowly';
  return 'Almost no ice: bring all the water you need';
}

function gravityLine(profile) {
  if (profile.gravityG >= LIMITS.heavyG) return 'Strong gravity: work outside is tiring and uses more oxygen';
  if (profile.gravityG <= 0.2) return 'Very weak gravity: heavy things are easy to lift';
  return null;
}

function groundLine(profile) {
  if (profile.ground === 'ice-shell' || profile.ground === 'dirty-ice') return 'Ground of rock-hard ice: no oxygen to cook out of it, but plenty to melt';
  if (!groundTraits(profile.ground).oxygenRock) return 'The ground has no oxygen-rich rock: make oxygen from water instead';
  return null;
}

const HAZARD_LINES = {
  'dust-storms': 'Dust storms can dim the Sun for days',
  volcanism: 'Volcanoes rain ash on your machines',
  'tidal-quakes': 'The ground quakes as a giant planet tugs on it',
  'acid-clouds': 'Acid in the air eats at seals and joints',
  'methane-rain': 'It rains liquid methane. That is not water, and you cannot drink it',
  cryovolcanism: 'Ice geysers spray fresh snow you can collect',
};

/**
 * Short "what this world does to your crew" lines for the planet card, most important first.
 * @param {import('../data/worlds.js').World} world
 * @returns {string[]}
 */
export function worldEffects(world) {
  const profile = worldProfile(world, defaultSite(world));
  const flareLine = profile.flareChance > 0 ? `${cap(profile.starName)} flares often: pack a storm shelter` : null;
  const hazardLines = profile.hazards.map((h) => HAZARD_LINES[h]).filter(Boolean);
  return [
    airLine(profile), temperatureLine(profile), radiationLine(profile), lightLine(profile, isTidallyLocked(world)), waterLine(profile),
    gravityLine(profile), groundLine(profile), flareLine, ...hazardLines,
  ].filter(Boolean);
}
