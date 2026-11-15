// Outpost 3D ground on the Moon and Mars follows NASA laser altimetry (MOLA / LOLA), stays level under the
// camp, and keeps going far past the old 260 m square so its edge never shows.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseLidar } from '../src/world3d/lidar.js';
import { OutpostScene } from '../src/ui/outpost3d/outpostScene.js';

const lidar = (site) => parseLidar(
  fs.readFileSync(new URL(`../public/terrain/${site}.bin`, import.meta.url)),
  JSON.parse(fs.readFileSync(new URL(`../public/terrain/${site}.json`, import.meta.url), 'utf8')),
);
const heightFor = (body, dem) => OutpostScene.prototype._bodyHeight.call({}, body, dem);

describe('Outpost 3D ground from NASA lidar', () => {
  it.each([['jezero', 'mars'], ['shackleton', 'moon']])('%s: far ground heights are the lidar heights', (site, body) => {
    const dem = lidar(site);
    const height = heightFor(body, dem);
    for (const [x, z] of [[1500, 0], [0, -2500], [-3000, 2000]]) expect(height(x, z)).toBeCloseTo(dem.sample(x, z), 6);
  });

  it('keeps the camp level: no lidar relief inside the camp', () => {
    const dem = lidar('shackleton');
    expect(heightFor('moon', dem)(10, 12)).toBeCloseTo(heightFor('moon', null)(10, 12), 9);
  });

  it('shows real relief across the far ground (not a flat plane)', () => {
    const height = heightFor('mars', lidar('jezero'));
    const samples = [500, 1000, 2000, 3000, 3900].map((r) => height(r, 0));
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(1);
  });
});
