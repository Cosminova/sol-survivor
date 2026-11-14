// The controlled astronaut: camera-relative walking with low-gravity feel, footprints, and rover driving.
import { resolveCollisions } from './npcLogic.js';
import { AIRLOCK } from './layout.js';
import { fallChancePerSecond } from './gaits.js';

const GRAVITY = { mars: 0.38, moon: 0.17 };

export function createPlayer({ world, rig, audio }) {
  let member = null;
  let vel = { x: 0, z: 0 };
  let heading = 0;
  let speed = 0;
  let footSide = 1;
  let rover = null; // { station, built, x, z, heading, speed }
  let hidden = false;

  const parts = () => world.parts;
  const gravity = () => GRAVITY[parts()?.body] ?? 0.38;

  function setMember(m) {
    member = m;
    if (!m) return;
    heading = m.heading;
    vel = { x: 0, z: 0 };
  }

  function teleportToAirlock() {
    if (!member) return;
    member.pos = { x: AIRLOCK.x, z: AIRLOCK.z + 1.2 };
    member.inside = false;
    member.alpha = 1;
    heading = 0;
    member.heading = 0;
    vel = { x: 0, z: 0 };
    hidden = false;
    member.astro.setOpacity(1);
    parts().crew.place(member);
    rig.setYaw(0.45); // camera out front, looking back at the astronaut and the airlock
  }

  function enterRover() {
    const it = parts().stations.find('rover');
    if (!it || !member) return false;
    rover = { station: it.station, built: it.built, x: it.station.x, z: it.station.z, heading: it.built.group.rotation.y, speed: 0 };
    member.astro.setOpacity(0);
    return true;
  }

  function exitRover() {
    if (!rover) return;
    const side = { x: Math.cos(rover.heading) * 2.2, z: -Math.sin(rover.heading) * 2.2 };
    member.pos = resolveCollisions({ x: rover.x + side.x, z: rover.z + side.z }, parts().colliders);
    // The rover's work spot and collider follow it to where it was parked.
    // (The collider object is shared with the world's collider list, so updating it in place moves both.)
    const st = rover.station;
    st.x = rover.x; st.z = rover.z;
    st.spots[0] = { x: rover.x + side.x * 1.1, z: rover.z + side.z * 1.1 };
    Object.assign(st.colliders[0], { x: rover.x, z: rover.z });
    member.astro.setOpacity(1);
    rover = null;
  }

  function updateRover(dt, input) {
    const p = parts();
    rover.speed += (input.y * 7 - rover.speed) * Math.min(1, dt * 1.5);
    rover.heading -= input.x * dt * 1.4 * Math.sign(rover.speed || 1) * Math.min(1, Math.abs(rover.speed) / 2 + 0.2);
    const own = rover.station.colliders[0];
    const others = p.colliders.filter((c) => c !== own);
    const next = resolveCollisions({ x: rover.x + Math.sin(rover.heading) * rover.speed * dt, z: rover.z + Math.cos(rover.heading) * rover.speed * dt }, others, 2);
    const moved = Math.hypot(next.x - rover.x, next.z - rover.z);
    rover.x = next.x; rover.z = next.z;
    rover.built.group.position.set(rover.x, p.heightAt(rover.x, rover.z), rover.z);
    rover.built.group.rotation.y = rover.heading;
    rover.built.spinWheels?.(moved * Math.sign(rover.speed));
    member.pos = { x: rover.x, z: rover.z };
    if (Math.abs(rover.speed) > 2 && Math.random() < dt * 12) p.particles.dustCloud({ x: rover.x, y: p.heightAt(rover.x, rover.z), z: rover.z }, { count: 3, speed: 1.2, radius: 1.2 });
    return { moving: moved > 0.001, distance: moved };
  }

  // input: { x, y, run } in camera space. Returns movement facts for gameplay.
  function update(dt, input, { frozen = false, push = { x: 0, z: 0 }, reducedMotion = false, night = false, work = null }) {
    const p = parts();
    if (!member || !p) return { moving: false };
    if (rover) {
      const r = updateRover(dt, frozen ? { x: 0, y: 0 } : input);
      return { ...r, inRover: true, running: false };
    }
    const b = rig.basis();
    const run = input.run;
    const g = gravity();
    const maxSpeed = (run ? 4.4 : 2.5) * (g < 0.25 ? 0.9 : 1);
    const wish = frozen ? { x: 0, z: 0 } : { x: b.fx * input.y + b.rx * input.x, z: b.fz * input.y + b.rz * input.x };
    // Low gravity means less grip: slower to start and stop, especially on the Moon.
    const grip = g < 0.25 ? 3 : 6;
    vel.x += (wish.x * maxSpeed - vel.x) * Math.min(1, dt * grip) + push.x * dt;
    vel.z += (wish.z * maxSpeed - vel.z) * Math.min(1, dt * grip) + push.z * dt;
    speed = Math.hypot(vel.x, vel.z);
    if (speed > 0.05) {
      const target = Math.atan2(vel.x, vel.z);
      heading += Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) * Math.min(1, dt * 10);
    }
    // Rare stumble when moving fast in low gravity or shoved by a dust devil (Apollo 16/17 crews fell too).
    const shove = Math.hypot(push.x, push.z);
    const fell = !member.astro.falling && !frozen && (Math.random() < fallChancePerSecond(g, speed) * dt || (shove > 3.5 && Math.random() < dt * 0.5));
    if (member.astro.falling || fell) { vel.x *= 0.9; vel.z *= 0.9; }
    member.pos = resolveCollisions({ x: member.pos.x + vel.x * dt, z: member.pos.z + vel.z * dt }, p.colliders);
    member.heading = heading;
    const footDown = member.astro.animate(dt, { speed: member.astro.falling ? 0 : speed, gravity: g, work: speed < 0.2 ? work : null, reducedMotion, lamps: night, fall: fell });
    if (fell) p.particles.dustCloud({ x: member.pos.x, y: p.heightAt(member.pos.x, member.pos.z), z: member.pos.z }, { count: 18, speed: 1.4, radius: 0.4 });
    if (!hidden) member.astro.setOpacity(1);
    p.crew.place(member);
    if (footDown && speed > 0.3) {
      const y = p.heightAt(member.pos.x, member.pos.z);
      p.particles.footprint(member.pos.x, y, member.pos.z, heading, footSide);
      footSide = -footSide;
      audio.sfx.step(g < 0.25);
      if (g < 0.25) p.particles.dustCloud({ x: member.pos.x, y, z: member.pos.z }, { count: 4, speed: 0.9, radius: 0.2 });
    }
    return { moving: speed > 0.2, running: run && speed > 3, inRover: false, fell };
  }

  return {
    setMember,
    update,
    teleportToAirlock,
    enterRover,
    exitRover,
    setHidden(v) { hidden = v; member?.astro.setOpacity(v ? 0 : 1); },
    get hidden() { return hidden; },
    get inRover() { return Boolean(rover); },
    get member() { return member; },
    get heading() { return rover ? rover.heading : heading; },
    position() {
      if (!member) return { x: 0, y: 0, z: 0 };
      const p = parts();
      const x = rover ? rover.x : member.pos.x;
      const z = rover ? rover.z : member.pos.z;
      return { x, y: p.heightAt(x, z) + (rover ? 0.6 : 0), z };
    },
    gravity,
  };
}
