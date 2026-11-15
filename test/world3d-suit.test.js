import { describe, it, expect } from 'vitest';
import { segmentOf, JOINTS, PELVIS } from '../src/world3d/suitSegments.js';
import { locomotionPose, gaitParams, selectGait } from '../src/world3d/gaits.js';
import { WALK_SPEED, RUN_SPEED } from '../src/world3d/player.js';

// Measured on the NASA EMU mesh (fractions of suit height): the upper thighs span z -0.05..0.12,
// and the life-support backpack hangs down to y 0.37 behind them, at z -0.18..-0.06.
const THIGH_TOP = { y: 0.44, zBack: -0.052, zFront: 0.118, xOuter: 0.142 };

const insidePelvis = ({ x, y, z }) => {
  const { centre, radii } = PELVIS;
  return ((x - centre.x) / radii.x) ** 2 + ((y - centre.y) / radii.y) ** 2 + ((z - centre.z) / radii.z) ** 2 <= 1;
};

describe('world3d suit segmentation', () => {
  it('keeps the bottom of the backpack on the torso instead of swinging it with the thighs', () => {
    expect(segmentOf(0.1, 0.4, -0.12)).toBe('torso');
    expect(segmentOf(-0.1, 0.38, -0.17)).toBe('torso');
    expect(segmentOf(0.17, 0.45, -0.07)).toBe('torso');
    expect(segmentOf(0.17, 0.4, -0.03)).toBe('torso'); // side wall: wider than the hips
  });

  it('still assigns the seat and the legs to the thighs and shins', () => {
    expect(segmentOf(0.07, 0.4, -0.04)).toBe('thighR');
    expect(segmentOf(-0.07, 0.4, 0.1)).toBe('thighL');
    expect(segmentOf(0.14, 0.4, -0.05)).toBe('thighR'); // outer rear corner of the seat
    expect(segmentOf(0.16, 0.3, 0.05)).toBe('thighR'); // below the backpack the thigh flares wider
    expect(segmentOf(0.07, 0.1, -0.1)).toBe('shinR'); // boot heels stay on the leg
    expect(segmentOf(-0.07, 0.2, 0.05)).toBe('shinL');
  });

  it('pivots each leg at the top of the thigh, centred front to back', () => {
    const joints = JOINTS();
    const midZ = (THIGH_TOP.zBack + THIGH_TOP.zFront) / 2;
    for (const side of ['L', 'R']) {
      const hip = joints[`thigh${side}`];
      expect(hip.y).toBeGreaterThan(THIGH_TOP.y);
      expect(hip.y).toBeGreaterThan(joints[`shin${side}`].y);
      expect(Math.abs(hip.z - midZ)).toBeLessThan(0.01);
    }
  });
});

describe('world3d suit pelvis', () => {
  it('covers both hip joints and the seat between them', () => {
    const joints = JOINTS();
    expect(insidePelvis(joints.thighL)).toBe(true);
    expect(insidePelvis(joints.thighR)).toBe(true);
    expect(insidePelvis({ x: 0, y: 0.4, z: 0 })).toBe(true);
  });

  it('stays hidden inside the suit shell while the astronaut stands still', () => {
    const { centre, radii } = PELVIS;
    expect(centre.x).toBe(0);
    expect(centre.x + radii.x).toBeLessThan(THIGH_TOP.xOuter);
    expect(centre.z - radii.z).toBeGreaterThan(THIGH_TOP.zBack);
    expect(centre.z + radii.z).toBeLessThan(THIGH_TOP.zFront);
  });

  it('backs the open hip seam at the widest hip swing of any gait', () => {
    const joints = JOINTS();
    const hip = joints.thighR;
    const swings = [0.166, 0.38].flatMap((gravity) => [WALK_SPEED, RUN_SPEED].map((speed) => {
      const params = gaitParams(selectGait(gravity, speed), gravity, speed);
      return Math.abs(locomotionPose(params, 0.25).hipL);
    }));
    const swing = Math.max(...swings);
    // A thigh rim point at distance d from the hip moves at most d * swing away from the fixed torso rim.
    const rimDistance = Math.hypot(THIGH_TOP.y - hip.y, THIGH_TOP.zBack - hip.z);
    const seamOpening = rimDistance * swing;
    // The pelvis overlaps the shells on both sides of the hip seam by more than the seam can open.
    expect(PELVIS.centre.y + PELVIS.radii.y - hip.y).toBeGreaterThan(seamOpening);
    expect(hip.y - (PELVIS.centre.y - PELVIS.radii.y)).toBeGreaterThan(seamOpening);
  });
});
