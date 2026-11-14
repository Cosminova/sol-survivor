// Hidden artifacts scattered on the terrain each sol: meteorites, mission patches and rover parts.
import { buildCollectible } from './meshes/misc.js';
import { scatterPoints } from './layout.js';
import { remainingCollectibles } from './progression.js';
import { hashString } from './rng.js';
import { disposeTree } from './meshes/kit.js';

export const PICKUP_RANGE = 1.5;

export function createCollectibles({ parent, layout, heightAt, body }) {
  let items = [];

  function clear() {
    for (const it of items) { parent.remove(it.built.group); disposeTree(it.built.group); }
    items = [];
  }

  function spawn({ code, sol, collected }) {
    clear();
    const pool = remainingCollectibles(body, collected);
    if (!pool.length) return;
    const n = Math.min(3, pool.length);
    const points = scatterPoints(layout, hashString(`${code}:${sol}:artifacts`), n, { minDist: 16, maxDist: 75 });
    items = points.map((p, i) => {
      const def = pool[(sol + i) % pool.length];
      const built = buildCollectible(def.kind);
      built.group.position.set(p.x, heightAt(p.x, p.z), p.z);
      parent.add(built.group);
      return { def, x: p.x, z: p.z, built };
    });
    items = items.filter((it, i, arr) => arr.findIndex((o) => o.def.id === it.def.id) === i);
  }

  // Returns the collectible picked up this frame, if any.
  function update(time, player) {
    let picked = null;
    for (const it of items) {
      it.built.update({ time });
      if (!picked && Math.hypot(it.x - player.x, it.z - player.z) < PICKUP_RANGE) picked = it;
    }
    if (picked) {
      parent.remove(picked.built.group);
      disposeTree(picked.built.group);
      items = items.filter((it) => it !== picked);
    }
    return picked?.def ?? null;
  }

  return {
    spawn,
    update,
    positions: () => items.map((it) => ({ x: it.x, z: it.z })),
    dispose: clear,
  };
}
