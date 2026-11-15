// Outpost 3D ground on the Moon and Mars: hills frame the camp, then fade into open plains, so the far ground
// that reaches the horizon is not one endless raised plateau.
import { describe, it, expect } from 'vitest';
import { OutpostScene } from '../src/ui/outpost3d/outpostScene.js';

const heightFor = (body) => OutpostScene.prototype._bodyHeight.call({}, body);

describe('Outpost 3D ground', () => {
  it.each(['mars', 'moon'])('%s: hills around the camp fade to open plains far away', (body) => {
    const height = heightFor(body);
    expect(height(110, 0)).toBeGreaterThan(5);
    expect(height(2000, 0)).toBeCloseTo(0, 6);
  });
});
