// Solar-system worlds you can land on: the rocky planets and the big moons. No gas giants: Jupiter and Saturn
// appear only as the parents of their moons.
//
// Numbers come from the NASA Planetary Fact Sheets (NSSDCA), read on 2026-11-14, and from NASA Science fact pages.
// Labels:
//   real       printed on a NASA fact sheet or fact page (unit changes such as km -> Earth radii stay real)
//   derived    plain physics on those numbers (gravity from mass and radius, day length of a moon that always
//              faces its planet, a 0..1 ice score read off a NASA description)
//   generated  the game's own number where no NASA surface value was found (surface radiation on most worlds)
// The Moon and Mars read src/data/constants.js so the two can never disagree.
import { MARS, MOON, RADIATION } from './constants.js';
import { solSitesFor } from './solSites.js';
import { derived, generated, real, round } from './worldFacts.js';
import { paletteFor } from './worldPalette.js';

const EARTH_RADIUS_KM = 6371.0; // volumetric mean radius [earth-fact]
const EARTH_MASS_KG = 5.9722e24; // [earth-fact]
const EARTH_GRAVITY_MS2 = 9.82; // mean surface gravity [earth-fact]
const EARTH_YEAR_DAYS = 365.256; // sidereal orbit period [earth-fact]
const GRAVITATIONAL_CONSTANT = 6.6743e-11;
const HOURS_PER_DAY = 24;
const KG_PER_M3_PER_GCC = 1000;
const PA_PER_BAR = 1e5;

// Parent planets: semimajor axis (AU), sidereal year (days) and sunlight (W/m²) from their fact sheets.
const JUPITER = { id: 'jupiter', src: 'jupiter-fact', satSrc: 'jovian-sat-fact', orbitAu: 5.20336, yearDays: 4332.589, sunlightWm2: 50.26 };
const SATURN = { id: 'saturn', src: 'saturn-fact', satSrc: 'saturnian-sat-fact', orbitAu: 9.53707, yearDays: 10755.699, sunlightWm2: 14.82 };

const ONLY_GANYMEDE_HAS_A_FIELD = 'Ganymede is the only moon known to make its own magnetic field';
const noMoonField = () => real('none', 'ganymede-facts', ONLY_GANYMEDE_HAS_A_FIELD);
const NO_NASA_SURFACE_DOSE = 'no NASA surface dose found';
// Jupiter-moon doses are the commonly quoted figures (Ringwald 2000, a university lecture note, not a NASA source),
// so they are labelled generated.
const jupiterDose = (msvPerDay) => generated(msvPerDay, 'commonly quoted estimate for Jupiter’s radiation belts, not a NASA figure');

// Bulk facts of a moon from its satellite fact sheet row: radius (km), mass (10^20 kg), density (kg/m³), orbit (days).
const moonBulk = ({ parent, radiusKm, radiusNote, massE20Kg, densityKgM3, periodDays }) => {
  const massKg = massE20Kg * 1e20;
  const gravityMs2 = GRAVITATIONAL_CONSTANT * massKg / (radiusKm * 1000) ** 2;
  const radius = round(radiusKm / EARTH_RADIUS_KM, 4);
  return {
    radiusEarth: radiusNote ? derived(radius, parent.satSrc, radiusNote) : real(radius, parent.satSrc),
    massEarth: real(round(massKg / EARTH_MASS_KG, 5), parent.satSrc),
    densityGcc: real(densityKgM3 / KG_PER_M3_PER_GCC, parent.satSrc),
    gravityG: derived(round(gravityMs2 / EARTH_GRAVITY_MS2, 3), 'mass+radius'),
    dayHours: derived(round(periodDays * HOURS_PER_DAY, 2), 'orbital period (always faces its planet)'),
    yearDays: real(parent.yearDays, parent.src), orbitAu: real(parent.orbitAu, parent.src),
    sunlightWm2: real(parent.sunlightWm2, parent.src),
  };
};

const world = ({ id, name, kind, parent = null, analog, facts, liquid = null, palette, blurb }) => ({
  id, name, kind, parent, system: 'sol', analog, sky: null, star: null, facts,
  palette: palette ?? paletteFor({ ground: facts.ground.v, waterIce: facts.waterIce.v, liquid, pressurePa: facts.pressurePa.v, air: facts.air.v }),
  sites: solSitesFor(id, analog),
  blurb,
});

