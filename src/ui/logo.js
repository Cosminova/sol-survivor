// Mission-patch logo as inline SVG (same artwork as public/favicon.svg).
import { s } from './dom.js';

export function logo({ size = 38, title = 'Sol Survivor' } = {}) {
  const id = `lg${Math.random().toString(36).slice(2, 7)}`;
  return s('svg', { viewBox: '0 0 64 64', width: size, height: size, role: 'img', 'aria-label': title },
    s('defs', null,
      s('radialGradient', { id: `${id}p`, cx: '38%', cy: '35%', r: '70%' },
        s('stop', { offset: '0', 'stop-color': '#ffb07a' }),
        s('stop', { offset: '0.55', 'stop-color': '#e2602a' }),
        s('stop', { offset: '1', 'stop-color': '#7a2408' })),
      s('linearGradient', { id: `${id}r`, x1: '0', y1: '0', x2: '1', y2: '1' },
        s('stop', { offset: '0', 'stop-color': '#7deeff' }),
        s('stop', { offset: '1', 'stop-color': '#2ab3d6' }))),
    s('circle', { cx: 32, cy: 32, r: 30, fill: '#0b1330', stroke: `url(#${id}r)`, 'stroke-width': 3 }),
    s('circle', { cx: 11, cy: 18, r: 0.9, fill: '#fff' }),
    s('circle', { cx: 50, cy: 13, r: 0.8, fill: '#fff' }),
    s('circle', { cx: 54, cy: 30, r: 0.7, fill: '#cfe' }),
    s('circle', { cx: 32, cy: 34, r: 15, fill: `url(#${id}p)` }),
    s('ellipse', { cx: 32, cy: 34, rx: 25, ry: 7, fill: 'none', stroke: '#ffd166', 'stroke-width': 1.6, transform: 'rotate(-18 32 34)', opacity: 0.9 }),
    s('path', { d: 'M24 41 q4-4 8-1 t9-2', stroke: '#7a2408', 'stroke-width': 1.4, fill: 'none', opacity: 0.7 }),
    s('circle', { cx: 52, cy: 22, r: 3, fill: '#cfd8ea' }),
    s('path', { d: 'M32 4 l1.6 4.2 4.4 .2 -3.5 2.7 1.3 4.3 -3.8-2.5 -3.8 2.5 1.3-4.3 -3.5-2.7 4.4-.2z', fill: '#ffd166' }));
}
