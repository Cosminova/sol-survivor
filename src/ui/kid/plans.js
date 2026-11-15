// Cadet-view day plans. A plan is a presentation shortcut: one tap sets a job for every astronaut through
// the engine's own setTask, so the engine stays the single source of truth. Previews run the engine's own
// runSol on a copy of the mission ("tomorrow, if nothing surprising happens"), so no number here is invented.
import { setTask, runSol, computeEnv, effectiveShieldLevel } from '../../engine/sim.js';
import { SHIELDING, RADIATION } from '../../data/constants.js';

/**
 * @typedef {'explore'|'shield'|'fix'|'grow'} PlanId
 * @typedef {{ id: PlanId, title: string, short: string, icon: string, needs?: string }} Plan
 */

/** @type {Plan[]} */
export const PLANS = [
  { id: 'explore', title: 'Explore outside', short: 'Explore', icon: 'telescope' },
  { id: 'shield', title: 'Build the shield', short: 'Build shield', icon: 'pickaxe' },
  { id: 'fix', title: 'Rest and fix', short: 'Rest and fix', icon: 'wrench' },
  { id: 'grow', title: 'Grow food', short: 'Grow food', icon: 'sprout', needs: 'greenhouse' },
];

export const planById = (id) => PLANS.find((p) => p.id === id) ?? null;

// One engine task per astronaut for each plan. The engineer keeps the machines running in the indoor plans.
const fixer = (crew) => crew.find((c) => c.role === 'engineer') ?? crew[0];
const TASKS_FOR = {
  explore: () => 'science',
  shield: () => 'shield',
  fix: (c, crew) => (c.id === fixer(crew)?.id ? 'maintain' : 'rest'),
  grow: (c, crew) => (c.id === fixer(crew)?.id ? 'maintain' : 'greenhouse'),
};

/** @returns {Record<string, string>} crew id -> engine task id */
export function planTasks(mission, planId) {
  const pick = TASKS_FOR[planId];
  if (!pick) return {};
  return Object.fromEntries(mission.crew.map((c) => [c.id, pick(c, mission.crew)]));
}

/** Plans this mission can use today (Grow food needs a greenhouse; a full shield cannot be built higher). */
export function availablePlans(mission) {
  return PLANS.filter((p) => {
    if (p.needs && !((mission.modules[p.needs] ?? 0) > 0)) return false;
    if (p.id === 'shield' && mission.shield.level >= SHIELDING.maxLevel) return false;
    return true;
  });
}

/** Sets every astronaut's job for the plan, using the engine's setTask. Returns a new mission. */
export function applyPlan(mission, planId) {
  return Object.entries(planTasks(mission, planId)).reduce((m, [crewId, task]) => setTask(m, crewId, task), mission);
}

/** The plan that matches the crew's current jobs, or null when jobs were mixed by hand (Expert view). */
export function currentPlan(mission) {
  const match = PLANS.find((p) => {
    const tasks = planTasks(mission, p.id);
    return mission.crew.every((c) => tasks[c.id] === c.task);
  });
  return match?.id ?? null;
}

const round1 = (v) => Math.round(v * 10) / 10;
const avg = (crew, key) => crew.reduce((s, c) => s + c[key], 0) / Math.max(1, crew.length);

/**
 * Runs the engine one day ahead on a copy: same crew jobs, tomorrow's known sky (season, Moon day or night),
 * no surprise event. Returns the changes the three meters care about, or null when the mission is not in a
 * planning phase.
 */
export function simulateNextDay(mission, ctx = {}) {
  if (!mission || mission.status !== 'active' || mission.phase === 'event') return null;
  const sol = mission.sol + 1;
  const stepped = { ...mission, sol, today: { sep: null, shelter: false }, lastEvent: null };
  const after = runSol({ ...stepped, env: computeEnv(stepped, ctx, sol, mission.env) });
  const report = after.lastReport;
  if (!report || report.sol !== sol) return null;
  const cap = mission.capacity.batteryKwh;
  const perLevel = SHIELDING.bermWorkPerLevel;
  const workBefore = mission.shield.level * perLevel + mission.shield.work;
  const workAfter = after.shield.level * perLevel + after.shield.work;
  return {
    after,
    air: round1(after.resources.o2 - mission.resources.o2),
    water: round1(after.resources.water - mission.resources.water),
    food: round1(after.resources.food - mission.resources.food),
    batteryKwh: round1(after.resources.batteryKwh - mission.resources.batteryKwh),
    batteryPct: cap > 0 ? Math.round((100 * after.resources.batteryKwh) / cap) - Math.round((100 * mission.resources.batteryKwh) / cap) : 0,
    shed: report.power.shed,
    cold: !report.power.thermalOk,
    shieldWork: round1(workAfter - workBefore),
    shieldLevel: effectiveShieldLevel(after),
    science: report.scienceToday,
    dose: report.doseToday,
    outside: report.evaCount,
    repairs: after.stats.repairs - mission.stats.repairs,
    cleaned: after.env.dust < mission.env.dust,
    mood: Math.round(avg(after.crew, 'morale') - avg(mission.crew, 'morale')),
    health: Math.round(avg(after.crew, 'health') - avg(mission.crew, 'health')),
  };
}

