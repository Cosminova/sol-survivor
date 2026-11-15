// World look for the outpost backdrop (src/ui/outpost3d/outpostScene.js): its sky palette, the ground heights
// and the generated ground colour map. Pure: the scene wraps the bytes in a texture.
import { makeSurface } from './relief.js';
import { cachedTexture, generateGroundMap } from './textures.js';
import { mixHex, darken } from './color.js';
import { parentDirection, fixedStarDirection } from './worldLook.js';
import { smoothstep, fbm2, clamp } from '../world3d/rng.js';

const BASE_PAD_M = 30; // flat ground under the modules
const LAVA_FREE_M = 46; // nobody walks in the backdrop, so lava may come closer than in the walk mode
const RIM_HILLS = { from: 80, to: 128, base: 10, extra: 16 }; // hills that close the horizon of the small scene
const LEGACY_DISC_COS = 0.99955; // the Sun as the Moon and Mars scenes draw it (larger than life so it reads)
const SUN_DEG = 0.53;
const BIG_STAR_DEG = 0.8;

/** Same keys as the scene's Mars / Moon palettes, worked out from the look. */
export function outpostPalette(look) {
  const { base } = look.groundColors;
  const sunDay = mixHex('#ffffff', look.starColor, 0.55);
  if (look.airless) {
    return {
      dayZenith: '#000003', dayHorizon: '#06060a', duskZenith: '#000003', duskHorizon: '#0a0a10', nightZenith: '#000002', nightHorizon: '#030306',
      stormZenith: '#000003', stormHorizon: '#06060a', below: '#09090c', sunDay, sunLow: look.starColor,
      rim: look.parent?.visible ? look.parent.bands[0] : '#8fb3ff', hemiSky: '#1a1c24', hemiGround: mixHex('#111114', look.lavaColor, look.lava), regolith: base,
    };
  }
  return {
    dayZenith: look.skyTop, dayHorizon: look.skyHorizon,
    duskZenith: darken(look.skyTop, 0.6), duskHorizon: darken(mixHex(look.skyHorizon, look.starColor, 0.45), 0.1),
    nightZenith: '#07060c', nightHorizon: darken(look.skyHorizon, 0.88),
    stormZenith: darken(look.hazeColor, 0.6), stormHorizon: darken(look.hazeColor, 0.35),
    below: darken(base, 0.3), sunDay, sunLow: look.starColor, rim: look.hazeColor,
    hemiSky: look.skyHorizon, hemiGround: mixHex(darken(base, 0.5), look.lavaColor, look.lava), regolith: base,
  };
}

/** How the star is drawn: disc edge (cosine of its drawn radius) and brightness, scaled from its real width. */
export function outpostStar(look) {
  const scale = clamp(look.starAngularSizeDeg / SUN_DEG, 0.6, 14) ** 0.7;
  const radius = Math.min(0.35, Math.acos(LEGACY_DISC_COS) * scale);
  const big = look.starAngularSizeDeg > BIG_STAR_DEG;
  return { discCos: Math.cos(radius), disc: big ? 0.5 : 1.4, solid: big ? 1 : 0 };
}

/** Fog thickness 0..1 from the air alone (the scene adds dust storms on top). */
export const outpostHaze = (look) => (look.airless ? 0 : look.haze ** 2 * 0.9);

/**
 * Ground under and around the base: heights, a colour map and the pool level (null when dry).
 * @param {object} look world look
 * @param {{ size?: number, extentM: number }} opts
 */
export function outpostGround(look, { size = 512, extentM }) {
  const surface = makeSurface(look, { pads: [{ x: 0, z: 0, r: BASE_PAD_M }], lavaFreeRadius: LAVA_FREE_M });
  const hillSeed = look.seed % 997;
  const heightAt = (x, z) => {
    const rim = smoothstep(RIM_HILLS.from, RIM_HILLS.to, Math.hypot(x, z));
    return surface.heightAt(x, z) + (rim > 0 ? rim * (RIM_HILLS.base + (fbm2(x * 0.025, z * 0.025, hillSeed, 3) * 0.5 + 0.5) * RIM_HILLS.extra) : 0);
  };
  const map = cachedTexture(`ground:${look.worldId}:${look.seed}:${size}:${extentM}`, () => generateGroundMap(look, surface, { size, extentM, heightAt }));
  return { heightAt, map, poolLevel: surface.poolLevel };
}

/** Direction of the star when it never moves, and of the giant planet a moon always faces. */
export const outpostFixedStar = (look, site) => fixedStarDirection(look, site);
export const outpostParentDirection = (site) => parentDirection(site);
