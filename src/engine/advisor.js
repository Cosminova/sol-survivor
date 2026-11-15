// CAPCOM advisor: forecasts how many sols each resource lasts and gives kid-friendly tips.
import { RADIATION } from '../data/constants.js';
import { MODULES } from '../data/modules.js';
import { BREAKABLE } from './events.js';

const solsLeft = (stock, perSol) => (perSol >= 0 ? Infinity : Math.floor(stock / -perSol));

export function forecast(m) {
  const r = m.lastReport;
  if (!r) return null;
  const { life, power } = r;
  const o2Rate = life.o2Made - life.o2Need;
  const waterRate = life.recycled + life.mined - life.waterNeed - life.electrolysisWater - (life.greenhouseWater ?? 0);
  const foodRate = life.grown - life.foodNeed;
  const energyRate = power.generatedKwh - power.demandKwh;
  return {
    o2: { rate: o2Rate, sols: solsLeft(m.resources.o2, o2Rate) },
    water: { rate: waterRate, sols: solsLeft(m.resources.water, waterRate) },
    food: { rate: foodRate, sols: solsLeft(m.resources.food, foodRate) },
    energy: { rate: energyRate, sols: solsLeft(m.resources.batteryKwh, energyRate) },
  };
}

const REMOTE_TIPS = {
  pressure: 'The air outside would crush a spacesuit. The crew drives robots from inside, so outdoor jobs go at half speed.',
  radiation: 'Radiation outside is deadly. The crew drives robots from inside, so outdoor jobs go at half speed.',
  heat: 'It is oven-hot outside. The crew drives robots from inside, so outdoor jobs go at half speed.',
};

function worldTips(m) {
  const tips = [];
  const { profile, env } = m;
  if (env.remote) tips.push(['info', REMOTE_TIPS[env.remote], 'eva']);
  if (profile.light === 'cycle' && !env.lit && (m.modules.solar ?? 0) > 0) tips.push(['info', `Night on ${profile.name}: no solar power until the Sun comes back.`, 'solar-array']);
  if (profile.light === 'night') tips.push(['info', `This side of ${profile.name} never sees its star. Only nuclear power works here.`, 'tidal-locking']);
  const report = m.lastReport;
  if (report && report.doseToday >= 20) tips.push(['danger', `The crew took ${report.doseToday} mSv today. That much radiation makes people sick. Keep everyone inside and pile on shielding.`, 'radiation-shielding']);
  if (report?.power.hot && report.power.heatKwh > 0.4 * report.power.demandKwh) tips.push(['info', 'Most of your power is going into chillers to keep the heat out.', 'kwh']);
  return tips;
}

export function advise(m) {
  const tips = [];
  const f = forecast(m);
  const remaining = m.config.targetSols - m.sol;
  const push = (level, text, term) => tips.push({ level, text, term });

  if (f) {
    for (const [key, label, term] of [['o2', 'oxygen', 'life-support'], ['water', 'water', 'eclss'], ['food', 'food', 'hydroponics']]) {
      const { sols } = f[key];
      if (sols < remaining && sols <= 3) push('danger', `${label[0].toUpperCase() + label.slice(1)} runs out in ${sols} sol${sols === 1 ? '' : 's'}!`, term);
      else if (sols < remaining) push('warn', `At this rate, ${label} lasts ${sols} more sols, but the mission has ${remaining} to go.`, term);
    }
    if (m.lastReport.power.shed.length) push('warn', 'Some machines were switched off for lack of power. Clean the panels, turn off extras, or add storage.', 'kwh');
  }
  const off = Object.entries(m.enabled).filter(([, on]) => !on).map(([id]) => MODULES.find((x) => x.id === id).name);
  if (off.length) push('info', `Switched off: ${off.join(', ')}. Turn them back on when power allows.`, 'trade-off');
  const broken = BREAKABLE.filter((id) => (m.broken[id] ?? 0) > 0);
  if (broken.length && !m.crew.some((c) => c.task === 'maintain')) push('warn', 'A machine is broken and nobody is assigned to Maintain.', 'redundancy');
  if (m.env.dust > 0.25 && (m.modules.solar ?? 0) > 0) push('warn', `Panels are ${Math.round(m.env.dust * 100)}% covered in dust. Send someone to Maintain (clean them).`, 'solar-array');
  if (m.env.storm) push('info', `Dust storm: tau ${m.env.tau}, ${m.env.storm.solsLeft} sols left. Solar power is way down.`, 'tau');
  if (m.profile) worldTips(m).forEach(([level, text, term]) => push(level, text, term));
  if (!m.profile && m.config.body === 'moon' && !m.env.lit) push('info', 'Lunar night: no solar power and bitter cold.', 'lunar-night');
  const tired = m.crew.filter((c) => c.morale < 35);
  if (tired.length) push('warn', `${tired.map((c) => c.name.split(' ')[0]).join(' & ')} ${tired.length > 1 ? 'are' : 'is'} exhausted. Give them a Rest sol.`, 'behavioral-health');
  const highDose = m.crew.filter((c) => c.doseMsv > RADIATION.careerLimitMsv * 0.85);
  if (highDose.length) push('warn', 'Radiation dose is close to the 600 mSv career limit. Fewer EVAs and more shielding!', 'dose-limit');
  if ((m.modules.greenhouse ?? 0) > 0 && m.greenhouse.growth < 25 && m.sol > 0) push('info', `Greenhouse: first harvest in about ${Math.max(1, Math.ceil(25 - m.greenhouse.growth))} sols.`, 'veggie');
  if (m.modifiers.blackout > 0) push('info', `Radio blackout: ${m.modifiers.blackout} sols until Earth contact.`, 'solar-conjunction');
  if (!tips.length) push('good', 'All systems nominal. Great work, Commander!', null);
  return tips;
}
