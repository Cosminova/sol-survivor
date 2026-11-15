// Demo mode: a short scripted tour that never touches the player's own save.
import { describe, it, expect } from 'vitest';
import { DEMO_STEPS, snapshotSave, restoreSave } from '../src/ui/demo/demoTour.js';

const memoryStorage = (init = {}) => {
  const data = new Map(Object.entries(init));
  const store = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    dump: () => Object.fromEntries(data),
  };
  return new Proxy(store, { ownKeys: () => [...data.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
};

describe('demo tour', () => {
  it('has unique steps, each with a caption short enough to read in time', () => {
    const ids = DEMO_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of DEMO_STEPS) {
      expect(typeof s.run).toBe('function');
      expect(s.caption.split(/\s+/).length).toBeLessThanOrEqual(32);
    }
  });

  it('puts the player’s own save back exactly, dropping anything the demo wrote', () => {
    const storage = memoryStorage({ 'sol-survivor:v1': '{"mine":true}', 'sol-survivor:howto-seen': '1', other: 'keep' });
    const snap = snapshotSave(storage);
    storage.setItem('sol-survivor:v1', '{"demo":true}');
    storage.setItem('sol-survivor:tour-walk', '1');
    restoreSave(snap, storage);
    expect(storage.dump()).toEqual({ 'sol-survivor:v1': '{"mine":true}', 'sol-survivor:howto-seen': '1', other: 'keep' });
  });
});
