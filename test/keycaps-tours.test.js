// Keycaps (keys drawn as small raised keys) and the per-view tours for Outpost 3D, Map 2D and Walk 3D.
import { describe, it, expect } from 'vitest';
import { keysText, keycaps, keyList } from '../src/ui/components/keycaps.js';
import { MODE_TOURS } from '../src/ui/tutorial/modeTours.js';
import { VIEW_MODES } from '../src/ui/screens/play/view3d.js';
import { KEY_ROWS } from '../src/ui/kid/howToPlay.js';
import { CONTROL_ROWS } from '../src/world3d/menus.js';

// A tiny element factory so the DOM builders can run without a browser.
const make = (tag, props, ...children) => ({ tag, class: props?.class, children: children.flat() });
const flat = (node) => [node, ...(node.children ?? []).filter((c) => typeof c === 'object').flatMap(flat)];

describe('keycaps', () => {
  it('reads a keys spec aloud with "or" between key sets', () => {
    expect(keysText([['W', 'A', 'S', 'D'], ['↑', '←', '↓', '→']])).toBe('W A S D or ↑ ← ↓ →');
    expect(keysText([['Tab'], 'then', ['Enter']])).toBe('Tab then Enter');
  });

  it('draws one kbd cap per key and an "or" between neighbouring sets', () => {
    const nodes = flat(keycaps([['E'], ['Enter'], ['Space']], make));
    expect(nodes.filter((n) => n.tag === 'kbd').map((n) => n.children[0])).toEqual(['E', 'Enter', 'Space']);
    expect(nodes.filter((n) => n.class === 'keycap-sep')).toHaveLength(2);
  });

  it('draws labels as text, not as caps', () => {
    const nodes = flat(keycaps([['Tab'], 'then', ['Enter']], make));
    expect(nodes.filter((n) => n.tag === 'kbd')).toHaveLength(2);
    expect(nodes.find((n) => n.class === 'keycap-text').children).toEqual(['then']);
    expect(nodes.some((n) => n.class === 'keycap-sep')).toBe(false);
  });

  it('builds a row per entry in a key list', () => {
    const table = keyList(KEY_ROWS, make);
    expect(table.children[0].children).toHaveLength(KEY_ROWS.length);
  });

  it.each([['How to play', KEY_ROWS], ['Walk 3D controls', CONTROL_ROWS]])('%s rows are valid key specs', (_, rows) => {
    for (const [keys, action] of rows) {
      expect(Array.isArray(keys) && keys.length > 0).toBe(true);
      for (const part of keys) expect(typeof part === 'string' || (Array.isArray(part) && part.every((k) => typeof k === 'string' && k))).toBe(true);
      expect(action.length).toBeGreaterThan(0);
    }
  });
});

describe('view tours', () => {
  it('has a tour for every outpost view', () => {
    expect(Object.keys(MODE_TOURS).sort()).toEqual([...VIEW_MODES].sort());
  });

  it.each(Object.entries(MODE_TOURS))('the %s tour stays short: 2-3 read bubbles of about 15 words', (_, steps) => {
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.length).toBeLessThanOrEqual(3);
    for (const st of steps) {
      expect(st.kind).toBe('read');
      expect(st.target).toMatch(/^[.#]/);
      expect(st.text.split(/\s+/).length).toBeLessThanOrEqual(16);
    }
  });

  it('gives every step a unique id', () => {
    const ids = Object.values(MODE_TOURS).flat().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
