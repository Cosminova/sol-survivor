// Builds a World profile for every planet in the NASA Exoplanet Archive snapshot (exoWorlds.generated.js).
// Three kinds of fact, each labelled:
//   real       the archive value, when the archive cites a paper for it
//   derived    plain physics on archive values, or a value the archive itself marks "Calculated Value"
//              (for example the size of a planet found by radial velocity, which nobody has measured)
//   generated  guesses from the game model (worldModel.js): ground, air, temperatures, ice, radiation
import { EARTH_SOLAR_CONSTANT } from './constants.js';
import { EXO_SNAPSHOT } from './exoWorlds.generated.js';
import { generatedSites } from './exoSites.js';
import { derived, generated, real, round, roundSig } from './worldFacts.js';
import { guessWorld } from './worldModel.js';
import { paletteFor } from './worldPalette.js';

export const ARCHIVE_SRC = 'exo-archive';
export const LIGHT_YEARS_PER_PARSEC = 3.26156;
const EARTH_DENSITY_GCC = 5.513; // Earth fact sheet
const SUN_TEFF_K = 5772;
const DAYS_PER_YEAR = 365.25;
const HOURS_PER_DAY = 24;
// Rocky planets: radius grows as mass^0.279 (Chen & Kipping 2017), so mass = radius^(1/0.279).
const ROCKY_MASS_FROM_RADIUS_EXPONENT = 1 / 0.279;
const MASS_RADIUS_SRC = 'mass-radius relation';

const STAR_DISPLAY_NAMES = { 'Proxima Cen': 'Proxima Centauri', "Barnard's star": "Barnard's Star" };
const PLANET_DISPLAY_NAMES = { 'Proxima Cen b': 'Proxima Centauri b', 'Proxima Cen d': 'Proxima Centauri d' };

export const worldIdFor = (planetName) => planetName.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const archiveOrDerived = (value, isCalculated, derivedSrc, note) => (isCalculated ? derived(value, derivedSrc, note) : real(value, ARCHIVE_SRC));

const starFacts = (system) => {
  const luminosity = roundSig(10 ** system.logLumSol, 3);
  const radius = system.radiusSol === null
    ? derived(round(Math.sqrt(luminosity) * (SUN_TEFF_K / system.teffK) ** 2, 3), 'luminosity+teff')
    : real(system.radiusSol, ARCHIVE_SRC);
  return {
    name: STAR_DISPLAY_NAMES[system.host] ?? system.host,
    teffK: real(system.teffK, ARCHIVE_SRC), radiusSol: radius, massSol: real(system.massSol, ARCHIVE_SRC),
    luminositySol: archiveOrDerived(luminosity, system.lumCalc, 'radius+teff'),
    spectralType: real(system.spectralType, ARCHIVE_SRC),
    distanceLy: derived(round(system.distPc * LIGHT_YEARS_PER_PARSEC, 2), ARCHIVE_SRC),
  };
};

const massFact = (planet) => {
  switch (planet.massKind) {
    case 'measured': return real(planet.massEarth, ARCHIVE_SRC);
    case 'minimum': return real(planet.massEarth, ARCHIVE_SRC, 'minimum mass: the real mass could be higher');
    case 'upper-limit':
      return derived(roundSig(planet.radiusEarth ** ROCKY_MASS_FROM_RADIUS_EXPONENT, 2), MASS_RADIUS_SRC,
        `estimated from its size; the archive only gives an upper limit of ${planet.massEarth} Earth masses`);
    default: return derived(planet.massEarth, MASS_RADIUS_SRC, 'not measured: estimated from its size');
  }
};

const radiusFact = (planet) => archiveOrDerived(planet.radiusEarth, planet.radiusCalc, MASS_RADIUS_SRC, 'not measured: estimated from its mass');

const densityFact = (planet, mass, radius) => {
  if (planet.densityGcc === null || planet.massKind === 'upper-limit') {
    return derived(round(EARTH_DENSITY_GCC * mass / radius ** 3, 2), 'mass+radius');
  }
  return archiveOrDerived(planet.densityGcc, planet.densityCalc, 'mass+radius');
};

