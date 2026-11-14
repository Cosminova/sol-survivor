// Pure NPC targeting, steering and circle collision against outpost structures.
import { AIRLOCK, WORLD_LIMIT } from './layout.js';
import { stationForTask, isBroken } from './actions.js';

export const BODY_RADIUS = 0.45;

// Where an NPC astronaut should be for their engine task; resting crew go inside the habitat.
export function npcTarget(crew, layout, mission, { index = 0, recall = false, damaged = {} } = {}) {
  const inside = { x: AIRLOCK.x, z: AIRLOCK.z - 0.6, inside: true, stationId: 'habitat' };
  if (recall || crew.task === 'rest' || crew.health <= 0) return inside;
  const kinds = stationForTask(crew.task);
  const options = layout.stations.filter((s) => kinds.includes(s.kind) && s.kind !== 'habitat');
  if (!options.length) return inside;
  let station = options[0];
  if (crew.task === 'maintain') {
    station = options.find((s) => isBroken(mission, s.moduleId) || damaged[s.moduleId] != null)
      ?? options.find((s) => s.kind === 'solar') ?? options[0];
  } else if (crew.task === 'science') {
    const rocks = options.filter((s) => s.kind === 'outcrop');
    station = rocks.length ? rocks[index % rocks.length] : options[0];
  }
  const spot = station.spots[index % station.spots.length];
  const jitter = ((index % 3) - 1) * 0.9;
  return { x: spot.x + jitter, z: spot.z + jitter * 0.5, inside: false, stationId: station.id };
}

// Pushes a point out of every collider circle and keeps it inside the world.
export function resolveCollisions(pos, colliders, radius = BODY_RADIUS) {
  let { x, z } = pos;
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + radius;
    if (d < min) {
      const k = d > 1e-6 ? min / d : 1;
      x = d > 1e-6 ? c.x + dx * k : c.x + min;
      z = d > 1e-6 ? c.z + dz * k : c.z;
    }
  }
  const r = Math.hypot(x, z);
  if (r > WORLD_LIMIT) {
    x *= WORLD_LIMIT / r;
    z *= WORLD_LIMIT / r;
  }
  return { x, z };
}

// One steering step towards a target, sliding around obstacles in the way.
export function steer(pos, target, colliders, { speed = 2.2, dt = 1 / 60, arriveDist = 0.35 } = {}) {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= arriveDist) return { x: pos.x, z: pos.z, heading: null, arrived: true, moving: false };
  const ux = dx / dist;
  const uz = dz / dist;
  let vx = ux;
  let vz = uz;
  for (const c of colliders) {
    const ox = c.x - pos.x;
    const oz = c.z - pos.z;
    const ahead = ox * ux + oz * uz;
    if (ahead <= 0 || ahead > Math.min(dist, c.r + 3)) continue;
    const lateral = ox * uz - oz * ux; // > 0: obstacle is to the right of the path
    const clearance = c.r + BODY_RADIUS + 0.4;
    if (Math.abs(lateral) < clearance) {
      const side = lateral >= 0 ? 1 : -1;
      const w = 1 - Math.abs(lateral) / clearance;
      // Perpendicular (-uz, ux) points left of the path; dodge away from the obstacle.
      vx += -uz * side * w * 1.6;
      vz += ux * side * w * 1.6;
    }
  }
  const n = Math.hypot(vx, vz) || 1;
  const step = Math.min(dist, speed * dt);
  const moved = resolveCollisions({ x: pos.x + (vx / n) * step, z: pos.z + (vz / n) * step }, colliders);
  return { ...moved, heading: Math.atan2(vx, vz), arrived: false, moving: true };
}

export function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
