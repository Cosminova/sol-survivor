// One consistent SVG icon set (Lucide, 24px stroke) plus id -> icon maps for game data.
import {
  createElement, Menu, X, Settings, Award, ArrowRight, ArrowLeft, Play, FastForward, Star, Lightbulb, Satellite,
  Info, Sun, Zap, Battery, Recycle, Wind, Mountain, Snowflake, Sprout, Shield, CarFront, RadioTower, Wrench,
  Droplet, Package, Bed, Telescope, Pickaxe, User, Volume2, BookOpen, CircleCheck, TriangleAlert, Lock, Atom, Bubbles,
} from 'lucide';

const ICONS = {
  menu: Menu, close: X, settings: Settings, award: Award, 'arrow-right': ArrowRight, 'arrow-left': ArrowLeft,
  play: Play, 'fast-forward': FastForward, star: Star, lightbulb: Lightbulb, satellite: Satellite, info: Info,
  sun: Sun, zap: Zap, battery: Battery, recycle: Recycle, wind: Wind, mountain: Mountain, snowflake: Snowflake,
  sprout: Sprout, shield: Shield, rover: CarFront, antenna: RadioTower, wrench: Wrench, droplet: Droplet,
  package: Package, bed: Bed, telescope: Telescope, pickaxe: Pickaxe, user: User, volume: Volume2,
  book: BookOpen, check: CircleCheck, alert: TriangleAlert, lock: Lock, atom: Atom, bubbles: Bubbles,
};

export const MODULE_ICONS = {
  solar: 'sun', fission: 'atom', battery: 'battery', recycler: 'recycle', oxygen: 'bubbles', moxie: 'wind',
  regolithO2: 'mountain', iceDrill: 'snowflake', greenhouse: 'sprout', shelter: 'shield', rover: 'rover',
  relay: 'antenna', spares: 'wrench',
};
export const SUPPLY_ICONS = { o2: 'bubbles', water: 'droplet', food: 'package' };
export const TASK_ICONS = { rest: 'bed', science: 'telescope', maintain: 'wrench', shield: 'pickaxe', greenhouse: 'sprout' };

// icon(name, { size, label, className }) -> <svg>. Decorative unless a label is given.
export function icon(name, { size = 20, label, className = '' } = {}) {
  const node = ICONS[name] ?? ICONS.info;
  const attrs = { width: size, height: size, 'stroke-width': 1.75, class: `icon icon-${name} ${className}`.trim() };
  return createElement(node, label ? { ...attrs, role: 'img', 'aria-label': label } : { ...attrs, 'aria-hidden': 'true', focusable: 'false' });
}
