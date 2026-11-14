// Pure hazard schedule for one sol, seeded by mission code + sol so it replays identically.
// `at` is a fraction of the playable day; `lead` is real seconds of warning before it starts.
import { makeRng, hashString } from './rng.js';

const BREAKABLE_KINDS = ['solar', 'battery', 'recycler', 'oxygen', 'moxie', 'regolithO2', 'iceDrill', 'greenhouse', 'relay', 'rover', 'fission'];

export function hazardSeed(code, sol) {
  return hashString(`${code ?? 'SOL'}#${sol ?? 0}#hazards`);
}

export function scheduleHazards(mission, tuning) {
  const rng = makeRng(hazardSeed(mission.code, mission.sol));
  const body = mission.config?.body ?? 'mars';
  const rate = tuning?.hazardRate ?? 1;
  const env = mission.env ?? {};
  const list = [];

  // Solar particle events only come from the real DONKI replay (mission.today.sep).
  const sep = mission.today?.sep;
  if (sep) {
    list.push({ id: 'sep', type: 'sepStorm', at: rng.range(0.32, 0.5), lead: tuning?.stormLead ?? 35, duration: 0.12, severity: sep.severity ?? 'minor' });
  }

  if (body === 'moon' && env.lit === false) {
    list.push({ id: 'cold', type: 'lunarNight', at: 0, lead: 0, duration: 1 });
  }

  if (body === 'mars') {
    const stormy = Boolean(env.storm) || (env.tau ?? 0) >= 2;
    if (stormy) {
      list.push({ id: 'storm', type: 'dustStormActive', at: 0, lead: 0, duration: 1 });
    } else if (rng.chance(Math.min(0.5, (env.stormChance ?? 0.01) * 5 * rate + 0.04 * rate))) {
      list.push({ id: 'storm', type: 'dustStorm', at: rng.range(0.45, 0.7), lead: 25, duration: 1 });
    }
    // Dust devils peak in the early afternoon when the ground is warmest.
    const devils = rng.chance(0.7 * rate) ? (rng.chance(0.35 * rate) ? 2 : 1) : 0;
    for (let i = 0; i < devils; i += 1) {
      list.push({ id: `devil${i}`, type: 'dustDevil', at: rng.range(0.35, 0.72), lead: 6, duration: 0.14, seed: rng.int(1, 1e6) });
    }
  }

  const candidates = BREAKABLE_KINDS.filter((id) => (mission.modules?.[id] ?? 0) > (mission.broken?.[id] ?? 0));
  if (candidates.length && rng.chance(Math.min(0.6, 0.22 * rate))) {
    list.push({ id: 'meteor', type: 'micrometeoroid', at: rng.range(0.2, 0.65), lead: 4, duration: 0, moduleId: rng.pick(candidates) });
  }

  return list.sort((a, b) => a.at - b.at);
}

// Status of a hazard at a given elapsed time (seconds).
export function hazardPhase(hazard, elapsed, daySeconds) {
  const start = hazard.at * daySeconds;
  const end = start + hazard.duration * daySeconds;
  if (elapsed < start - hazard.lead) return 'pending';
  if (elapsed < start) return 'warning';
  if (hazard.duration > 0 && elapsed < end) return 'active';
  return hazard.duration > 0 ? 'done' : 'active';
}
