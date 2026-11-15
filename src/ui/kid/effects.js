// Picks out the BIG results of one day for the "what just happened" popup. Pure: it compares the mission
// before Next day with the mission after the engine ran, and reads every number straight from the engine.
// Small, everyday changes return null, so the popup only appears when something really changed.
import { effectiveShieldLevel } from '../../engine/sim.js';
import { moduleById } from '../../data/modules.js';
import { RADIATION, SHIELDING } from '../../data/constants.js';
import { METER_WORD, meterStates, simulateNextDay } from './plans.js';
import { KID_MODULE_NAMES, dayWord, dayKey } from './words.js';

const HEALTH_DROP = 10; // points lost in one day by one astronaut
const SCIENCE_MARKS = [0.5, 1]; // share of the science goal
const MAX_ITEMS = 4;
const RANK = { good: 0, low: 1, danger: 2 };

const fmt = (v) => (Math.round(v * 10) / 10).toString();
const POWER_NAMES = { solar: 'A solar panel', fission: 'The nuclear power unit', battery: 'The battery' };
const nameOf = (id) => KID_MODULE_NAMES[id] ?? POWER_NAMES[id] ?? moduleById(id)?.name ?? id;
const list = (ids) => ids.map(nameOf).join(', ');

/**
 * @param {object} before mission in its planning phase, before Next day
 * @param {object} after the same mission after the day ran
 * @param {object} [ctx] simulation context (weather, storm dates) for the meter forecasts
 * @returns {{ title: string, items: { icon: string, text: string, tone: 'good'|'bad'|'' }[] }|null}
 */
export function dayEffects(before, after, ctx = {}) {
  const report = after?.lastReport;
  if (!before || !report || report.sol !== after.sol || after.sol === before.sol) return null;
  const items = [];
  const add = (icon, text, tone = '') => items.push({ icon, text, tone });
  const body = after.config.body;

  if (after.today?.sep) {
    const safe = after.today.shelter ? ' The crew took cover.' : '';
    add('sun', `A solar storm hit.${safe} Radiation today: ${fmt(report.doseToday)} mSv, like ${Math.round(report.doseToday / RADIATION.chestXrayMsv)} chest X-rays.`, 'bad');
  }
  if (body === 'moon' && before.env.lit !== after.env.lit) {
    if (after.env.lit) add('sun', 'Sunrise! The solar panels are making power again.', 'good');
    else add('moon', 'The Sun has set. The solar panels make no power at night.', 'bad');
  }
  if (!before.env.storm && after.env.storm) add('wind', 'A dust storm started. The solar panels make much less power.', 'bad');
  if (before.env.storm && !after.env.storm) add('wind', 'The dust storm is over.', 'good');

  const broke = Object.keys(after.broken).filter((id) => (after.broken[id] ?? 0) > (before.broken[id] ?? 0));
  if (broke.length) add('wrench', `${list(broke)} broke down. Pick Rest and fix to mend it.`, 'bad');

  const shedBefore = before.lastReport?.power.shed ?? [];
  const powerItem = !report.power.thermalOk || (report.power.shed.length && !shedBefore.length);
  if (!report.power.thermalOk) add('zap', `Not enough power for the heaters. The base got cold (${fmt(report.power.shortfallKwh)} kWh short).`, 'bad');
  else if (report.power.shed.length && !shedBefore.length) add('zap', `Not enough power: ${list(report.power.shed)} switched off.`, 'bad');

  const shieldBefore = effectiveShieldLevel(before);
  const shieldAfter = effectiveShieldLevel(after);
  if (shieldAfter !== shieldBefore) add('shield', `Shield is now level ${shieldAfter} of ${SHIELDING.maxLevel}.`, shieldAfter > shieldBefore ? 'good' : 'bad');

  for (const c of after.crew) {
    const was = before.crew.find((b) => b.id === c.id);
    const drop = was ? Math.round(was.health - c.health) : 0;
    if (drop >= HEALTH_DROP) add('user', `${c.name.split(' ')[0]}'s health dropped by ${drop}.`, 'bad');
  }

  const was = meterStates(before, simulateNextDay(before, ctx));
  const now = meterStates(after, simulateNextDay(after, ctx));
  const band = (key, icon, name, detail) => {
    if (was[key].level === now[key].level) return;
    add(icon, `${name} is now ${METER_WORD[now[key].level]}. ${detail}`, RANK[now[key].level] > RANK[was[key].level] ? 'bad' : 'good');
  };
  const worstSupply = now.air.supplies.find((s) => s.level === now.air.level) ?? now.air.supplies[0];
  band('air', 'bubbles', 'Air', `${fmt(worstSupply.amount)} kg of ${worstSupply.name.toLowerCase()} left${Number.isFinite(worstSupply.days) ? `, about ${worstSupply.days} ${dayWord(dayKey(after.config), { plural: worstSupply.days !== 1 })}` : ''}.`);
  if (!powerItem) band('power', 'zap', 'Power', now.power.hasBattery ? `Battery ${now.power.pct}%.` : '');
  if (shieldAfter === shieldBefore) band('shield', 'shield', 'Shield', `Crew radiation so far: ${fmt(now.shield.dose)} of ${now.shield.limit} mSv.`);

  const goal = after.config.scienceGoal;
  const mark = [...SCIENCE_MARKS].reverse().find((share) => before.science < goal * share && after.science >= goal * share);
  if (mark) add('flask', mark >= 1 ? `Science goal reached: ${Math.round(after.science)} of ${goal} points!` : `Halfway to the science goal: ${Math.round(after.science)} of ${goal} points.`, 'good');

  if (!items.length) return null;
  const shown = items.slice(0, MAX_ITEMS - 1);
  shown.push({ icon: 'check', text: `Today: +${fmt(report.scienceToday)} science, ${fmt(report.life.o2Need)} kg of air breathed.`, tone: '' });
  return { title: `Day ${after.sol}: what happened`, items: shown };
}
