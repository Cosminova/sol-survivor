import { MARS, MOON, POWER } from '../data/constants.js';

const DEG = Math.PI / 180;
const mod = (x, m) => ((x % m) + m) % m;

export function marsSunDistanceAU(ls) {
  const { semiMajorAU: a, eccentricity: e, perihelionLs } = MARS;
  return (a * (1 - e * e)) / (1 + e * Math.cos(DEG * (ls - perihelionLs)));
}

export const marsSolarDeclinationDeg = (ls) => Math.asin(Math.sin(DEG * MARS.obliquityDeg) * Math.sin(DEG * ls)) / DEG;

// Top-of-atmosphere flux at Mars for a given season (W/m²).
export const marsTopFlux = (ls) => 1361 / marsSunDistanceAU(ls) ** 2;

// Sol-averaged insolation on flat ground at the top of the atmosphere (W/m²).
export function dailyMeanInsolation(latDeg, ls) {
  const phi = DEG * latDeg;
  const delta = DEG * marsSolarDeclinationDeg(ls);
  const cosH0 = -Math.tan(phi) * Math.tan(delta);
  const h0 = cosH0 >= 1 ? 0 : cosH0 <= -1 ? Math.PI : Math.acos(cosH0);
  const q = (marsTopFlux(ls) / Math.PI) * (h0 * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(h0));
  return Math.max(0, q);
}

// Hours of daylight in one sol for a latitude and season (half-day hour angle h0 from the same geometry).
// Gale Crater at Ls 246° gives ≈12.6 h, close to the REMS sunrise/sunset columns (05:40 → 17:56, 12.3 h).
export function daylightHours(latDeg, ls) {
  const phi = DEG * latDeg;
  const delta = DEG * marsSolarDeclinationDeg(ls);
  const cosH0 = -Math.tan(phi) * Math.tan(delta);
  const h0 = cosH0 >= 1 ? 0 : cosH0 <= -1 ? Math.PI : Math.acos(cosH0);
  return (h0 / Math.PI) * MARS.dayHours;
}

// Simplified direct + diffuse transmission through dust of optical depth tau.
// tau 0.5 (clear) passes ~80%; tau 10.8 (Opportunity's 2018 storm) passes ~2%.
export const atmosphericTransmission = (tau) => 0.95 * Math.exp(-0.35 * Math.max(0, tau));

export function marsSolarKwh({ areaM2, latDeg, ls, tau, dust }) {
  const surface = dailyMeanInsolation(latDeg, ls) * atmosphericTransmission(tau);
  return (surface * POWER.solarEfficiency * areaM2 * (1 - dust) * MARS.dayHours) / 1000;
}

// Lunar day/night. Equatorial sites get ~14.8 days of sun then ~14.8 days of night.
// Polar rim sites see the Sun skim the horizon almost all month (tracking vertical panels).
export function moonIsSunlit(site, dayIndex, phaseOffsetDays = 0) {
  const phase = mod(dayIndex + phaseOffsetDays, MOON.synodicDays);
  return phase < MOON.synodicDays * site.sunlit;
}

export function moonSolarKwh({ areaM2, site, dayIndex, phaseOffsetDays = 0, dust }) {
  if (!moonIsSunlit(site, dayIndex, phaseOffsetDays)) return 0;
  const geometry = Math.abs(site.lat) > 80 ? 0.9 : 2 / Math.PI;
  return (MOON.meanSolarFlux * geometry * POWER.solarEfficiency * areaM2 * (1 - dust) * MOON.dayHours) / 1000;
}

export function moonDaysUntilChange(site, dayIndex, phaseOffsetDays = 0) {
  const phase = mod(dayIndex + phaseOffsetDays, MOON.synodicDays);
  const litLength = MOON.synodicDays * site.sunlit;
  return phase < litLength ? Math.ceil(litLength - phase) : Math.ceil(MOON.synodicDays - phase);
}
