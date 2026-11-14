import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLidar } from '../src/world3d/lidar.js';
import { makeHeightfield } from '../src/world3d/heightfield.js';
import { selectGait, gaitParams } from '../src/world3d/gaits.js';

const SITES = ['jezero', 'gale', 'arcadia', 'utopia', 'tranquility', 'shackleton'];

describe('world3d lidar terrain', () => {
  it.each(SITES)('%s sidecar matches its height grid', (id) => {
    const meta = JSON.parse(readFileSync(`public/terrain/${id}.json`, 'utf8'));
    const bin = readFileSync(`public/terrain/${id}.bin`);
    expect(bin.byteLength).toBe(meta.width * meta.height * 2);
    const dem = parseLidar(bin, meta);
    expect(dem.sample(0, 0)).toBeCloseTo(0, 5);
    expect(meta.license).toMatch(/Public domain/);
    const hf = makeHeightfield({ seed: 1, body: meta.body, pads: [{ x: 0, z: 0, r: 9 }], dem });
    expect(Math.abs(hf.heightAt(0, 0))).toBeLessThan(0.01);
    expect(Number.isFinite(hf.heightAt(15000, -8000))).toBe(true);
  });

  it('Shackleton is a deep bowl beside the rim base', () => {
    const meta = JSON.parse(readFileSync('public/terrain/shackleton.json', 'utf8'));
    expect(meta.minM).toBeLessThan(-3000);
  });
});

describe('world3d NASA-informed gaits', () => {
  it('switches to loping/hopping at much lower speeds on the Moon', () => {
    expect(selectGait(0.38, 1.0)).toBe('walk');
    expect(selectGait(0.165, 1.0)).toBe('lope');
    expect(selectGait(0.165, 3)).toBe('hop');
    expect(gaitParams('hop', 0.165, 3).aerial).toBeGreaterThan(gaitParams('walk', 0.38, 1).aerial);
  });
});
