// Sol Survivor wordmark: a solid planet mark plus condensed type. Flat, single colour.
import { h, s } from './dom.js';

export function logoMark({ size = 26 } = {}) {
  return s('svg', { viewBox: '0 0 32 32', width: size, height: size, 'aria-hidden': 'true', class: 'logo-mark' },
    s('circle', { cx: 16, cy: 16, r: 11, style: { fill: 'var(--accent)' } }),
    s('path', { d: 'M3 19.5c6.5-3.2 19.5-3.2 26 0', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
}

export function logo() {
  return h('span', { class: 'logo' }, logoMark(), h('span', { class: 'logo-word' }, 'Sol Survivor'));
}
