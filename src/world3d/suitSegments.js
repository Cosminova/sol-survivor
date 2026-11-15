// Pure limb segmentation for the NASA EMU astronaut mesh (relaxed T-pose, facing +z, feet at y=0).
// Coordinates are fractions of suit height; `span` is arm span / height (about 0.93 for this model).
// The left side of the model (as you face it) is x < 0, so it is labelled L to match the rigs.

const SHOULDER_X = 0.165;
const ELBOW_X = 0.31;
const HIP_Y = 0.46;
const HIP_Z = 0.035; // front-to-back middle of the upper thigh, so a swinging leg stays in its socket
const KNEE_Y = 0.255;
const NECK_Y = 0.83;
const PLSS_Z = -0.075; // backpack sits behind this
// The backpack hangs below the hip line, down to PLSS_BOTTOM_Y. There it sits behind PLSS_SEAT_Z and is
// wider than the hips (HIP_HALF_WIDTH); the seat and upper thighs are in front of it and narrower.
const PLSS_BOTTOM_Y = 0.355;
const PLSS_SEAT_Z = -0.056;
const HIP_HALF_WIDTH = 0.15;

export function segmentOf(x, y, z, span = 0.93) {
  const ax = Math.abs(x);
  const side = x < 0 ? 'L' : 'R';
  const elbow = Math.min(ELBOW_X, span * 0.34);
  if (y > 0.5 && ax > SHOULDER_X && z > PLSS_Z - 0.05) return ax > elbow ? `forearm${side}` : `upperArm${side}`;
  if (y > NECK_Y && ax < 0.13 && z > PLSS_Z) return 'head';
  if (y >= HIP_Y) return 'torso';
  if (y < KNEE_Y) return `shin${side}`;
  // The backpack reaches below the hip line: it must stay on the torso, not swing with the thighs.
  const onBackpack = y > PLSS_BOTTOM_Y && (z < PLSS_SEAT_Z || ax > HIP_HALF_WIDTH);
  return onBackpack ? 'torso' : `thigh${side}`;
}

export const SEGMENTS = ['torso', 'head', 'upperArmL', 'forearmL', 'upperArmR', 'forearmR', 'thighL', 'shinL', 'thighR', 'shinR'];

// Solid pelvis (an ellipsoid, fractions of height) that fills the hollow suit shell around both hip
// joints. The shell is cut open at the hip line, so without it a swinging thigh shows a see-through seat.
// It stays just inside the shell at rest: upper thighs span x +-0.142 and z -0.052..0.118.
export const PELVIS = {
  centre: { x: 0, y: 0.44, z: HIP_Z },
  radii: { x: 0.135, y: 0.08, z: 0.08 },
};

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
    thighL: { x: -0.075, y: HIP_Y, z: HIP_Z },
    shinL: { x: -0.075, y: KNEE_Y, z: 0.005 },
    thighR: { x: 0.075, y: HIP_Y, z: HIP_Z },
    shinR: { x: 0.075, y: KNEE_Y, z: 0.005 },
    chestFront: { x: 0, y: 0.69, z: 0.13 },
  };
}
