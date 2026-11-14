// Landing cutscene: the lander descends on its engine, kicks up dust, then the camera swoops to the astronaut.
import * as THREE from 'three';
import { LANDER_POS } from './world.js';

const DESCENT = 6.5;
const SETTLE = 2;
const SWOOP = 2.6;
const TOTAL = DESCENT + SETTLE + SWOOP;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function playIntro({ world, rig, hud, audio, title, reducedMotion, getPlayerFocus, onDone }) {
  const p = world.parts;
  const lander = p.lander;
  const ground = p.heightAt(LANDER_POS.x, LANDER_POS.z);
  let t = reducedMotion ? DESCENT : 0;
  let dustT = 0;
  let finished = false;
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const startPos = new THREE.Vector3();
  const startLook = new THREE.Vector3();
  const end = new THREE.Vector3();
  const endLook = new THREE.Vector3();
  hud.setCinematic(true);
  audio.sfx.engine();

  function finish() {
    if (finished) return;
    finished = true;
    lander.group.position.y = ground;
    lander.flame.visible = false;
    rig.setOverride(null);
    hud.setCinematic(false);
    hud.setTitle(null);
    onDone();
  }

  rig.setOverride((camera, dt) => {
    t += dt;
    const fall = Math.min(1, t / DESCENT);
    const h = (1 - fall) ** 2 * 70; // decelerating descent, gentle touchdown
    lander.group.position.y = ground + h;
    lander.flame.visible = t < DESCENT;
    lander.flame.scale.setScalar(0.8 + Math.random() * 0.4);
    if (t < DESCENT + 0.5 && h < 14) {
      dustT -= dt;
      if (dustT <= 0) {
        p.particles.dustCloud({ x: LANDER_POS.x, y: ground, z: LANDER_POS.z }, { count: 14, speed: 9 - h * 0.4, radius: 1.5 });
        dustT = 0.06;
      }
    }
    if (t < DESCENT + SETTLE) {
      const a = 0.9 + t * 0.12;
      const r = 26 - t * 0.9;
      camPos.set(LANDER_POS.x + Math.sin(a) * r, ground + 6 + h * 0.35, LANDER_POS.z + Math.cos(a) * r);
      look.set(LANDER_POS.x, lander.group.position.y + 2, LANDER_POS.z);
      camera.position.copy(camPos);
      camera.lookAt(look);
      startPos.copy(camPos);
      startLook.copy(look);
      if (t > DESCENT && t - dt <= DESCENT && title) hud.setTitle(title);
    } else {
      const k = ease(Math.min(1, (t - DESCENT - SETTLE) / SWOOP));
      const f = getPlayerFocus();
      end.set(f.x + Math.sin(0.35) * 7, f.y + 3.2, f.z + Math.cos(0.35) * 7);
      endLook.set(f.x, f.y + 1.3, f.z);
      camera.position.lerpVectors(startPos, end, k);
      camera.position.y += Math.sin(k * Math.PI) * 6;
      look.lerpVectors(startLook, endLook, k);
      camera.lookAt(look);
      if (k > 0.3) hud.setTitle(null);
    }
    if (t >= TOTAL) finish();
  });

  return { skip: finish, get done() { return finished; } };
}
