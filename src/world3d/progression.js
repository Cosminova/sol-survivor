// Pure progression: XP, ranks, combos and the per-sol objective checklist.
import { makeRng, shuffled } from './rng.js';
import { COLLECTIBLES } from './facts.js';
import { stationById } from './layout.js';
import { moduleById } from '../data/modules.js';

export const RANKS = [
  { id: 'cadet', label: 'Cadet', xp: 0, icon: '🧑‍🚀' },
  { id: 'specialist', label: 'Specialist', xp: 200, icon: '🛰️' },
  { id: 'commander', label: 'Commander', xp: 600, icon: '🚀' },
  { id: 'flightDirector', label: 'Flight Director', xp: 1400, icon: '🌟' },
];

export const XP = { taskBase: 10, taskQuality: 20, collect: 20, sample: 10, objective: 25, allObjectives: 50, shelter: 30, assign: 5 };

export const defaultProgress = () => ({ xp: 0, rank: 'cadet', collected: [], objectivesDone: 0, introSeen: false, bestCombo: 0 });

export function normalizeProgress(p) {
  const d = defaultProgress();
  if (!p || typeof p !== 'object') return d;
  const xp = Number.isFinite(p.xp) && p.xp >= 0 ? Math.floor(p.xp) : 0;
  return {
    ...d,
    xp,
    rank: rankFor(xp).rank.id,
    collected: Array.isArray(p.collected) ? p.collected.filter((id) => typeof id === 'string') : [],
    objectivesDone: Number.isFinite(p.objectivesDone) ? p.objectivesDone : 0,
    introSeen: Boolean(p.introSeen),
    bestCombo: Number.isFinite(p.bestCombo) ? p.bestCombo : 0,
  };
}

export function rankFor(xp) {
  let index = 0;
  RANKS.forEach((r, i) => { if (xp >= r.xp) index = i; });
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return { rank, index, next, progress };
}

export const comboMultiplier = (combo) => 1 + Math.min(combo, 5) * 0.1;
export const nextCombo = (combo, quality) => (quality >= 0.7 ? combo + 1 : 0);

export function xpForTask(quality, combo) {
  const q = Math.max(0, Math.min(1, quality));
  return Math.round((XP.taskBase + XP.taskQuality * q) * comboMultiplier(combo));
}

// Returns the new progress plus the rank reached if this XP crossed a threshold.
export function addXp(progress, amount) {
  const before = rankFor(progress.xp).index;
  const xp = progress.xp + Math.max(0, Math.round(amount));
  const after = rankFor(xp);
  return { progress: { ...progress, xp, rank: after.rank.id }, leveledUp: after.index > before ? after.rank : null };
}

export function remainingCollectibles(body, collected) {
  return COLLECTIBLES.filter((c) => (c.body === 'any' || c.body === body) && !collected.includes(c.id));
}

// ---------- Objectives ----------
const obj = (id, label, verb, target = 1, extra = {}) => ({ id, label, verb, target, count: 0, done: false, ...extra });

function contextual(mission, layout, collected) {
  const out = [];
  const has = (id) => (mission.modules?.[id] ?? 0) > 0;
  if (has('solar') && (mission.env?.dust ?? 0) > 0.02) {
    const n = Math.min(2, mission.modules.solar);
    out.push(obj('clean', `Clean ${n} solar panel${n > 1 ? 's' : ''}`, 'clean', n));
  }
  out.push(obj('sample', 'Collect a rock sample', 'sample', 1));
  if ((mission.shield?.level ?? 0) < 3) out.push(obj('shield', 'Shovel regolith onto the berm', 'shield', 1));
  if (has('greenhouse')) out.push(obj('tend', 'Tend the greenhouse', 'tend', 1));
  if (has('iceDrill')) out.push(obj('drill', 'Drill for ice', 'drill', 1));
  if (remainingCollectibles(mission.config?.body, collected).length) out.push(obj('collect', 'Find a hidden artifact', 'collect', 1));
  if (stationById(layout, 'rover')) out.push(obj('drive', 'Take the rover for a drive', 'drive', 1));
  return out;
}

export function generateObjectives(mission, layout, { seed = 1, hazards = [], collected = [] } = {}) {
  const rng = makeRng(seed ^ (mission.sol * 7919));
  const crewN = mission.crew?.length ?? 4;
  const list = [obj('assignAll', `Assign all ${crewN} crew a job`, 'assign', crewN)];
  if (hazards.some((h) => h.type === 'sepStorm')) list.push(obj('shelter', 'Take cover before the solar storm hits', 'shelter', 1, { urgent: true }));
  const brokenId = Object.keys(mission.broken ?? {}).find((id) => mission.broken[id] > 0);
  if (brokenId) list.push(obj('repair', `Repair the ${moduleById(brokenId)?.name.split(' (')[0] ?? brokenId}`, 'repair', 1, { urgent: true }));
  const picks = shuffled(contextual(mission, layout, collected), rng).slice(0, list.length > 2 ? 1 : 2);
  return [...list, ...picks, obj('return', 'Be inside the habitat by nightfall', 'return', 1)];
}

// Pure update; returns the new list and which objectives just completed.
export function applyObjective(objectives, verb, amount = 1) {
  const completed = [];
  const next = objectives.map((o) => {
    if (o.done || o.verb !== verb) return o;
    const count = Math.min(o.target, o.count + amount);
    const done = count >= o.target;
    if (done) completed.push(o.id);
    return { ...o, count, done };
  });
  return { objectives: next, completed };
}

export const allObjectivesDone = (objectives) => objectives.length > 0 && objectives.every((o) => o.done);
