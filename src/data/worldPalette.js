// Colours for painting a world's terrain and sky, worked out from its facts (ground type, ice, liquid, air).
// These are the game's own colours: the terrain painter builds its own textures from them.
// Pure and deterministic: the name seed only nudges brightness so two basalt worlds do not look identical.
import { nameHash } from './worldModel.js';

export const GROUND_COLOURS = Object.freeze({
  regolith: { ground: '#8d8a85', rock: '#5d5a56' },
  basalt: { ground: '#6b5a4e', rock: '#3f3530' },
  'iron-oxide': { ground: '#b5603a', rock: '#7a3b22' },
  'iron-rich': { ground: '#5c463e', rock: '#33241f' },
  sulfur: { ground: '#d9c14a', rock: '#8a5a1e' },
  'ice-shell': { ground: '#cfdbe4', rock: '#8fa3b3' },
  'dirty-ice': { ground: '#8b8378', rock: '#4f4a44' },
  'organic-dunes': { ground: '#8a5a2b', rock: '#4a3220' },
  lava: { ground: '#2b1a16', rock: '#120b0a' },
  'water-rich': { ground: '#5f6e73', rock: '#39464b' },
});
export const DEFAULT_GROUND = 'basalt';

export const ICE_COLOUR = '#d8e4ee';
export const LIQUID_COLOURS = Object.freeze({ lava: '#ff6a1f', water: '#2f6f8f', methane: '#3b2a1a' });
export const SKY_COLOURS = Object.freeze({
  none: { sky: '#000000', haze: null },
  'thin-co2': { sky: '#c9a27e', haze: '#d9b48f' },
  mild: { sky: '#8fa9c4', haze: '#c7d3de' },
  'methane-haze': { sky: '#c98a3a', haze: '#e0a85a' },
  'acid-clouds': { sky: '#d8b36a', haze: '#e9cf8f' },
});

const STAR_TINTS = [
  { maxTeffK: 3300, colour: '#ff8a50' }, { maxTeffK: 3900, colour: '#ffab6b' },
  { maxTeffK: 5200, colour: '#ffd2a1' }, { maxTeffK: Infinity, colour: '#fff4e8' },
];
const STAR_GROUND_TINT = 0.12; // how much of the star's colour shows on the ground
const STAR_SKY_TINT = 0.35;
const AIRLESS_SKY_GLOW = 0.08;
const BRIGHTNESS_JITTER = 0.06;
const THICK_AIR_PA = 1e6;

const channels = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const toHex = (rgb) => `#${rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`;

export const mix = (from, to, amount) => {
  const a = channels(from);
  const b = channels(to);
  return toHex(a.map((value, index) => value + (b[index] - value) * amount));
};
const brighten = (hex, amount) => mix(hex, amount >= 0 ? '#ffffff' : '#000000', Math.abs(amount));

export const starTint = (teffK) => STAR_TINTS.find((row) => (teffK ?? 5772) <= row.maxTeffK).colour;

export const skyKind = ({ pressurePa, air }) => {
  if (!pressurePa) return 'none';
  if (air.some((part) => part.gas === 'CH4')) return 'methane-haze';
  if (pressurePa >= THICK_AIR_PA) return 'acid-clouds';
  return air[0]?.gas === 'CO2' ? 'thin-co2' : 'mild';
};

/**
 * @param {{ ground: string, waterIce: number, liquid: 'lava'|'water'|'methane'|null, pressurePa: number,
 *   air: Array<{ gas: string, pct: number }>, starTeffK?: number|null, seed?: string }} look
 *   starTeffK set = lit by another star (tints ground and sky); seed set = small brightness variation.
 * @returns {{ ground: string, rock: string, ice: string|null, sky: string, haze: string|null, liquid: string|null }}
 */
export const paletteFor = ({ ground, waterIce, liquid, pressurePa, air, starTeffK = null, seed = null }) => {
  const base = GROUND_COLOURS[ground] ?? GROUND_COLOURS[DEFAULT_GROUND];
  const tint = starTeffK === null ? null : starTint(starTeffK);
  const jitter = seed === null ? 0 : (nameHash(seed) - 0.5) * 2 * BRIGHTNESS_JITTER;
  const paint = (hex) => brighten(tint ? mix(hex, tint, STAR_GROUND_TINT) : hex, jitter);
  const kind = skyKind({ pressurePa, air });
  const skyBase = SKY_COLOURS[kind];
  const lit = (hex) => (tint ? mix(hex, tint, STAR_SKY_TINT) : hex);
  return {
    ground: paint(base.ground),
    rock: paint(base.rock),
    ice: waterIce > 0 ? ICE_COLOUR : null,
    sky: kind === 'none' ? (tint ? mix('#000000', tint, AIRLESS_SKY_GLOW) : skyBase.sky) : lit(skyBase.sky),
    haze: skyBase.haze === null ? null : lit(skyBase.haze),
    liquid: liquid ? LIQUID_COLOURS[liquid] : null,
  };
};
