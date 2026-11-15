// Demo autopilot for Walk 3D: lets the hands-free demo tour (src/ui/demo/demoTour.js) walk the astronaut to a
// station and start a job, through the same input the keyboard gives. Nothing here runs unless the demo asks.
import { INTERACT_RANGE } from './layout.js';
import { interact } from './interaction.js';

const ARRIVE_DISTANCE = INTERACT_RANGE * 0.6; // close enough that the station's E prompt is showing
const WALK_TIMEOUT_MS = 15000;
const STUCK_SECONDS = 2.5; // no progress for this long (blocked by a wall) counts as stuck

/**
 * @param {object} rt  the Walk 3D runtime bag (player, rig, world, modals, introPlaying...)
 * @returns {{ steer(input: object, dt: number): object, api: object }}
 */
export function createDemoPilot(rt) {
  let target = null; // { x, z, stop, resolve, best, stuckFor, timer }

  function settle(reached) {
    if (!target) return;
    const { resolve, timer } = target;
    clearTimeout(timer);
    target = null;
    resolve(reached);
  }

  // Replaces keyboard input while a walk is in progress: a camera-relative push straight at the target.
  function steer(input, dt) {
    if (!target) return input;
    const pos = rt.player.position();
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= target.stop) { settle(true); return { ...input, x: 0, y: 0, run: false }; }
    if (dist < target.best - 0.05) { target.best = dist; target.stuckFor = 0; } else target.stuckFor += dt;
    if (target.stuckFor > STUCK_SECONDS) { settle(false); return { ...input, x: 0, y: 0, run: false }; }
    const b = rt.rig.basis();
    const ux = dx / dist;
    const uz = dz / dist;
    return { ...input, x: ux * b.rx + uz * b.rz, y: ux * b.fx + uz * b.fz, run: false };
  }

  /** First stand spot of a station of this kind ('solar', 'habitat', ...), or null if the base has none. */
  function spotOf(kind) {
    const station = rt.world.parts?.layout.stations.find((s) => s.kind === kind);
    const spot = station?.spots[0];
    return spot ? { x: spot.x, z: spot.z } : null;
  }

  const api = {
    get busy() { return Boolean(rt.introPlaying || rt.modals.isOpen() || rt.ending); },
    skipIntro() { rt.intro?.skip?.(); },
    spotOf,
    /** Walks to (x, z). Resolves true on arrival, false if blocked or too slow. */
    walkTo(x, z, { stop = ARRIVE_DISTANCE } = {}) {
      settle(false);
      return new Promise((resolve) => {
        target = { x, z, stop, resolve, best: Infinity, stuckFor: 0, timer: setTimeout(() => settle(false), WALK_TIMEOUT_MS) };
      });
    },
    /** Presses E: starts the job (or airlock) at the station the astronaut is standing at. */
    interact() { interact(rt); },
    stop() { settle(false); },
  };

  return { steer, api };
}