const MERCURY = world({
  id: 'mercury', name: 'Mercury', kind: 'planet', analog: 'moon',
  facts: {
    radiusEarth: real(0.383, 'mercury-fact'), massEarth: real(0.0553, 'mercury-fact'), densityGcc: real(5.429, 'mercury-fact'),
    gravityG: real(0.378, 'mercury-fact'), dayHours: real(4222.6, 'mercury-fact'), yearDays: real(87.969, 'mercury-fact'),
    orbitAu: real(0.3871, 'mercury-fact'), sunlightWm2: real(9082.7, 'mercury-fact'),
    tempDayC: real(430, 'mercury-facts'), tempNightC: real(-180, 'mercury-facts'),
    pressurePa: real(0, 'mercury-fact', 'less than a trillionth of Earth’s air'), air: real([], 'mercury-fact'),
    magneticField: real('weak', 'mercury-facts', 'about 1% as strong as Earth’s'),
    radiationMsvPerDay: generated(1.5, NO_NASA_SURFACE_DOSE),
    waterIce: derived(0.3, 'mercury-facts', 'ice only inside permanently shadowed polar craters'),
    liquidWater: real('none', 'mercury-facts'), ground: real('regolith', 'mercury-facts'),
    hazards: real(['extreme-heat', 'extreme-cold', 'flares', 'long-night'], 'mercury-facts'),
  },
  blurb: 'The closest planet to the Sun. Days are hot enough to melt lead, nights are colder than Antarctica, and one day lasts 176 Earth days.',
});

const VENUS = world({
  id: 'venus', name: 'Venus', kind: 'planet', analog: 'mars',
  facts: {
    radiusEarth: real(0.95, 'venus-fact'), massEarth: real(0.815, 'venus-fact'), densityGcc: real(5.243, 'venus-fact'),
    gravityG: real(0.903, 'venus-fact'), dayHours: real(2802.0, 'venus-fact'), yearDays: real(224.701, 'venus-fact'),
    orbitAu: real(0.7233, 'venus-fact'), sunlightWm2: real(2601.3, 'venus-fact'),
    tempDayC: real(464, 'venus-fact'), tempNightC: real(464, 'venus-fact', 'day and night are equally hot'),
    pressurePa: real(92 * PA_PER_BAR, 'venus-fact'),
    air: real([{ gas: 'CO2', pct: 96.5 }, { gas: 'N2', pct: 3.5 }], 'venus-fact'),
    magneticField: real('none', 'venus-facts', 'no field of its own, only a weak one caused by the solar wind'),
    radiationMsvPerDay: generated(0.001, 'thick air blocks almost all space radiation; no NASA surface dose found'),
    waterIce: derived(0, 'venus-fact', 'far too hot for ice'), liquidWater: real('none', 'venus-facts'),
    ground: real('basalt', 'venus-facts', 'volcanic plains'),
    hazards: real(['extreme-heat', 'crushing-pressure', 'acid-clouds', 'volcanism'], 'venus-facts'),
  },
  blurb: 'The hottest planet. Thick carbon dioxide air traps heat and presses down like the deep sea, under clouds of acid.',
});

const EARTH_MOON = world({
  id: 'moon', name: 'The Moon', kind: 'moon', parent: 'earth', analog: 'moon',
  facts: {
    radiusEarth: real(0.2727, 'moon-fact'), massEarth: real(0.0123, 'moon-fact'), densityGcc: real(3.344, 'moon-fact'),
    gravityG: real(MOON.gravity, 'moon-fact'), dayHours: real(round(MOON.synodicDays * HOURS_PER_DAY, 1), 'moon-fact'),
    yearDays: real(EARTH_YEAR_DAYS, 'earth-fact'), orbitAu: real(1.0, 'earth-fact'), sunlightWm2: real(MOON.meanSolarFlux, 'moon-fact'),
    tempDayC: real(120, 'moon-fact'), tempNightC: real(-130, 'moon-fact'), pressurePa: real(0, 'moon-fact'),
    air: real([], 'moon-fact'), magneticField: real('none', 'moon-fact'),
    radiationMsvPerDay: real(RADIATION.moonSurfaceMsvPerDay, 'lnd-2020'),
    waterIce: derived(0.5, 'lcross', 'ice in permanently shadowed polar craters'), liquidWater: real('none', 'moon-fact'),
    ground: real('regolith', 'moon-fact'), hazards: real(['flares', 'micrometeoroids', 'long-night'], 'moon-fact'),
  },
  palette: { ground: '#8d8a85', rock: '#5d5a56', ice: '#dfe8ef', sky: '#000000', haze: null, liquid: null },
  blurb: 'Our closest neighbour. No air, two-week days and two-week nights.',
});

