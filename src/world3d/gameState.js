// Pure per-sol game state. stepSol / record* return { state, events } and never mutate.
// The 3D layer turns events into sounds, radio calls, HUD updates and coordinator callbacks.
import { dayClock, suitO2Step, doseRatePerHour, gameHoursPerSecond, O2_LOW, PENALTY, radiationPenalty } from './gameLogic.js';
import { scheduleHazards, hazardPhase } from './hazards.js';
import { generateObjectives, applyObjective, allObjectivesDone, addXp, xpForTask, nextCombo, XP, normalizeProgress } from './progression.js';
import { effectiveShieldLevel } from '../engine/sim.js';

export function createSolState({ mission, tuning, progress, layout, playerId }) {
  const hazards = scheduleHazards(mission, tuning).map((h) => ({ ...h, status: 'pending' }));
  const prog = normalizeProgress(progress);
  return {
    sol: mission.sol,
    body: mission.config?.body ?? 'mars',
    crewIds: (mission.crew ?? []).map((c) => c.id),
    shieldLevel: safeShield(mission),
    tuning,
    elapsed: 0,
    ended: false,
    duskWarned: false,
    nightfallFired: false,
    playerId,
    o2: Object.fromEntries((mission.crew ?? []).map((c) => [c.id, 1])),
    lowWarned: false,
    dose: 0,
    hazards,
    damaged: {},
    cold: hazards.some((h) => h.type === 'lunarNight'),
    stormActive: hazards.some((h) => h.type === 'dustStormActive'),
    sepActive: null,
    objectives: generateObjectives(mission, layout, { seed: layout?.seed ?? 1, hazards, collected: prog.collected }),
    allDoneAwarded: false,
    assigned: [],
    combo: 0,
    progress: prog,
    stats: { tasks: 0, samples: 0, xp: 0, o2Used: 0, collected: 0, qualitySum: 0 },
  };
}

function safeShield(mission) {
  try { return effectiveShieldLevel(mission); } catch { return mission.shield?.level ?? 0; }
}

function grantXp(state, amount, events, reason) {
  const { progress, leveledUp } = addXp(state.progress, amount);
  events.push({ type: 'xp', amount: Math.round(amount), reason });
  if (leveledUp) events.push({ type: 'levelUp', rank: leveledUp });
  return { ...state, progress, stats: { ...state.stats, xp: state.stats.xp + Math.round(amount) } };
}

function completeObjectives(state, verb, amount, events) {
  const { objectives, completed } = applyObjective(state.objectives, verb, amount);
  let next = { ...state, objectives };
  for (const id of completed) {
    events.push({ type: 'objectiveDone', id, label: objectives.find((o) => o.id === id).label });
    next = { ...next, progress: { ...next.progress, objectivesDone: next.progress.objectivesDone + 1 } };
    next = grantXp(next, XP.objective, events, 'objective');
  }
  if (!next.allDoneAwarded && allObjectivesDone(next.objectives)) {
    events.push({ type: 'allObjectives' });
    next = grantXp({ ...next, allDoneAwarded: true }, XP.allObjectives, events, 'all objectives');
  }
  return next;
}

function stepHazards(state, ctx, events) {
  let next = state;
  const hazards = state.hazards.map((h) => {
    const phase = hazardPhase(h, state.elapsed, state.tuning.daySeconds);
    if (phase === h.status || h.status === 'done') return h;
    if (phase === 'warning' && h.status === 'pending') {
      events.push({ type: 'hazardWarn', hazard: h });
      return { ...h, status: 'warning' };
    }
    if (phase === 'active' && h.status !== 'active') {
      events.push({ type: 'hazardStart', hazard: h });
      return { ...h, status: h.duration > 0 ? 'active' : 'done' };
    }
    if (phase === 'done' && h.status === 'active') {
      events.push({ type: 'hazardEnd', hazard: h });
      return { ...h, status: 'done' };
    }
    return h;
  });
  next = { ...next, hazards };
  for (const e of events.filter((ev) => ev.type === 'hazardStart')) {
    const h = e.hazard;
    if (h.type === 'sepStorm') {
      next = { ...next, sepActive: h.severity };
      if (ctx.sheltered) {
        events.push({ type: 'shelteredInTime' });
        next = completeObjectives(grantXp(next, XP.shelter, events, 'sheltered'), 'shelter', 1, events);
      } else {
        events.push({ type: 'penalty', crewId: ctx.playerId, kind: 'radiation', amount: radiationPenalty(h.severity) });
      }
    } else if (h.type === 'micrometeoroid') {
      next = { ...next, damaged: { ...next.damaged, [h.moduleId]: next.tuning.repairSeconds } };
    } else if (h.type === 'dustStorm') {
      next = { ...next, stormActive: true };
    }
  }
  if (events.some((e) => e.type === 'hazardEnd' && e.hazard.type === 'sepStorm')) next = { ...next, sepActive: null };
  return next;
}

function stepDamage(state, dt, events) {
  const entries = Object.entries(state.damaged);
  if (!entries.length) return state;
  const damaged = {};
  for (const [id, left] of entries) {
    const t = left - dt;
    if (t <= 0) events.push({ type: 'damageExpired', moduleId: id });
    else damaged[id] = t;
  }
  return { ...state, damaged };
}

