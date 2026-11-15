// Sky, fog and light for a world look at one moment. Pure: colours are hex strings, the 3D views wrap them.
// Returns the same fields as world3d/sky.js skyLook so the walk mode drives its lights the same way.
import { clamp } from '../world3d/rng.js';
import { mixHex, darken } from './color.js';

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const NIGHT_ZENITH = '#03040a';
const BIG_STAR_DEG = 0.8; // wider than this the disc is drawn dimmer so its colour shows instead of burning white
const SUN_DISC_GAIN = 18;
const BIG_STAR_DISC_GAIN = 1.05;
const BIG_STAR_GLARE = 0.3; // a wide cool star glares less than the pinpoint Sun
const LAVA_UNDERGLOW = 1.2; // extra ground-bounce light per unit of lava coverage, day or night

export const isBigStar = (look) => look.starAngularSizeDeg > BIG_STAR_DEG;
export const starDiscGain = (look) => (isBigStar(look) ? BIG_STAR_DISC_GAIN : SUN_DISC_GAIN);
const glareOf = (look) => (isBigStar(look) ? BIG_STAR_GLARE : 1);

function airlessSky(look, sunElevDeg, lit) {
  const up = lit && sunElevDeg > -1;
  const high = sstep(8, 55, sunElevDeg);
  const base = look.groundColors.base;
  const lavaGlow = look.lava * LAVA_UNDERGLOW;
  return {
    zenith: '#000000', horizon: '#000000', ground: darken(base, up ? 0.25 : 0.85), halo: '#000000',
    haloStrength: 0, sunGlow: up ? 0.6 * glareOf(look) : 0, dust: 0, stars: up ? 0.5 : 1,
    sunIntensity: up ? (4.4 - 1.9 * high) * look.lightScale : 0, sunColor: mixHex('#ffffff', look.starColor, 0.75),
    hemiSky: up ? mixHex('#9a9da6', look.starColor, 0.35) : '#6f83ad', hemiGround: mixHex(darken(base, 0.3), look.lavaColor, look.lava),
    hemiIntensity: (up ? (2.1 - 1.55 * high) * look.lightScale : 0.4) + lavaGlow, fogColor: '#000000', fogDensity: 0,
    exposure: up ? 1.35 - 0.2 * high : 1.3, fill: up ? 0.8 - 0.65 * high : 0.7,
    fillColor: look.parent?.visible ? look.parent.bands[0] : '#9fb8ff', // the giant planet's glow fills the shadows
  };
}

/**
 * @param {ReturnType<typeof import('./worldLook.js').worldLook>} look
 * @param {{ sunElevDeg: number, tau?: number, lit?: boolean, stormActive?: boolean }} now
 */
export function skyModel(look, { sunElevDeg, tau = 0.5, lit = true, stormActive = false }) {
  if (look.airless) return airlessSky(look, sunElevDeg, lit);
  const { haze, hazeColor } = look;
  const day = sstep(-8, 5, sunElevDeg);
  const low = 1 - sstep(4, 30, sunElevDeg);
  const dustK = look.particles.dust ? Math.min(1, clamp((tau - 0.5) / 2.5, 0, 1) + (stormActive ? 0.7 : 0)) : 0;
  const zenithDay = mixHex(look.skyTop, darken(hazeColor, 0.35), dustK * 0.6);
  const horizonDay = mixHex(look.skyHorizon, darken(hazeColor, 0.2), dustK * 0.6);
  const zenithLow = mixHex(zenithDay, darken(look.skyTop, 0.6), low * 0.7 * (1 - haze * 0.6));
  const horizonLow = mixHex(horizonDay, darken(mixHex(look.skyHorizon, look.starColor, 0.4), 0.15), low * 0.6 * (1 - haze * 0.6));
  const zenith = mixHex(NIGHT_ZENITH, zenithLow, day);
  const horizon = mixHex(darken(look.skyHorizon, 0.9), horizonLow, day);
  const transmission = Math.max(0.1, look.directLight * (stormActive ? 0.35 : 1));
  return {
    zenith, horizon, ground: darken(look.groundColors.dark, 0.7 - 0.5 * day),
    halo: mixHex(look.starColor, '#ffffff', 0.3), haloStrength: (0.25 + low * 0.9) * day * (1 - haze) * (1 - dustK * 0.7),
    sunGlow: day * (1 - haze * 0.5) * (1 - dustK * 0.6) * glareOf(look), dust: Math.max(dustK, haze > 0.85 ? 0.9 : haze * 0.5), stars: (1 - day) * 0.9 * (1 - haze),
    sunIntensity: 3.2 * look.lightScale * transmission * sstep(-3, 5, sunElevDeg), sunColor: mixHex(mixHex('#ffffff', look.starColor, 0.6), hazeColor, haze * 0.5),
    // Thick air scatters the light: little direct beam, lots of even glow from the whole sky.
    hemiSky: mixHex(zenith, horizon, 0.6), hemiGround: mixHex(darken(look.groundColors.base, 0.45), look.lavaColor, look.lava),
    hemiIntensity: (0.4 + day * (0.9 + haze * 2.4 + dustK * 0.5)) * look.lightScale + look.lava * LAVA_UNDERGLOW,
    fogColor: darken(mixHex(horizon, hazeColor, stormActive ? 0.5 * day : 0), 0.08),
    fogDensity: (0.00004 + haze ** 3 * 0.0022) * (stormActive ? 12 : 1) + (1 - day) * 0.00002,
    exposure: 1 + (1 - day) * 0.3, fill: 0.15 + (1 - day) * 0.4, fillColor: mixHex('#ffffff', hazeColor, 0.5),
  };
}