// Kepler's third law in solar units: a^3 = M * P^2.
const orbitFact = (planet, system) => (planet.aAu === null
  ? derived(roundSig(Math.cbrt(system.massSol * (planet.periodDays / DAYS_PER_YEAR) ** 2), 3), 'period+star mass')
  : real(planet.aAu, ARCHIVE_SRC));

const insolationOf = (planet, orbitAu, luminositySol) => planet.insol ?? luminositySol / orbitAu ** 2;

const blurbFor = ({ name, radius, star, period, guess }) => {
  const size = radius < 0.8 ? 'A small' : radius < 1.25 ? 'An Earth-sized' : 'A big';
  const starWord = star.teffK.v < 3900 ? 'a small red star' : star.teffK.v < 5200 ? 'an orange star' : 'a Sun-like star';
  const facts = guess.facts;
  const extra = facts.ground.v === 'lava' ? 'Its day side may be hot enough to melt rock.'
    : facts.liquidWater.v === 'surface' ? 'It might be mild enough for liquid water.'
      : facts.waterIce.v >= 0.6 ? 'It is probably a frozen world.'
        : guess.locked ? 'One side probably always faces the star.' : 'It probably spins like Earth does.';
  return `${size} rocky planet ${star.distanceLy.v} light-years away. ${name} circles ${starWord} every ${roundSig(period, 3)} days. ${extra}`;
};

const buildWorld = (planet, system) => {
  const id = worldIdFor(planet.name);
  const name = PLANET_DISPLAY_NAMES[planet.name] ?? planet.name;
  const star = starFacts(system);
  const massEarth = massFact(planet);
  const radiusEarth = radiusFact(planet);
  const densityGcc = densityFact(planet, massEarth.v, radiusEarth.v);
  const gravityG = derived(round(massEarth.v / radiusEarth.v ** 2, 2), 'mass+radius');
  const orbitAu = orbitFact(planet, system);
  const insol = insolationOf(planet, orbitAu.v, star.luminositySol.v);
  const guess = guessWorld({
    name: planet.name, massEarth: massEarth.v, densityGcc: densityGcc.v, gravityG: gravityG.v, eqK: planet.eqK, insol,
    periodDays: planet.periodDays, ecc: planet.ecc, starTeffK: system.teffK,
  });
  const facts = {
    radiusEarth, massEarth, densityGcc, gravityG,
    dayHours: guess.locked ? derived(round(planet.periodDays * HOURS_PER_DAY, 1), 'tidal-lock') : generated(guess.freeSpinDayHours),
    yearDays: real(planet.periodDays, ARCHIVE_SRC), orbitAu,
    sunlightWm2: derived(roundSig(insol * EARTH_SOLAR_CONSTANT, 3), planet.insol === null ? 'luminosity+orbit' : 'insolation × solar constant'),
    ...guess.facts,
  };
  const analog = facts.pressurePa.v > 0 ? 'mars' : 'moon';
  const liquid = facts.ground.v === 'lava' ? 'lava' : facts.liquidWater.v === 'surface' ? 'water' : null;
  return {
    id, name, kind: 'exoplanet', parent: system.host, system: system.host, analog,
    sky: { ra: system.ra, dec: system.dec }, star, facts,
    palette: paletteFor({
      ground: facts.ground.v, waterIce: facts.waterIce.v, liquid, pressurePa: facts.pressurePa.v, air: facts.air.v,
      starTeffK: system.teffK, seed: planet.name,
    }),
    sites: generatedSites({ worldId: id, analog, locked: guess.locked, facts }),
    blurb: blurbFor({ name, radius: radiusEarth.v, star, period: planet.periodDays, guess }),
    // Optional extras (not part of the contract shape).
    discovery: { method: planet.method, year: planet.year, transits: planet.transits },
    disputed: planet.controversial,
    tidallyLocked: generated(guess.locked),
  };
};

export const EXO_RETRIEVED = EXO_SNAPSHOT.retrieved;
export const EXO_WORLDS = EXO_SNAPSHOT.systems.flatMap((system) => system.planets.map((planet) => buildWorld(planet, system)));