// ctx: { dt, outside, refilling, sheltered, inShelter, running, playerId, paused }
export function stepSol(state, ctx) {
  const events = [];
  if (state.ended || ctx.paused) return { state, events };
  const dt = Math.min(ctx.dt, 0.25);
  let next = { ...state, elapsed: state.elapsed + dt, playerId: ctx.playerId ?? state.playerId };
  const clock = dayClock(next.elapsed, next.tuning.daySeconds);

  if (clock.duskWarning && !next.duskWarned) {
    next = { ...next, duskWarned: true };
    events.push({ type: 'dusk' });
  }

  const pid = next.playerId;
  const before = next.o2[pid] ?? 1;
  const o2 = suitO2Step(before, { dt, outside: ctx.outside, refilling: ctx.refilling, o2Seconds: next.tuning.o2Seconds, running: ctx.running, cold: next.cold });
  next = { ...next, o2: { ...next.o2, [pid]: o2 }, stats: { ...next.stats, o2Used: next.stats.o2Used + Math.max(0, before - o2) } };
  if (o2 < O2_LOW && before >= O2_LOW && ctx.outside) events.push({ type: 'o2Low' });
  if (o2 >= O2_LOW + 0.1) next = { ...next, lowWarned: false };
  if (o2 <= 0 && ctx.outside) {
    events.push({ type: 'o2Out' }, { type: 'penalty', crewId: pid, kind: 'o2', amount: PENALTY.o2 });
    next = { ...next, o2: { ...next.o2, [pid]: 0.5 }, combo: 0 };
  }

  const rate = doseRatePerHour({ body: next.body, outside: ctx.outside, shelter: ctx.inShelter, shieldLevel: next.shieldLevel, sepSeverity: next.sepActive });
  next = { ...next, dose: next.dose + rate * gameHoursPerSecond(next.tuning.daySeconds) * dt, doseRate: rate };

  next = stepHazards(next, ctx, events);
  next = stepDamage(next, dt, events);

  if (clock.nightfall && !next.nightfallFired) {
    next = { ...next, nightfallFired: true };
    events.push({ type: 'nightfall' });
    if (ctx.outside) events.push({ type: 'penalty', crewId: pid, kind: 'night', amount: PENALTY.night });
  }
  return { state: next, events };
}

// A finished mini-game (or hold-to-complete) at a station.
export function recordTaskResult(state, { verb, quality = 1, moduleId = null }) {
  const events = [];
  const q = Math.max(0, Math.min(1, quality));
  const combo = nextCombo(state.combo, q);
  let next = { ...state, combo, stats: { ...state.stats, tasks: state.stats.tasks + 1, qualitySum: state.stats.qualitySum + q } };
  if (combo >= 2) events.push({ type: 'combo', combo });
  next = { ...next, progress: { ...next.progress, bestCombo: Math.max(next.progress.bestCombo, combo) } };
  next = grantXp(next, xpForTask(q, combo), events, 'task');
  if (verb === 'sample') {
    next = grantXp({ ...next, stats: { ...next.stats, samples: next.stats.samples + 1 } }, XP.sample, events, 'sample');
  }
  if (verb === 'repair' && moduleId && next.damaged[moduleId] != null) {
    const { [moduleId]: _fixed, ...rest } = next.damaged;
    next = { ...next, damaged: rest };
    events.push({ type: 'damageRepaired', moduleId });
  }
  next = completeObjectives(next, verb, 1, events);
  return { state: next, events };
}

export function recordAssign(state, crewId) {
  if (state.assigned.includes(crewId)) return { state, events: [] };
  const events = [];
  let next = grantXp({ ...state, assigned: [...state.assigned, crewId] }, XP.assign, events, 'assign');
  next = completeObjectives(next, 'assign', 1, events);
  return { state: next, events };
}

export function recordVerb(state, verb) {
  const events = [];
  return { state: completeObjectives(state, verb, 1, events), events };
}

export function recordCollect(state, collectibleId) {
  if (state.progress.collected.includes(collectibleId)) return { state, events: [] };
  const events = [{ type: 'collected', id: collectibleId }];
  let next = {
    ...state,
    progress: { ...state.progress, collected: [...state.progress.collected, collectibleId] },
    stats: { ...state.stats, collected: state.stats.collected + 1 },
  };
  next = grantXp(next, XP.collect, events, 'artifact');
  next = completeObjectives(next, 'collect', 1, events);
  return { state: next, events };
}

export function endSolState(state, { inside }) {
  const events = [];
  let next = state;
  if (inside) next = completeObjectives(next, 'return', 1, events);
  return { state: { ...next, ended: true }, events };
}

export function solSummary(state) {
  const avg = state.stats.tasks ? state.stats.qualitySum / state.stats.tasks : 0;
  return {
    sol: state.sol,
    tasks: state.stats.tasks,
    samples: state.stats.samples,
    xp: state.stats.xp,
    o2UsedPct: Math.round(state.stats.o2Used * 100),
    collected: state.stats.collected,
    avgQuality: Math.round(avg * 100),
    doseMsv: Math.round(state.dose * 100) / 100,
    objectives: state.objectives.map((o) => ({ label: o.label, done: o.done })),
  };
}
