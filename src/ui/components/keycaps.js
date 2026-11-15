// Keyboard keys drawn as small keycaps. A keys spec is a list: an array is a set of keys drawn as caps, a plain
// string is a label drawn as text. Two key sets side by side are joined by "or".
//   [['W', 'A', 'S', 'D'], ['↑', '←', '↓', '→']]  →  [W][A][S][D] or [↑][←][↓][→]
//   [['Tab'], 'then', ['Enter']]                  →  [Tab] then [Enter]
import { h } from '../dom.js';

const joinsWithOr = (keys, i) => i > 0 && Array.isArray(keys[i]) && Array.isArray(keys[i - 1]);

/** Plain-text version of a keys spec, for read-aloud and tests: "W A S D or ↑ ← ↓ →". */
export function keysText(keys) {
  return keys.map((part, i) => {
    const text = Array.isArray(part) ? part.join(' ') : part;
    return joinsWithOr(keys, i) ? `or ${text}` : text;
  }).join(' ');
}

/**
 * @param {Array<string[]|string>} keys
 * @param {(tag: string, props: object, ...children: unknown[]) => Node} [make] element factory (world3d passes its own)
 */
export function keycaps(keys, make = h) {
  const nodes = keys.flatMap((part, i) => {
    const sep = joinsWithOr(keys, i) ? [make('span', { class: 'keycap-sep' }, 'or')] : [];
    if (!Array.isArray(part)) return [...sep, make('span', { class: 'keycap-text' }, part)];
    return [...sep, ...part.map((key) => make('kbd', { class: 'keycap' }, key))];
  });
  return make('span', { class: 'keycaps' }, ...nodes);
}

/** A two-column list of [keys, what it does] rows. */
export function keyList(rows, make = h, className = 'keylist') {
  return make('table', { class: className }, make('tbody', null,
    ...rows.map(([keys, action]) => make('tr', null, make('td', null, keycaps(keys, make)), make('td', null, action)))));
}
