// Pure limb segmentation for the NASA EMU astronaut mesh (relaxed T-pose, facing +z, feet at y=0).
// Coordinates are fractions of suit height; `span` is arm span / height (about 0.93 for this model).
// The left side of the model (as you face it) is x < 0, so it is labelled L to match the rigs.

const SHOULDER_X = 0.165;
const ELBOW_X = 0.31;
const HIP_Y = 0.46;
const KNEE_Y = 0.255;
const NECK_Y = 0.83;
const PLSS_Z = -0.075; // backpack sits behind this

export function segmentOf(x, y, z, span = 0.93) {
  const ax = Math.abs(x);
  const side = x < 0 ? 'L' : 'R';
  const elbow = Math.min(ELBOW_X, span * 0.34);
  if (y > 0.5 && ax > SHOULDER_X && z > PLSS_Z - 0.05) return ax > elbow ? `forearm${side}` : `upperArm${side}`;
  if (y > NECK_Y && ax < 0.13 && z > PLSS_Z) return 'head';
  if (y < HIP_Y) return y < KNEE_Y ? `shin${side}` : `thigh${side}`;
  return 'torso';
}

export const SEGMENTS = ['torso', 'head', 'upperArmL', 'forearmL', 'upperArmR', 'forearmR', 'thighL', 'shinL', 'thighR', 'shinR'];

// Joint pivots (fractions of height). Hands are only used to measure the arms' rest angle.
export function JOINTS(span = 0.93) {
  const hand = span / 2 - 0.025;
  const elbow = Math.min(ELBOW_X, span * 0.34);
  return {
    origin: { x: 0, y: 0, z: 0 },
    torso: { x: 0, y: HIP_Y + 0.01, z: 0 },
    head: { x: 0, y: NECK_Y, z: 0.01 },
    upperArmL: { x: -SHOULDER_X, y: 0.775, z: 0 },
    forearmL: { x: -elbow, y: 0.71, z: 0 },
    handL: { x: -hand, y: 0.625, z: 0 },
    upperArmR: { x: SHOULDER_X, y: 0.775, z: 0 },
    forearmR: { x: elbow, y: 0.71, z: 0 },
    handR: { x: hand, y: 0.625, z: 0 },
    thighL: { x: -0.075, y: HIP_Y, z: 0 },
    shinL: { x: -0.075, y: KNEE_Y, z: 0.005 },
    thighR: { x: 0.075, y: HIP_Y, z: 0 },
    shinR: { x: 0.075, y: KNEE_Y, z: 0.005 },
    chestFront: { x: 0, y: 0.69, z: 0.13 },
  };
}
