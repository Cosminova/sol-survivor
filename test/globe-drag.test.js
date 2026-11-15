import { describe, it, expect } from 'vitest';
import { advanceDrag, pointerReleased, DRAG_SLOP_PX, SPIN_PER_PX, TILT_PER_PX } from '../src/ui/outpost3d/sceneUtil.js';

const start = () => ({ x: 100, y: 100, moved: false, id: 1 });

describe('globe site picker drag', () => {
  it('treats a press that stays within the slop as a tap, not a drag', () => {
    const drag = start();

    const step = advanceDrag(drag, { x: 100 + DRAG_SLOP_PX, y: 100 - DRAG_SLOP_PX });

    expect(step.drag.moved).toBe(false);
    expect(step.dSpin).toBe(0);
    expect(step.dLat).toBe(0);
    expect(step.drag).toEqual(drag); // the anchor stays put, so slow presses still add up to a drag
  });

  it('spins the globe with a sideways drag', () => {
    const step = advanceDrag(start(), { x: 130, y: 100 });

    expect(step.drag).toEqual({ x: 130, y: 100, moved: true, id: 1 });
    expect(step.dSpin).toBeCloseTo(30 * SPIN_PER_PX);
    expect(step.dLat).toBe(0);
  });

  it('tilts the view with an up-and-down drag', () => {
    const step = advanceDrag(start(), { x: 100, y: 140 });

    expect(step.drag.moved).toBe(true);
    expect(step.dSpin).toBe(0);
    expect(step.dLat).toBeCloseTo(40 * TILT_PER_PX);
  });

  it('measures each move from the previous one once the drag has started', () => {
    const first = advanceDrag(start(), { x: 120, y: 100 });

    const second = advanceDrag(first.drag, { x: 121, y: 98 });

    expect(second.drag).toEqual({ x: 121, y: 98, moved: true, id: 1 });
    expect(second.dSpin).toBeCloseTo(1 * SPIN_PER_PX);
    expect(second.dLat).toBeCloseTo(-2 * TILT_PER_PX);
  });

  it('never mutates the drag it was given', () => {
    const drag = Object.freeze(start());

    expect(() => advanceDrag(drag, { x: 300, y: 300 })).not.toThrow();
    expect(drag).toEqual(start());
  });

  it('knows the mouse button was let go somewhere the canvas never heard about', () => {
    expect(pointerReleased({ pointerType: 'mouse', buttons: 0 })).toBe(true);
    expect(pointerReleased({ pointerType: 'mouse', buttons: 1 })).toBe(false);
    expect(pointerReleased({ pointerType: 'touch', buttons: 0 })).toBe(false);
  });
});
