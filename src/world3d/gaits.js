// Pure, NASA-informed spacesuit locomotion. Returns joint angles; the 3D rigs just apply them.
//
// Basis (see public/models/CREDITS.md):
// - Walk/run transition happens near Froude number Fr = v^2 / (g L) ~ 0.5 (Kram, Domingo & Ferris 1997,
//   J. Exp. Biol. 200; NASA-funded reduced-gravity studies), so in 1/6 g astronauts stop "walking" at
//   under 1 m/s. Apollo crews then used a loping skip (one leg leads) or a two-footed "bunny hop"
//   (Apollo Lunar Surface Journal, Apollo 11-17 EVA footage). Pressurized suits add stiffness
//   (Carr & McGee 2009, "The Apollo Number", PLoS ONE) so knees flex little and arms swing little.
// - Flight time comes from the stance/aerial split; apex height = g * t_air^2 / 8 (ballistic), so
//   the same stride gives much higher, floatier arcs on the Moon than on Mars.
// - Falls: Apollo 16 (Young, Duke) and Apollo 17 (Schmitt) fell while moving fast and pushed back up.

export const G_EARTH = 9.81;
export const LEG_LENGTH = 0.9;

export const froude = (speed, gravity) => (speed * speed) / (G_EARTH * gravity * LEG_LENGTH);

export function selectGait(gravity, speed) {
  if (speed < 0.12) return 'idle';
  const fr = froude(speed, gravity);
  if (gravity < 0.25) {
    if (fr < 0.35) return 'walk';
    return speed > 2.2 ? 'hop' : 'lope';
  }
  return fr < 0.5 ? 'walk' : 'run';
}

// Per-gait parameters. cadence = strides per second; aerial = fraction of a stride with no foot down.
export function gaitParams(gait, gravity, speed) {
  const gScale = Math.sqrt(Math.max(0.1, gravity)); // dynamic similarity: frequency ~ sqrt(g / L)
  const P = {
    idle: { cadence: 0, aerial: 0, swing: 0, knee: 0.05, arm: 0.04, lean: 0, phaseOffset: 0.5 },
    walk: { cadence: (0.55 + 0.45 * speed) * (0.6 + 0.4 * gScale), aerial: 0, swing: 0.32 + speed * 0.12, knee: 0.35, arm: 0.18, lean: 0.05, phaseOffset: 0.5 },
    run: { cadence: (0.95 + 0.25 * speed) * (0.55 + 0.45 * gScale), aerial: 0.3, swing: 0.55, knee: 0.7, arm: 0.28, lean: 0.14, phaseOffset: 0.5 },
    lope: { cadence: 0.95 + 0.12 * speed, aerial: 0.45, swing: 0.42, knee: 0.45, arm: 0.12, lean: 0.2, phaseOffset: 0.25 },
    hop: { cadence: 0.9 + 0.1 * speed, aerial: 0.6, swing: 0.3, knee: 0.55, arm: 0.1, lean: 0.25, phaseOffset: 0 },
  }[gait] ?? null;
  if (!P) throw new Error(`unknown gait ${gait}`);
  const tAir = P.cadence > 0 ? P.aerial / P.cadence : 0;
  const apex = (G_EARTH * gravity * tAir * tAir) / 8;
  return { gait, ...P, apex: Math.min(0.6, apex + (gait === 'walk' ? 0.025 : 0)) };
}

const s = Math.sin;
const c = Math.cos;

// phase in strides (0..1 = one full stride). Joint angles in radians, bodyY in metres.
export function locomotionPose(params, phase, { suitLimit = 1 } = {}) {
  const a = phase * Math.PI * 2;
  const R = a + params.phaseOffset * Math.PI * 2;
  // Body rises during flight: one bump per contact (twice per stride when the legs alternate).
  const bumps = params.phaseOffset === 0 ? 1 : 2;
  const lift = params.aerial > 0 ? Math.max(0, s(a * bumps)) : Math.abs(s(a * bumps)) * 0.5 + 0.5;
  const arm = params.arm * suitLimit;
  return {
    bodyY: params.apex * lift,
    torsoPitch: params.lean + (params.aerial > 0 ? 0.04 * s(a * bumps) : 0),
    hipL: s(a) * params.swing,
    hipR: s(R) * params.swing,
    kneeL: params.knee * Math.max(0, -c(a)) + 0.05,
    kneeR: params.knee * Math.max(0, -c(R)) + 0.05,
    shoulderL: -s(R) * arm,
    shoulderR: -s(a) * arm,
    elbowL: -0.25,
    elbowR: -0.25,
    armSpread: 0.12,
    headPitch: 0,
  };
}