const MARS_WORLD = world({
  id: 'mars', name: 'Mars', kind: 'planet', analog: 'mars',
  facts: {
    radiusEarth: real(0.532, 'mars-fact'), massEarth: real(0.107, 'mars-fact'), densityGcc: real(3.934, 'mars-fact'),
    gravityG: real(MARS.gravity, 'mars-fact'), dayHours: real(MARS.dayHours, 'mars-fact'), yearDays: real(686.98, 'mars-fact'),
    orbitAu: real(MARS.semiMajorAU, 'mars-fact'), sunlightWm2: real(MARS.meanSolarFlux, 'mars-fact'),
    tempDayC: real(-5, 'rems'), tempNightC: real(-75, 'rems'), pressurePa: real(MARS.surfacePressurePa, 'mars-fact'),
    air: real([{ gas: 'CO2', pct: 95.1 }, { gas: 'N2', pct: 2.59 }, { gas: 'Ar', pct: 1.94 }], 'mars-fact'),
    magneticField: real('none', 'mars-fact'), radiationMsvPerDay: real(RADIATION.marsSurfaceGcrMsvPerSol, 'rad-2014'),
    waterIce: derived(0.6, 'ice', 'buried ice sheets at middle and high latitudes'), liquidWater: real('none', 'mars-fact'),
    ground: real('iron-oxide', 'mars-fact'), hazards: real(['dust-storms', 'flares'], 'mars-fact'),
  },
  palette: { ground: '#b5603a', rock: '#7a3b22', ice: '#f1ece6', sky: '#c9a27e', haze: '#d9b48f', liquid: null },
  blurb: 'The red planet. Thin carbon dioxide air, dust storms and buried ice.',
});

const IO = world({
  id: 'io', name: 'Io', kind: 'moon', parent: JUPITER.id, analog: 'moon', liquid: 'lava',
  facts: {
    ...moonBulk({ parent: JUPITER, radiusKm: 1821.5, massE20Kg: 893.2, densityKgM3: 3530, periodDays: 1.769138 }),
    tempDayC: real(-148, 'io-atmosphere', 'in sunlight, away from volcanoes'), tempNightC: real(-168, 'io-atmosphere', 'in Jupiter’s shadow'),
    pressurePa: real(0, 'io-facts', 'only a trace of sulfur dioxide gas'), air: real([], 'io-facts'),
    magneticField: noMoonField(), radiationMsvPerDay: jupiterDose(36000),
    waterIce: generated(0), liquidWater: generated('none'), ground: real('sulfur', 'io-facts'),
    hazards: real(['volcanism', 'radiation-belts', 'tidal-quakes'], 'io-facts'),
  },
  blurb: 'The most volcanic world we know. Hundreds of volcanoes, lakes of lava and yellow sulfur ground, deep inside Jupiter’s radiation.',
});

const EUROPA = world({
  id: 'europa', name: 'Europa', kind: 'moon', parent: JUPITER.id, analog: 'moon',
  facts: {
    ...moonBulk({ parent: JUPITER, radiusKm: 1560.8, massE20Kg: 480.0, densityKgM3: 3010, periodDays: 3.551181 }),
    tempDayC: real(-133, 'europa-faq', 'warmest spots at the equator'), tempNightC: real(-223, 'europa-faq', 'coldest spots at the poles'),
    pressurePa: real(0, 'europa-facts', 'only a trace of oxygen'), air: real([], 'europa-facts'),
    magneticField: noMoonField(), radiationMsvPerDay: jupiterDose(5400),
    waterIce: derived(1, 'europa-facts', 'the whole surface is water ice'), liquidWater: real('subsurface', 'europa-facts'),
    ground: real('ice-shell', 'europa-facts'), hazards: real(['radiation-belts', 'extreme-cold', 'tidal-quakes'], 'europa-facts'),
  },
  blurb: 'An ice world with a salty ocean hidden under its frozen shell. It may hold twice as much water as Earth.',
});

