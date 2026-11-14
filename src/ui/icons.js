// Hand-drawn inline SVG icon set for the flight-control HUD: 24x24 grid, 1.5px stroke, currentColor,
// square caps and mitred joins for a technical drawing feel. No icon library. Plus id -> icon maps for game data.
import { s } from './dom.js';

// Each icon is a list of shapes: a string is a path `d`; ['c', cx, cy, r] a circle; ['r', x, y, w, h] a rect;
// ['e', cx, cy, rx, ry, rotateDeg] a rotated ellipse.
const ICONS = {
  menu: ['M4 7h16M4 12h16M4 17h10'],
  close: ['M6 6l12 12M18 6L6 18'],
  settings: ['M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7z', ['c', 12, 12, 3], 'M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5'],
  award: ['M12 3l5 3v6l-5 3-5-3V6z', 'M9 14.2V21l3-2 3 2v-6.8', ['c', 12, 9, 1.5]],
  'arrow-right': ['M4 12h15M13 6l6 6-6 6'],
  'arrow-left': ['M20 12H5M11 6l-6 6 6 6'],
  play: ['M7 4.5l12 7.5-12 7.5z'],
  'fast-forward': ['M4 5.5l8 6.5-8 6.5zM13 5.5l8 6.5-8 6.5z'],
  star: ['M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z'],
  lightbulb: ['M8.5 14.5a6 6 0 1 1 7 0V17h-7z', 'M9.5 20h5M12 17v-4'],
  satellite: [['r', 9.5, 9.5, 5, 5], ['r', 2.5, 10, 5, 4], ['r', 16.5, 10, 5, 4], 'M7.5 12h2M14.5 12h2M12 9.5V6.5M9 5a3 3 0 0 1 6 0M12 14.5V18M9.5 20h5'],
  info: [['c', 12, 12, 8.5], 'M12 11v6M12 7.2v.6'],
  sun: [['c', 12, 12, 4], 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1'],
  zap: ['M13 2.5L5 13.5h6l-1 8 8-11h-6z'],
  battery: [['r', 3, 7.5, 16, 9], 'M21.5 10.5v3M6.5 10.5v3M10 10.5v3M13.5 10.5v3'],
  recycle: ['M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1', 'M17.5 3v4h-4M6.5 21v-4h4'],
  wind: ['M3 8.5h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12.5h15a2.5 2.5 0 1 1-2.5 2.5M3 16.5h7'],
  mountain: ['M2.5 19.5l6.5-12 4 7 2.5-4 6 9z'],
  snowflake: ['M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6', 'M9.5 4.5l2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2'],
  sprout: ['M12 21v-9', 'M12 12c0-4-2.5-6-7-6 0 4 2.5 6 7 6z', 'M12 14.5c0-3.2 2-5 6.5-5 0 3.4-2 5-6.5 5z'],
  shield: ['M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6z'],
  rover: ['M4 9.5h11l4 4V15H4z', ['c', 7.5, 17.5, 2.25], ['c', 16, 17.5, 2.25], 'M8 9.5v-4h3.5M2.5 15h2M10 15h3.5'],
  antenna: [['c', 12, 7, 1.5], 'M12 8.5V21M8 21l4-9 4 9M9.3 18h5.4', 'M8.5 9.5a5 5 0 0 1 0-5M15.5 4.5a5 5 0 0 1 0 5M5.5 11.5a9 9 0 0 1 0-9M18.5 2.5a9 9 0 0 1 0 9'],
  wrench: ['M14.5 6.5a4.5 4.5 0 0 0-5.9 5.6L3.5 17.2l3.3 3.3 5.1-5.1a4.5 4.5 0 0 0 5.6-5.9l-3 3-2.5-.5-.5-2.5z'],
  droplet: ['M12 3l5.5 8a6.5 6.5 0 1 1-11 0z'],
  package: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5M12 12v9'],
  bed: ['M3 18V6M3 14h18v4M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H10v5', ['c', 6.5, 10.5, 1.5]],
  telescope: ['M4 13l11-6 2 3.6-11 6z', 'M17 8l3-1.6 1 1.8-3 1.6', 'M11 15l-3 6M11 15l3 6'],
  pickaxe: ['M5 21L16 10', 'M9 4c4-1 9 0 12 4-3-1.5-6-1.5-8-.5', 'M13.5 7.5l3 3'],
  user: [['c', 12, 8.5, 4.5], 'M9.5 8h5', 'M4.5 21v-2a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v2'],
  volume: ['M4 9.5h3.5l5-4v13l-5-4H4z', 'M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11'],
  book: ['M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z', 'M12 6.5V20'],
  check: [['c', 12, 12, 8.5], 'M8 12.5l3 3 5.5-6.5'],
  alert: ['M12 3.5L21.5 20h-19z', 'M12 10v5M12 17.3v.6'],
  lock: [['r', 5, 10.5, 14, 10], 'M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5V17'],
  atom: [['c', 12, 12, 1.5], ['e', 12, 12, 9.5, 3.8, 0], ['e', 12, 12, 9.5, 3.8, 60], ['e', 12, 12, 9.5, 3.8, 120]],
  bubbles: [['c', 8, 15, 4.5], ['c', 16.5, 8, 3], ['c', 17, 17.5, 1.5], ['c', 8, 5.5, 1.5]],
  // HUD extras
  orbit: [['c', 12, 12, 3], ['e', 12, 12, 10, 4.5, -25], ['c', 20.3, 7.2, 1.2]],
  reticle: [['c', 12, 12, 6.5], ['c', 12, 12, 1], 'M12 2v5M12 17v5M2 12h5M17 12h5'],
  fuel: ['M4 16a8 8 0 0 1 16 0', 'M12 8v2M6.4 10.4l1.4 1.4M17.6 10.4l-1.4 1.4', 'M12 16l4-5', 'M3.5 19.5h17'],
  status: [['r', 3, 5, 18, 14], 'M6 12h3l2-4 2.5 8 2-4H18'],
  thermometer: ['M10 4.5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z', 'M12 9v7.5'],
  pressure: [['c', 12, 12, 8.5], 'M12 12l4-4M12 5.5V7M5.5 12H7M17 12h1.5'],
  flask: ['M9.5 3.5h5', 'M10.5 3.5v6L5 19.5a1 1 0 0 0 .9 1.5h12.2a1 1 0 0 0 .9-1.5L13.5 9.5v-6', 'M7.5 15.5h9'],
  calendar: [['r', 4, 5.5, 16, 15], 'M4 10h16M8.5 3.5v4M15.5 3.5v4'],
  moon: ['M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z'],
  power: ['M12 3v8', 'M7 6.5a7.5 7.5 0 1 0 10 0'],
  log: [['r', 5, 3.5, 14, 17], 'M8.5 8h7M8.5 12h7M8.5 16h4'],
};

export const MODULE_ICONS = {
  solar: 'sun', fission: 'atom', battery: 'battery', recycler: 'recycle', oxygen: 'bubbles', moxie: 'wind',
  regolithO2: 'mountain', iceDrill: 'snowflake', greenhouse: 'sprout', shelter: 'shield', rover: 'rover',
  relay: 'antenna', spares: 'wrench',
};
export const SUPPLY_ICONS = { o2: 'bubbles', water: 'droplet', food: 'package' };
export const TASK_ICONS = { rest: 'bed', science: 'telescope', maintain: 'wrench', shield: 'pickaxe', greenhouse: 'sprout' };

function shape(spec) {
  if (typeof spec === 'string') return s('path', { d: spec });
  const [kind, a, b, c, d, rot] = spec;
  if (kind === 'c') return s('circle', { cx: a, cy: b, r: c });
  if (kind === 'r') return s('rect', { x: a, y: b, width: c, height: d });
  return s('ellipse', { cx: a, cy: b, rx: c, ry: d, transform: rot ? `rotate(${rot} ${a} ${b})` : null });
}

// icon(name, { size, label, className }) -> <svg>. Decorative unless a label is given.
export function icon(name, { size = 20, label, className = '' } = {}) {
  const shapes = ICONS[name] ?? ICONS.info;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true', focusable: 'false' };
  return s('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5,
    'stroke-linecap': 'square', 'stroke-linejoin': 'miter', class: `icon icon-${name} ${className}`.trim(), ...a11y,
  }, shapes.map(shape));
}