// Number of foot strikes between two stride phases (for footprints and crunch sounds).
export function footStrikes(params, prev, next) {
  if (!params.cadence) return 0;
  const n = params.phaseOffset === 0 ? 1 : 2;
  return Math.max(0, Math.floor(next * n) - Math.floor(prev * n));
}

const POSE0 = { bodyY: 0, torsoPitch: 0, hipL: 0, hipR: 0, kneeL: 0.05, kneeR: 0.05, shoulderL: 0, shoulderR: 0, elbowL: -0.2, elbowR: -0.2, armSpread: 0.12, headPitch: 0, headYaw: 0 };

// Task poses, looping with time t (seconds).
export function workPose(verb, t) {
  const w = s(t * 5);
  switch (verb) {
    case 'shield': return { ...POSE0, torsoPitch: 0.45 + w * 0.15, shoulderL: -0.9 - w * 0.5, shoulderR: -0.9 - w * 0.5, kneeL: 0.35, kneeR: 0.35, hipL: -0.2, hipR: -0.2, bodyY: -0.05 };
    case 'clean': return { ...POSE0, torsoPitch: 0.2, shoulderR: -1.3 + c(t * 6) * 0.25, armSpread: 0.25 + s(t * 6) * 0.3 };
    case 'tend':
    case 'sample': // kneel to collect (Artemis-era suits are designed to kneel; Apollo crews used tongs)
      return { ...POSE0, bodyY: -0.32, hipL: -1.2, kneeL: 1.6, hipR: 0.15, kneeR: 1.35, torsoPitch: 0.3, shoulderR: -0.9 + w * 0.2, elbowR: -0.6, headPitch: 0.35 };
    case 'drill': return { ...POSE0, bodyY: -0.12, kneeL: 0.6, kneeR: 0.6, hipL: -0.35, hipR: -0.35, torsoPitch: 0.35, shoulderL: -0.95 + s(t * 40) * 0.03, shoulderR: -0.95 + s(t * 40) * 0.03 };
    case 'scan': return { ...POSE0, torsoPitch: 0.25, shoulderR: -1.2 + s(t * 2) * 0.15, armSpread: 0.3 + s(t * 1.3) * 0.25, headPitch: 0.35 };
    default: return { ...POSE0, torsoPitch: 0.3, shoulderL: -1 + w * 0.15, shoulderR: -1 - w * 0.15, elbowL: -0.6, elbowR: -0.6 };
  }
}

export function idlePose(t, reducedMotion = false) {
  return { ...POSE0, bodyY: reducedMotion ? 0 : s(t * 1.8) * 0.006, shoulderL: s(t * 0.9) * 0.04, shoulderR: -s(t * 0.9) * 0.04, headYaw: s(t * 0.35) * 0.4 };
}

export const FALL_SECONDS = 2.6;

// Fall and recover: pitch forward onto the hands, pause, push back up (Apollo 16/17 style).
export function fallPose(t) {
  const k = Math.min(1, t / FALL_SECONDS);
  const down = k < 0.25 ? k / 0.25 : k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
  const e = down * down * (3 - 2 * down);
  return { ...POSE0, torsoPitch: e * 1.15, bodyY: -e * 0.55, hipL: -e * 0.9, hipR: -e * 0.7, kneeL: e * 1.4, kneeR: e * 1.2, shoulderL: -e * 1.5, shoulderR: -e * 1.5, elbowL: -0.1, elbowR: -0.1 };
}

// Smoothly blends two poses (cross-fades between gaits, work and falls).
export function blendPose(a, b, k) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * k;
  return out;
}

// Chance per second of stumbling: only when moving fast in low gravity.
export const fallChancePerSecond = (gravity, speed) => (gravity < 0.25 && speed > 2.6 ? 0.012 * (speed - 2.6) : 0);
