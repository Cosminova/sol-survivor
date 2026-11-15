// The game model: simple, repeatable guesses for exoplanet facts nobody has measured yet.
//
// NASA knows how big, how heavy and how warm most nearby rocky exoplanets are. Nobody knows what the ground
// looks like or whether there is air. So the game guesses, with rules a kid can follow:
//
//   1. Same face to its star?  A planet that circles its star in under 60 days is "tidally locked":
//                              one side always has day, the other always has night.
//   2. What is the ground?     Heavy for its size (dense) = lots of iron. Middling = rock like Earth's lava plains.
//                              Light for its size = lots of water or ice. Hot enough to melt rock = lava.
//   3. Is there air?           Small or scorched planets lose their air. Cool, heavy planets may keep some.
//   4. How hot and cold?       Start from the planet's real "equilibrium temperature". With no air the day side
//                              is much hotter and the night side much colder. Air evens it out.
//   5. Is there ice?           The less starlight, the more ice survives. Locked planets keep a little ice on
//                              the dark side even when the day side is hot (like the shadowed craters of Mercury).
//   6. How bad is radiation?   Start from the real dose on the Moon. Small red stars flare a lot, so add more the
//                              cooler the star and the closer the planet. Air and a magnetic field cut it down.
//
// Every output is tagged origin 'generated'. Same input, same output: there is no randomness, only a hash of the
// planet's name used to vary colours a little.
import { RADIATION } from './constants.js';
import { generated, kelvinToC, roundSig } from './worldFacts.js';

export const MODEL_RULES = Object.freeze({
  lockPeriodDays: 60, // rule 1
  freeSpinDayHours: { min: 18, span: 30 }, // not locked: a day of 18 to 48 hours, picked by name hash
  density: { ironRichGcc: 6.0, waterRichGcc: 4.5 }, // rule 2
  lavaDayC: 900,
  air: { // rule 3
    noneAboveInsol: 4, noneBelowGravityG: 0.5, mildBelowInsol: 1.5, mildAboveGravityG: 0.9,
    thin: { pressurePa: 600, gases: [{ gas: 'CO2', pct: 96 }, { gas: 'N2', pct: 4 }], radiationFactor: 0.5 },
    mild: { pressurePa: 20000, gases: [{ gas: 'N2', pct: 70 }, { gas: 'CO2', pct: 30 }], radiationFactor: 0.1 },
    none: { pressurePa: 0, gases: [], radiationFactor: 1 },
  },
  temperature: { // rule 4: multiply the equilibrium temperature (kelvin)
    lockedNoAir: { day: 1.35, night: 0.3 },
    lockedAir: { day: 1.15, night: 0.8 },
    spinningNoAir: { day: 1.25, night: 0.5 },
    spinningAir: { day: 1.05, night: 0.9 },
    coldestK: 40,
    earthEquilibriumK: 278.5, // a bare rock at Earth's distance; used when the archive has no temperature
  },
  ice: [ // rule 5: [starlight compared with Earth, ice score]
    { maxInsol: 0.5, score: 0.9 }, { maxInsol: 1.5, score: 0.6 }, { maxInsol: 5, score: 0.3 }, { maxInsol: 30, score: 0.1 },
  ],
  iceWaterRichBonus: 0.1,
  liquidWater: { minInsol: 0.35, maxInsol: 1.2 },
  radiation: { // rule 6: flare dose in mSv/day at Earth-like starlight, by star temperature
    flareMsvPerDay: [{ maxTeffK: 3300, dose: 3, flares: 'high' }, { maxTeffK: 3900, dose: 1.5, flares: 'medium' },
      { maxTeffK: 5200, dose: 0.3, flares: 'low' }, { maxTeffK: Infinity, dose: 0.2, flares: 'low' }],
    strongFieldFactor: 0.5, weakFieldFactor: 0.8,
  },
  hazard: { heatDayC: 150, coldNightC: -150, highGravityG: 1.4, tidalEcc: 0.05, tidalPeriodDays: 10 },
});