/** Preview of one plan: the engine's next day with that plan's jobs. */
export const previewPlan = (mission, planId, ctx) => simulateNextDay(applyPlan(mission, planId), ctx);

/**
 * "You get" and "it costs" chips for a plan card, read off the engine preview (never hard-coded).
 * inside is the preview of everyone staying indoors (the Rest and fix plan), used to tell what going outside adds.
 */
export function planChips(planId, sim, inside) {
  const gets = [];
  const costs = [];
  if (!sim) return { gets, costs };
  if (sim.science > 0) gets.push({ icon: 'flask', text: 'Science' });
  if (sim.shieldWork > 0) gets.push({ icon: 'shield', text: 'Stronger shield' });
  if (sim.repairs > 0) gets.push({ icon: 'wrench', text: 'Fixes a machine' });
  else if (sim.cleaned) gets.push({ icon: 'solar', text: 'Cleaner solar panels' });
  if (planId === 'fix' && sim.mood > 0) gets.push({ icon: 'bed', text: 'Rested crew' });
  if (planId === 'grow') gets.push({ icon: 'sprout', text: 'Plants grow faster' });
  if (inside && sim.air < inside.air) costs.push({ icon: 'bubbles', text: 'Uses more air' });
  if (inside && sim.dose > inside.dose) costs.push({ icon: 'atom', text: 'A little radiation' });
  if (!(sim.science > 0)) costs.push({ icon: 'flask', text: 'No science' });
  return { gets, costs };
}

// ---- Meter states ---------------------------------------------------------------------------------

export const METER_WORD = { good: 'Good', low: 'Low', danger: 'Danger' };
const LOW_BATTERY_PCT = 25;
const worst = (...levels) => (levels.includes('danger') ? 'danger' : levels.includes('low') ? 'low' : 'good');

const daysLeft = (stock, perDay) => (perDay >= 0 ? Infinity : Math.floor(stock / -perDay));
const supplyLevel = (days, remaining) => (days >= remaining ? 'good' : days <= 3 ? 'danger' : 'low');

/**
 * Good / Low / Danger for the three Cadet meters. sim is simulateNextDay(mission) (may be null once the
 * mission is over). Thresholds match the advisor: Danger = runs out within 3 days, Low = runs out before the
 * mission ends.
 */
export function meterStates(mission, sim) {
  const remaining = Math.max(0, mission.config.targetSols - mission.sol);
  const r = mission.resources;
  const supplies = [
    { key: 'o2', name: 'Air', unit: 'kg', amount: r.o2, perDay: sim?.air ?? 0 },
    { key: 'water', name: 'Water', unit: 'kg', amount: r.water, perDay: sim?.water ?? 0 },
    { key: 'food', name: 'Food', unit: 'kg', amount: r.food, perDay: sim?.food ?? 0 },
  ].map((s) => {
    const days = s.amount <= 0 ? 0 : daysLeft(s.amount, s.perDay);
    return { ...s, days, level: supplyLevel(days, remaining) };
  });
  const airLevel = worst(...supplies.map((s) => s.level));
  const cause = supplies.find((s) => s.level === airLevel && airLevel !== 'good') ?? null;

  const cap = mission.capacity.batteryKwh;
  const pct = cap > 0 ? Math.round((100 * r.batteryKwh) / cap) : 0;
  const batteryDays = sim ? daysLeft(r.batteryKwh, sim.batteryKwh) : Infinity;
  // Low when a machine will lose power, the battery will run flat before the mission ends, or tomorrow's
  // dawn leaves less than a quarter of the battery (a thin margin for a bad day).
  const thin = cap > 0 && sim ? (100 * sim.after.resources.batteryKwh) / cap < LOW_BATTERY_PCT : false;
  const coldNow = mission.lastReport?.power && mission.lastReport.power.thermalOk === false;
  const powerLevel = sim?.cold || coldNow ? 'danger'
    : sim?.shed.length || thin || (cap > 0 && batteryDays < remaining) ? 'low' : 'good';

  const shield = effectiveShieldLevel(mission);
  const dose = avg(mission.crew, 'doseMsv');
  const dosePct = (100 * dose) / RADIATION.careerLimitMsv;
  const storm = Boolean(mission.today?.sep);
  const shieldLevel = dosePct >= 100 || (storm && shield === 0 && !mission.today?.shelter) ? 'danger'
    : shield === 0 || dosePct > 85 ? 'low' : 'good';

  return {
    air: { level: airLevel, cause: cause && cause.key !== 'o2' ? cause.name : null, supplies, o2Pct: tankPct(mission, 'o2') },
    power: { level: powerLevel, pct, hasBattery: cap > 0, batteryKwh: r.batteryKwh, capKwh: cap, shed: sim?.shed ?? [], cold: Boolean(sim?.cold) },
    shield: { level: shieldLevel, segments: shield, max: SHIELDING.maxLevel, work: mission.shield.work, perLevel: SHIELDING.bermWorkPerLevel, dose: round1(dose), limit: RADIATION.careerLimitMsv, storm },
  };
}

// How full the tank is compared with the fullest it has been this mission.
function tankPct(mission, key) {
  const value = mission.resources[key] ?? 0;
  const ref = Math.max(1, value, ...mission.history.map((x) => x[key] ?? 0));
  return Math.round((100 * value) / ref);
}
