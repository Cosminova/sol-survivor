// Third-person follow camera with orbit, zoom, ground/structure collision, shake and cinematic override.
import * as THREE from 'three';

const CLEARANCE = 0.6; // metres the camera always keeps above the ground under it

export function createFollowCamera(camera, { heightAt, colliders, reducedMotion }) {
  let yaw = 0.35;
  let pitch = 0.32;
  let dist = 8;
  let shake = 0;
  let override = null;
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let first = true;

  function offsetFor(d) {
    return tmp.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  }

  // Shortens the boom if a structure would block the view of the player.
  function clearDistance(focus) {
    let d = dist;
    for (let k = 0; k < 6; k += 1) {
      const p = offsetFor(d).add(focus);
      const blocked = colliders.some((c) => p.y < 7 && Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.4);
      if (!blocked) break;
      d *= 0.75;
    }
    return Math.max(2.2, d);
  }

  function update(dt, focus, input = {}) {
    if (override) {
      override(camera, dt);
      return;
    }
    yaw -= (input.dx ?? 0) * 0.005;
    pitch = Math.min(1.25, Math.max(0.05, pitch + (input.dy ?? 0) * 0.004));
    dist = Math.min(18, Math.max(3.2, dist + (input.zoom ?? 0) * 0.8));
    const k = first ? 1 : 1 - Math.exp(-dt * 8);
    target.lerp(tmp.set(focus.x, focus.y + 1.35, focus.z), k);
    desired.copy(offsetFor(clearDistance(target))).add(target);
    const ground = heightAt(desired.x, desired.z) + CLEARANCE;
    if (desired.y < ground) desired.y = ground;
    camera.position.lerp(desired, first ? 1 : 1 - Math.exp(-dt * 10));
    first = false;
    if (shake > 0 && !reducedMotion) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 1.6);
    }
    const floor = heightAt(camera.position.x, camera.position.z) + CLEARANCE;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(target);
  }

  return {
    update,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    // Ground-plane basis for camera-relative movement.
    basis: () => ({ fx: -Math.sin(yaw), fz: -Math.cos(yaw), rx: Math.cos(yaw), rz: -Math.sin(yaw) }),
    shake(amount) { if (!reducedMotion) shake = Math.max(shake, amount); },
    setOverride(fn) { override = fn; if (!fn) first = true; },
    lookBehind(heading) { yaw = heading + Math.PI; },
    setYaw(v) { yaw = v; first = true; },
    setColliders(list) { colliders = list; },
  };
}
