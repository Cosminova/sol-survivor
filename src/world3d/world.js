// Assembles the outpost world (terrain, sky, stations, crew, effects) and drives lighting each frame.
import * as THREE from 'three';
import { buildLayout, padsFor, layoutSignature } from './layout.js';
import { makeHeightfield } from './heightfield.js';
import { createTerrain } from './terrain.js';
import { createSky, skyLook, worldSkyLook } from './sky.js';
import { lookForMission, starDirection, parentDirection } from '../render/worldLook.js';
import { makeSurface } from '../render/relief.js';
import { createStations } from './stations.js';
import { createCrew } from './npc.js';
import { createCollectibles } from './collectibles.js';
import { createParticles } from './particles.js';
import { createHazardFx } from './hazardFx.js';
import { buildLander } from './meshes/habitat.js';
import { sunDirection, earthDirection } from './gameLogic.js';
import { disposeTree, disposeKit } from './meshes/kit.js';
import { disposeSuitTemplate } from './suitModel.js';
import { STATION_INFO } from './facts.js';

export const LANDER_POS = { x: 3, z: 21 };
const OUTCROP_PAD_R = 3; // keeps rock outcrops on dry, level ground on worlds with pools

export function createWorld(stage, { high, reducedMotion, labels }) {
  const root = new THREE.Group();
  stage.scene.add(root);
  let parts = null;
  let signature = '';
  const assets = { dem: new Map(), suitTemplate: null };
  let bakeTimer = 0;
  let clock = 0;
  const tmpFocus = new THREE.Vector3();

  function teardown() {
    if (!parts) return;
    parts.crew.dispose();
    parts.collectibles.dispose();
    parts.stationLabels.forEach((l) => l.remove());
    parts.terrain.dispose();
    parts.particles.dispose();
    parts.hazards.dispose();
    parts.sky.dispose();
    root.remove(parts.group);
    stage.scene.remove(parts.sky.group);
    disposeTree(parts.group);
    disposeTree(parts.sky.group);
    parts = null;
  }

  function signatureFor(mission) {
    const dem = assets.dem.get(mission.config?.siteId);
    return `${layoutSignature(mission)}|${mission.config?.worldId ?? ''}|${dem ? 'dem' : 'proc'}|${assets.suitTemplate ? 'suit' : 'prim'}`;
  }

  function build(mission) {
    teardown();
    const body = mission.config?.body ?? 'mars';
    const layout = buildLayout(mission);
    const pads = [...padsFor(layout), { x: LANDER_POS.x, z: LANDER_POS.z, r: 4 }];
    const dem = assets.dem.get(mission.config?.siteId) ?? null;
    // Worlds other than the Moon and Mars have no lidar: their ground, sky and particles come from the world look.
    const look = lookForMission(mission);
    const lookPads = look ? [...pads, ...layout.stations.filter((s) => s.kind === 'outcrop').map((s) => ({ x: s.x, z: s.z, r: OUTCROP_PAD_R }))] : pads;
    const heightfield = look ? makeSurface(look, { pads: lookPads }) : makeHeightfield({ seed: layout.seed, body, pads, dem });
    const heightAt = heightfield.heightAt;
    const group = new THREE.Group();
    root.add(group);
    const terrain = createTerrain({ body, site: mission.site, heightfield, layout, high, look });
    group.add(terrain.group);
    const stations = createStations({ layout, body, site: mission.site, heightAt, high });
    group.add(stations.group);
    const lander = buildLander({ high });
    lander.group.position.set(LANDER_POS.x, heightAt(LANDER_POS.x, LANDER_POS.z), LANDER_POS.z);
    lander.group.rotation.y = 0.6;
    group.add(lander.group);
    const colliders = [...layout.colliders, ...terrain.rockColliders, { x: LANDER_POS.x, z: LANDER_POS.z, r: 2.3 }];
    const crew = createCrew({ parent: group, layout, heightAt, colliders, high, labels, suitTemplate: high ? assets.suitTemplate : null });
    crew.sync(mission);
    const collectibles = createCollectibles({ parent: group, layout, heightAt, body });
    const particles = createParticles({ body, high, reducedMotion, look, surface: look ? heightfield : null });
    group.add(particles.group);
    const hazards = createHazardFx({ body, high, heightAt, look });
    group.add(hazards.group);
    const sky = createSky({ body, high, look });
    stage.scene.add(sky.group);
    const parentDir = look?.parent ? parentDirection(mission.site) : null;
    if (parentDir) sky.setEarthDirection(parentDir);
    else if (body === 'moon') sky.setEarthDirection(earthDirection(mission.site));
    const stationLabels = layout.stations.filter((s) => s.kind !== 'habitat').map((s) => {
      const it = stations.find(s.id);
      const lab = labels.add(it.built.group, { y: s.kind === 'fission' ? 5 : 3.2, className: 'w3d-st', text: `${STATION_INFO[s.kind]?.icon ?? ''} ${STATION_INFO[s.kind]?.name ?? s.kind}` });
      return Object.assign(lab, { station: s });
    });
    parts = { body, look, parentDir, layout, heightfield, heightAt, terrain, stations, lander, colliders, crew, collectibles, particles, hazards, sky, group, stationLabels, dem };
    signature = signatureFor(mission);
    bakeTimer = 0;
    return parts;
  }

  function ensure(mission) {
    if (!parts || signatureFor(mission) !== signature) build(mission);
    return parts;
  }

  // Applies sun, sky, fog and exposure for the current moment. Returns lighting facts for gameplay.
  function updateEnvironment({ mission, t, stormActive, flash = 0, focus, dt }) {
    const p = parts;
    const lit = mission.env?.lit !== false;
    const tau = mission.env?.tau ?? 0.5;
    const sun = p.look ? starDirection(p.look, mission.site, t, lit) : sunDirection(mission, t);
    const look = p.look
      ? worldSkyLook(p.look, { sunElevDeg: sun.elevationDeg, tau, lit, stormActive })
      : skyLook({ body: p.body, sunElev: sun.elevationDeg, tau, lit, stormActive });
    clock += dt;
    p.terrain.update(clock);
    p.sky.apply(look, sun, flash);
    p.sky.follow(stage.camera.position);
    stage.sun.color.copy(look.sunColor);
    stage.sun.intensity = look.sunIntensity;
    stage.hemi.color.copy(look.hemiSky);
    stage.hemi.groundColor.copy(look.hemiGround);
    stage.hemi.intensity = look.hemiIntensity;
    stage.fill.intensity = look.fill;
    stage.fill.color.copy(look.fillColor);
    if (p.parentDir) {
      stage.fill.position.set(p.parentDir.x * 100, p.parentDir.y * 100, p.parentDir.z * 100);
    } else if (p.body === 'moon') {
      const e = earthDirection(mission.site);
      stage.fill.position.set(e.x * 100, e.y * 100, e.z * 100);
    } else {
      stage.fill.position.set(0, 100, 0);
    }
    stage.scene.fog.color.copy(look.fogColor);
    stage.scene.fog.density = look.fogDensity;
    stage.renderer.toneMappingExposure = look.exposure;
    stage.aimSun(sun, tmpFocus.set(focus.x, 0, focus.z));
    p.particles.setMoteDensity(stormActive ? 1 : Math.min(1, tau / 3));
    bakeTimer -= dt;
    if (bakeTimer <= 0) {
      p.sky.bakeInto(stage);
      bakeTimer = high ? 4 : 10;
    }
    const night = sun.elevationDeg < 2 || look.sunIntensity < 0.4;
    stage.lamp.position.set(focus.x, (focus.y ?? 0) + 2.8, focus.z);
    stage.lamp.intensity = night ? 3 : 0;
    return { sun, look, night };
  }

  return {
    ensure,
    build,
    updateEnvironment,
    setDem(siteId, dem) { if (dem) assets.dem.set(siteId, dem); },
    setSuitTemplate(t) { assets.suitTemplate = t; },
    get parts() { return parts; },
    dispose() {
      teardown();
      stage.scene.remove(root);
      disposeSuitTemplate(assets.suitTemplate);
      disposeKit();
    },
  };
}
