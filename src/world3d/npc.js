// Crew astronauts. The player's astronaut is moved by player.js; the rest walk to the station
// matching their engine task and loop a work animation, or head inside to rest.
import { buildAstronaut } from './astronaut.js';
import { buildSuitAstronaut } from './suitModel.js';
import { npcTarget, steer, resolveCollisions } from './npcLogic.js';
import { AIRLOCK } from './layout.js';
import { ROLE_COLORS } from './facts.js';
import { TASKS } from '../engine/sim.js';
import { disposeTree } from './meshes/kit.js';

function workVerb(task, stationId) {
  if (task === 'science') return 'sample';
  if (task === 'shield') return 'shield';
  if (task === 'greenhouse') return 'tend';
  if (task === 'maintain') return stationId === 'solar' ? 'clean' : 'repair';
  return null;
}

export function createCrew({ parent, layout, heightAt, colliders, high, labels, suitTemplate = null }) {
  const members = new Map();

  function spawn(crew, index) {
    const opts = { name: crew.name, role: crew.role, high };
    const astro = suitTemplate ? buildSuitAstronaut(suitTemplate, opts) : buildAstronaut(opts);
    parent.add(astro.root);
    const angle = (index / 4) * Math.PI - Math.PI / 2;
    const pos = { x: AIRLOCK.x + Math.sin(angle) * 1.6, z: AIRLOCK.z + 1 + Math.cos(angle) * 0.6 };
    const label = labels.add(astro.root, { y: 2.25, text: '' });
    const m = { crew, index, astro, pos, heading: 0, inside: false, alpha: 1, label, target: null, verb: null, speed: 0 };
    members.set(crew.id, m);
    return m;
  }

  function sync(mission) {
    const ids = new Set(mission.crew.map((c) => c.id));
    for (const [id, m] of members) {
      if (!ids.has(id)) {
        m.label.remove();
        parent.remove(m.astro.root);
        disposeTree(m.astro.root);
        m.astro.dispose();
        members.delete(id);
      }
    }
    mission.crew.forEach((c, i) => {
      const m = members.get(c.id) ?? spawn(c, i);
      m.crew = c;
      m.index = i;
    });
  }

  function place(m) {
    m.astro.root.position.set(m.pos.x, heightAt(m.pos.x, m.pos.z), m.pos.z);
    m.astro.root.rotation.y = m.heading;
  }

  // Moves an astronaut out through the airlock (used when the player takes control of someone inside).
  function bringOutside(m) {
    if (!m.inside && m.alpha > 0.5) return;
    m.inside = false;
    m.alpha = 1;
    m.pos = resolveCollisions({ x: AIRLOCK.x + (m.index - 1.5) * 0.7, z: AIRLOCK.z + 0.8 }, colliders);
    m.heading = 0;
    m.astro.setOpacity(1);
    place(m);
  }

  // ctx: { dt, mission, playerId, recall, damaged, gravity, reducedMotion, night }
  function update({ dt, mission, playerId, recall, damaged, gravity, reducedMotion, night }) {
    for (const m of members.values()) {
      const tag = `${m.crew.name.split(' ')[0]} ${TASKS[m.crew.task]?.icon ?? ''}`;
      m.label.set(m.crew.id === playerId ? `★ ${tag}` : tag);
      m.label.show(m.alpha > 0.3);
      if (m.crew.id === playerId) continue;
      const target = npcTarget(m.crew, layout, mission, { index: m.index, recall, damaged });
      m.target = target;
      if (m.inside && !target.inside) {
        m.inside = false;
        m.pos = { x: AIRLOCK.x, z: AIRLOCK.z + 0.4 };
      }
      let moving = false;
      if (!m.inside) {
        const r = steer(m.pos, target, colliders, { speed: 2.1, dt });
        if (r.moving) {
          m.pos = { x: r.x, z: r.z };
          m.heading += Math.atan2(Math.sin(r.heading - m.heading), Math.cos(r.heading - m.heading)) * Math.min(1, dt * 8);
          moving = true;
        } else if (!target.inside) {
          const st = layout.stations.find((s) => s.id === target.stationId);
          if (st) m.heading = Math.atan2(st.x - m.pos.x, st.z - m.pos.z);
        }
        if (r.arrived && target.inside) {
          m.alpha = Math.max(0, m.alpha - dt * 1.5);
          if (m.alpha <= 0) m.inside = true;
        } else {
          m.alpha = Math.min(1, m.alpha + dt * 2);
        }
      }
      m.speed = moving ? 2.1 : 0;
      m.verb = !moving && !target.inside ? workVerb(m.crew.task, target.stationId) : null;
      m.astro.setOpacity(m.inside ? 0 : m.alpha);
      m.astro.animate(dt, { speed: m.speed, gravity, work: m.verb, reducedMotion, lamps: night });
      place(m);
    }
  }

  return {
    sync,
    update,
    place,
    bringOutside,
    get: (id) => members.get(id) ?? null,
    all: () => [...members.values()],
    dispose() {
      for (const m of members.values()) {
        m.label.remove();
        parent.remove(m.astro.root);
        disposeTree(m.astro.root);
        m.astro.dispose();
      }
      members.clear();
    },
  };
}

export const npcColor = (role) => ROLE_COLORS[role] ?? '#888';
