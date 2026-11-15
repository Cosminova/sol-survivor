// Landing sites for exoplanets. Nobody has a map of these worlds, so every site here is a game-model guess
// (origin 'generated'): a few typical places worked out from the planet's generated day/night temperatures and ice.

const TWILIGHT_SWING_C = 20;
const SHELTERED_ICE_BONUS = 0.3; // dark, cold places hold more ice than the world average
const POLAR_CHILL_C = 40;

const clamp01 = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
const shelteredIce = (waterIce) => (waterIce > 0 ? clamp01(waterIce + SHELTERED_ICE_BONUS) : 0);

const lockedSites = ({ dayC, nightC, waterIce }) => {
  const middle = Math.round((dayC + nightC) / 2);
  return [
    {
      key: 'twilight', name: 'Twilight Ring', lat: 0, lon: 90, iceAccess: clamp01(waterIce * 0.7), science: 1.2, sunlit: 0.5,
      tempDayC: middle + TWILIGHT_SWING_C, tempNightC: middle - TWILIGHT_SWING_C,
      blurb: 'The thin band between endless day and endless night. The star sits on the horizon forever.',
    },
    {
      key: 'dayside', name: 'Dayside Plain', lat: 0, lon: 0, iceAccess: 0, science: 1.4, sunlit: 1, tempDayC: dayC, tempNightC: dayC,
      blurb: 'The star hangs straight overhead and never sets. Lots of power, lots of heat.',
    },
    {
      key: 'nightside', name: waterIce > 0 ? 'Nightside Ice Field' : 'Nightside Basin', lat: 0, lon: 180,
      iceAccess: shelteredIce(waterIce), science: 1.0, sunlit: 0, tempDayC: nightC, tempNightC: nightC,
      blurb: waterIce > 0
        ? 'Always dark and very cold. Ice can hide here, but solar panels are useless.'
        : 'Always dark and very cold. No sunlight ever reaches this ground.',
    },
  ];
};

const spinningSites = ({ dayC, nightC, waterIce }) => [
  {
    key: 'equator', name: 'Equator Plain', lat: 2, lon: 0, iceAccess: clamp01(waterIce * 0.5), science: 1.1, sunlit: 0.5,
    tempDayC: dayC, tempNightC: nightC,
    blurb: 'Flat ground near the middle of the planet. The warmest days and steady sunlight.',
  },
  {
    key: 'highlands', name: 'Highlands', lat: 35, lon: 120, iceAccess: clamp01(waterIce * 0.7), science: 1.5, sunlit: 0.5,
    tempDayC: dayC - POLAR_CHILL_C / 2, tempNightC: nightC - POLAR_CHILL_C / 2,
    blurb: 'Old, rugged hills. Great rocks to study, but a harder place to build.',
  },
  {
    key: 'pole', name: waterIce > 0 ? 'Polar Ice Cap' : 'Polar Plain', lat: 84, lon: 0, iceAccess: shelteredIce(waterIce), science: 1.0,
    sunlit: 0.3, tempDayC: dayC - POLAR_CHILL_C, tempNightC: nightC - POLAR_CHILL_C,
    blurb: 'The top of the world. Weak sunlight and long, cold shadows.',
  },
];

/**
 * @param {{ worldId: string, analog: 'moon'|'mars', locked: boolean, facts: Record<string, { v: any }> }} world
 * @returns {Array<object>} sites in the contract shape, plus worldId, body, sunlit, tempDayC and tempNightC
 */
export const generatedSites = ({ worldId, analog, locked, facts }) => {
  const climate = { dayC: facts.tempDayC.v, nightC: facts.tempNightC.v, waterIce: facts.waterIce.v };
  const sites = locked ? lockedSites(climate) : spinningSites(climate);
  return sites.map(({ key, ...site }) => ({ id: `${worldId}-${key}`, worldId, body: analog, ...site, origin: 'generated' }));
};