// FNV-1a hash of a name, scaled to 0..1. Used only for small cosmetic variation.
export const nameHash = (name) => {
  let hash = 0x811c9dc5;
  for (const char of String(name)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0xffffffff;
};

export const isTidallyLocked = (periodDays) => periodDays !== null && periodDays < MODEL_RULES.lockPeriodDays;

export const starActivity = (teffK) => MODEL_RULES.radiation.flareMsvPerDay.find((row) => (teffK ?? 5772) <= row.maxTeffK);

export const airTier = ({ insol, gravityG }) => {
  const rule = MODEL_RULES.air;
  if (insol > rule.noneAboveInsol || gravityG < rule.noneBelowGravityG) return 'none';
  if (insol <= rule.mildBelowInsol && gravityG >= rule.mildAboveGravityG) return 'mild';
  return 'thin';
};

export const equilibriumK = ({ eqK, insol }) => eqK ?? MODEL_RULES.temperature.earthEquilibriumK * insol ** 0.25;

export const dayNightC = ({ eqK, insol, locked, hasAir }) => {
  const rule = MODEL_RULES.temperature;
  const factors = rule[`${locked ? 'locked' : 'spinning'}${hasAir ? 'Air' : 'NoAir'}`];
  const base = equilibriumK({ eqK, insol });
  return { dayC: kelvinToC(base * factors.day), nightC: kelvinToC(Math.max(rule.coldestK, base * factors.night)) };
};

export const groundType = ({ densityGcc, dayC, insol }) => {
  if (dayC >= MODEL_RULES.lavaDayC) return 'lava';
  if (densityGcc >= MODEL_RULES.density.ironRichGcc) return 'iron-rich';
  if (densityGcc >= MODEL_RULES.density.waterRichGcc) return 'basalt';
  return insol <= MODEL_RULES.ice[0].maxInsol ? 'ice-shell' : 'water-rich';
};

export const iceScore = ({ insol, locked, ground }) => {
  const row = MODEL_RULES.ice.find((entry) => insol <= entry.maxInsol);
  const base = row ? row.score : 0;
  const hotAndSpinning = insol > MODEL_RULES.ice[2].maxInsol && !locked; // no permanent night side to hide ice in
  const bonus = ground === 'water-rich' || ground === 'ice-shell' ? MODEL_RULES.iceWaterRichBonus : 0;
  return hotAndSpinning || base === 0 ? 0 : Math.min(1, Math.round((base + bonus) * 10) / 10);
};

export const magneticGuess = ({ massEarth, locked }) => {
  if (massEarth < 1) return 'none';
  return locked ? 'weak' : 'strong';
};

export const radiationMsvPerDay = ({ teffK, insol, tier, field }) => {
  const rule = MODEL_RULES.radiation;
  const fieldFactor = { strong: rule.strongFieldFactor, weak: rule.weakFieldFactor, none: 1 }[field];
  const open = RADIATION.moonSurfaceMsvPerDay + starActivity(teffK).dose * insol;
  return roundSig(open * MODEL_RULES.air[tier].radiationFactor * fieldFactor);
};

const liquidWaterGuess = ({ tier, insol, dayC, ground }) => {
  const rule = MODEL_RULES.liquidWater;
  if (tier === 'mild' && insol >= rule.minInsol && insol <= rule.maxInsol && dayC > 0) return 'surface';
  return ground === 'ice-shell' ? 'subsurface' : 'none';
};

const hazardList = ({ teffK, locked, dayC, nightC, gravityG, ecc, periodDays, ground }) => {
  const rule = MODEL_RULES.hazard;
  const tidalHeating = (ecc ?? 0) >= rule.tidalEcc && periodDays !== null && periodDays < rule.tidalPeriodDays;
  return [
    starActivity(teffK).flares !== 'low' && 'flares',
    locked && 'tidal-lock',
    dayC >= rule.heatDayC && 'extreme-heat',
    nightC <= rule.coldNightC && 'extreme-cold',
    (ground === 'lava' || tidalHeating) && 'volcanism',
    gravityG >= rule.highGravityG && 'high-gravity',
  ].filter(Boolean);
};

/**
 * Guess the unmeasured facts of an exoplanet from its measured ones.
 * @param {{ name: string, massEarth: number, densityGcc: number, gravityG: number, eqK: number|null, insol: number,
 *   periodDays: number|null, ecc: number|null, starTeffK: number|null }} known
 * @returns {{ locked: boolean, tier: 'none'|'thin'|'mild', freeSpinDayHours: number, facts: Record<string, import('./worlds.js').Fact> }}
 */
export const guessWorld = (known) => {
  const { name, massEarth, densityGcc, gravityG, eqK, insol, periodDays, ecc, starTeffK: teffK } = known;
  const locked = isTidallyLocked(periodDays);
  const tier = airTier({ insol, gravityG });
  const { dayC, nightC } = dayNightC({ eqK, insol, locked, hasAir: tier !== 'none' });
  const ground = groundType({ densityGcc, dayC, insol });
  const field = magneticGuess({ massEarth, locked });
  const air = MODEL_RULES.air[tier];
  const spin = MODEL_RULES.freeSpinDayHours;
  return {
    locked, tier,
    freeSpinDayHours: Math.round(spin.min + spin.span * nameHash(name)),
    facts: {
      tempDayC: generated(dayC), tempNightC: generated(nightC),
      pressurePa: generated(air.pressurePa), air: generated(air.gases.map((gas) => ({ ...gas }))),
      magneticField: generated(field),
      radiationMsvPerDay: generated(radiationMsvPerDay({ teffK, insol, tier, field })),
      waterIce: generated(iceScore({ insol, locked, ground })),
      liquidWater: generated(liquidWaterGuess({ tier, insol, dayC, ground })),
      ground: generated(ground),
      hazards: generated(hazardList({ teffK, locked, dayC, nightC, gravityG, ecc, periodDays, ground })),
    },
  };
};