const GANYMEDE = world({
  id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: JUPITER.id, analog: 'moon',
  facts: {
    ...moonBulk({ parent: JUPITER, radiusKm: 2631.2, massE20Kg: 1481.9, densityKgM3: 1940, periodDays: 7.154553 }),
    tempDayC: real(-113, 'ganymede-facts'), tempNightC: real(-183, 'ganymede-facts'),
    pressurePa: real(0, 'ganymede-facts', 'only a trace of oxygen'), air: real([], 'ganymede-facts'),
    magneticField: real('weak', 'ganymede-facts', 'the only moon with its own magnetic field'), radiationMsvPerDay: jupiterDose(80),
    waterIce: derived(0.9, 'ganymede-facts', 'a thick crust of mostly ice'), liquidWater: real('subsurface', 'ganymede-facts'),
    ground: real('dirty-ice', 'ganymede-facts'), hazards: real(['radiation-belts', 'extreme-cold'], 'ganymede-facts'),
  },
  blurb: 'The biggest moon in the solar system, bigger than Mercury. It has its own magnetic field and an ocean under the ice.',
});

const CALLISTO = world({
  id: 'callisto', name: 'Callisto', kind: 'moon', parent: JUPITER.id, analog: 'moon',
  facts: {
    ...moonBulk({ parent: JUPITER, radiusKm: 2410.3, massE20Kg: 1075.9, densityKgM3: 1830, periodDays: 16.689017 }),
    tempDayC: derived(-109, 'sunlight+albedo', 'hottest a dark surface gets in that sunlight'), tempNightC: generated(-190),
    pressurePa: real(0, 'callisto-facts', 'only a trace of carbon dioxide'), air: real([], 'callisto-facts'),
    magneticField: noMoonField(), radiationMsvPerDay: jupiterDose(0.1),
    waterIce: derived(0.8, 'callisto-facts', 'rocky, icy surface'), liquidWater: real('subsurface', 'callisto-facts', 'possible, not confirmed'),
    ground: real('dirty-ice', 'callisto-facts'), hazards: real(['extreme-cold', 'impact-craters'], 'callisto-facts'),
  },
  blurb: 'A dark, icy moon covered in more craters than any other world. Quiet ground, far outside Jupiter’s worst radiation.',
});

const TITAN = world({
  id: 'titan', name: 'Titan', kind: 'moon', parent: SATURN.id, analog: 'mars', liquid: 'methane',
  facts: {
    ...moonBulk({ parent: SATURN, radiusKm: 2575, massE20Kg: 1345.5, densityKgM3: 1880, periodDays: 15.945421 }),
    tempDayC: real(-179, 'titan-facts'), tempNightC: real(-179, 'titan-facts', 'thick air keeps day and night the same'),
    pressurePa: real(146700, 'huygens-hasi', 'measured by the Huygens probe as it landed in 2005: about 1.5 times Earth’s air pressure'),
    air: real([{ gas: 'N2', pct: 95 }, { gas: 'CH4', pct: 5 }], 'titan-facts'),
    magneticField: noMoonField(),
    radiationMsvPerDay: generated(0.01, 'thick air blocks most space radiation; no NASA surface dose found'),
    waterIce: derived(0.8, 'titan-facts', 'water ice plays the role of rock'), liquidWater: real('subsurface', 'titan-facts'),
    ground: real('organic-dunes', 'titan-facts'), hazards: real(['methane-rain', 'extreme-cold', 'thick-haze'], 'titan-facts'),
  },
  blurb: 'The only moon with thick air. Orange haze, dark dunes, and rivers, lakes and seas of liquid methane.',
});

const ENCELADUS = world({
  id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: SATURN.id, analog: 'moon',
  facts: {
    ...moonBulk({
      parent: SATURN, radiusKm: round(Math.cbrt(257 * 251 * 248), 1), radiusNote: 'mean of its 257 × 251 × 248 km shape',
      massE20Kg: 1.08, densityKgM3: 1610, periodDays: 1.370218,
    }),
    tempDayC: real(-201, 'enceladus-facts'), tempNightC: real(-201, 'enceladus-facts'),
    pressurePa: real(0, 'enceladus-facts', 'only water vapour near the south pole jets'), air: real([], 'enceladus-facts'),
    magneticField: noMoonField(), radiationMsvPerDay: generated(1, NO_NASA_SURFACE_DOSE),
    waterIce: derived(1, 'enceladus-facts', 'the whole surface is bright water ice'), liquidWater: real('subsurface', 'enceladus-facts'),
    ground: real('ice-shell', 'enceladus-facts'), hazards: real(['extreme-cold', 'geysers', 'low-gravity'], 'enceladus-facts'),
  },
  blurb: 'A small, bright white moon that sprays its hidden ocean into space through cracks at the south pole.',
});

export const SOL_WORLDS = [MERCURY, VENUS, EARTH_MOON, MARS_WORLD, IO, EUROPA, GANYMEDE, CALLISTO, TITAN, ENCELADUS];
