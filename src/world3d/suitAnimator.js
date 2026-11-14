// Drives any astronaut rig (primitive or the NASA EMU model) from the pure poses in gaits.js,
// cross-fading between gaits, work loops and the fall-and-recover sequence.
import { selectGait, gaitParams, locomotionPose, footStrikes, workPose, idlePose, fallPose, blendPose, FALL_SECONDS } from './gaits.js';

// joints: { body, torso, head, armL: { root, joint }, armR, legL, legR, armRest: { L, R }, armRestX }
export function applyPose(joints, p) {
  joints.body.position.y = p.bodyY ?? 0;
  joints.torso.rotation.x = p.torsoPitch ?? 0;
  joints.head.rotation.set(p.headPitch ?? 0, p.headYaw ?? 0, 0);
  joints.legL.root.rotation.set(-(p.hipL ?? 0), 0, 0);
  joints.legR.root.rotation.set(-(p.hipR ?? 0), 0, 0);
  joints.legL.joint.rotation.set(p.kneeL ?? 0, 0, 0);
  joints.legR.joint.rotation.set(p.kneeR ?? 0, 0, 0);
  const restX = joints.armRestX ?? 0;
  joints.armL.root.rotation.set((p.shoulderL ?? 0) + restX, 0, (joints.armRest?.L ?? 0) + (p.armSpread ?? 0));
  joints.armR.root.rotation.set((p.shoulderR ?? 0) + restX, 0, (joints.armRest?.R ?? 0) - (p.armSpread ?? 0));
  joints.armL.joint.rotation.set(p.elbowL ?? 0, 0, 0);
  joints.armR.joint.rotation.set(p.elbowR ?? 0, 0, 0);
}

export function createAnimator(joints) {
  let phase = 0;
  let t = Math.random() * 10;
  let workT = 0;
  let fallT = -1;
  let current = idlePose(0);
  let gait = 'idle';

  // state: { speed, gravity, work, reducedMotion, fall } -> returns true on a foot strike.
  function animate(dt, { speed = 0, gravity = 0.38, work = null, reducedMotion = false, fall = false } = {}) {
    t += dt;
    if (fall && fallT < 0) fallT = 0;
    let target;
    let strike = false;
    if (fallT >= 0) {
      fallT += dt;
      target = fallPose(fallT);
      if (fallT >= FALL_SECONDS) fallT = -1;
    } else if (speed > 0.12) {
      gait = selectGait(gravity, speed);
      const params = gaitParams(gait, gravity, speed);
      const prev = phase;
      phase += params.cadence * dt;
      strike = footStrikes(params, prev, phase) > 0;
      target = locomotionPose(params, phase);
      if (reducedMotion) target.bodyY *= 0.4;
      workT = 0;
    } else if (work) {
      gait = 'work';
      workT += dt;
      target = workPose(work, workT);
    } else {
      gait = 'idle';
      target = idlePose(t, reducedMotion);
    }
    current = blendPose(current, target, Math.min(1, dt * 16));
    applyPose(joints, current);
    return strike;
  }

  return { animate, get gait() { return gait; }, get falling() { return fallT >= 0; } };
}
