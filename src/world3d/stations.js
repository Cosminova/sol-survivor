// Builds every station mesh from the layout and keeps visuals in sync with mission state.
import * as THREE from 'three';
import { buildHabitat } from './meshes/habitat.js';
import { buildSolar, buildBattery, buildFission } from './meshes/power.js';
import { buildGreenhouse, buildIsru, buildIceDrill, buildShelter } from './meshes/life.js';
import { buildRover, buildRelay, buildSpares, buildBermPile, buildOutcrop } from './meshes/misc.js';
import { beacon } from './meshes/kit.js';
import { isBroken, isDisabled } from './actions.js';

function builderFor(station, opts) {
  switch (station.kind) {
    case 'habitat': return buildHabitat(opts);
    case 'solar': return buildSolar(station, opts);
    case 'battery': return buildBattery(station);
    case 'fission': return buildFission(station);
    case 'greenhouse': return buildGreenhouse(station, opts);
    case 'recycler': case 'oxygen': case 'moxie': case 'regolithO2': return buildIsru(station);
    case 'iceDrill': return buildIceDrill(station);
    case 'shelter': return buildShelter(station, opts);
    case 'rover': return buildRover();
    case 'relay': return buildRelay();
    case 'spares': return buildSpares();
    case 'berm': return buildBermPile(station, opts);
    case 'outcrop': return buildOutcrop(station, opts);
    default: return { group: new THREE.Group(), update: () => {} };
  }
}

export function createStations({ layout, body, site, heightAt, high }) {
  const group = new THREE.Group();
  const opts = { body, high, lat: site?.lat ?? 0 };
  const items = layout.stations.map((station) => {
    const built = builderFor(station, opts);
    built.group.position.set(station.x, heightAt(station.x, station.z), station.z);
    if (['berm', 'outcrop', 'spares', 'relay', 'rover'].includes(station.kind)) built.group.rotation.y = station.angle + Math.PI;
    group.add(built.group);
    const warn = beacon();
    warn.position.set(0, station.kind === 'habitat' ? 5 : 2.2, 0);
    built.group.add(warn);
    return { station, built, warn };
  });

  const sampledToday = new Set();

  // ctx: { mission, sunDir, night, time, dt, damaged }
  function update({ mission, sunDir, night, time, dt, damaged = {} }) {
    const blink = Math.sin(time * 8) > 0;
    for (const { station, built, warn } of items) {
      const broken = isBroken(mission, station.moduleId) || damaged[station.moduleId] != null;
      const disabled = isDisabled(mission, station.moduleId);
      warn.visible = broken;
      if (broken) warn.userData.bulb.visible = blink;
      built.update({
        mission,
        dust: mission.env?.dust ?? 0,
        growth: mission.greenhouse?.growth ?? 0,
        shieldLevel: mission.shield?.level ?? 0,
        shieldWork: mission.shield?.work ?? 0,
        sunAzimuth: Math.atan2(-sunDir.x, -sunDir.z),
        night,
        time,
        dt,
        broken,
        disabled,
        sampled: sampledToday.has(station.id),
      });
    }
  }

  const find = (id) => items.find((i) => i.station.id === id) ?? null;

  return {
    group,
    items,
    update,
    find,
    markSampled: (id) => sampledToday.add(id),
    resetDay: () => sampledToday.clear(),
    wipePanel(index, amount) { find('solar')?.built.wipe?.(index, amount); },
    // World position of a station's mesh group (for sparks and floating text).
    anchor(id, y = 2) {
      const it = find(id);
      return it ? new THREE.Vector3(it.station.x, it.built.group.position.y + y, it.station.z) : null;
    },
  };
}
