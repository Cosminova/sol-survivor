// The game's own drawings of worlds in the sky picker: looks follow the facts, and the same world always looks the same.
import { describe, it, expect } from 'vitest';
import { portraitLook, noiseField, systemLayout, PORTRAIT_CAPTION } from '../src/ui/worldPicker/portrait.js';
import { WORLDS, worldById, worldsInSystem } from '../src/data/worlds.js';

describe('portraitLook', () => {
  it('gives Titan methane seas and an air glow', () => {
    const look = portraitLook(worldById('titan'));
    expect(look.liquid).toBeTruthy();
    expect(look.glow).toBeTruthy();
  });

  it('hides Venus under cloud and leaves airless worlds without a glow', () => {
    expect(portraitLook(worldById('venus')).thickClouds).toBe(true);
    expect(portraitLook(worldById('moon')).glow).toBeNull();
  });

  it('draws bigger ice caps on icier worlds', () => {
    expect(portraitLook(worldById('europa')).iceCap).toBeGreaterThan(portraitLook(worldById('venus')).iceCap);
  });

  it('works for every world without throwing', () => {
    for (const w of WORLDS) expect(() => portraitLook(w), w.id).not.toThrow();
  });
});

describe('noiseField', () => {
  it('is the same for the same world and stays in 0..1', () => {
    const a = noiseField('gj-3378-b');
    const b = noiseField('gj-3378-b');
    for (const [u, v] of [[0, 0], [0.3, 0.7], [1, 1]]) {
      expect(a(u, v)).toBe(b(u, v));
      expect(a(u, v)).toBeGreaterThanOrEqual(0);
      expect(a(u, v)).toBeLessThanOrEqual(1);
    }
  });
});

describe('systemLayout', () => {
  it('places TRAPPIST-1 planets left to right by orbit size, inside the strip', () => {
    const worlds = worldsInSystem(worldById('trappist-1-e')?.system ?? 'TRAPPIST-1');
    const spots = systemLayout(worlds, 640);
    const byOrbit = [...worlds].sort((p, q) => p.facts.orbitAu.v - q.facts.orbitAu.v).map((w) => w.id);
    expect([...spots].sort((p, q) => p.x - q.x).map((s) => s.id)).toEqual(byOrbit);
    for (const s of spots) expect(s.x).toBeGreaterThan(0) && expect(s.x).toBeLessThan(640);
  });

  it('says plainly that the picture is not a photo', () => {
    expect(PORTRAIT_CAPTION).toMatch(/not a photo/);
  });
});
