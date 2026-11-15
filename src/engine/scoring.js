import { RADIATION } from '../data/constants.js';
import { unshieldedDosePerSol } from './sim.js';

const avg = (list, fn) => list.reduce((s, x) => s + fn(x), 0) / list.length;

export function scoreMission(m) {
  const target = m.config.targetSols;
  const survived = Math.min(1, m.sol / target);
  const sciencePct = Math.min(1, m.science / m.config.scienceGoal);
  const health = avg(m.crew, (c) => c.health);
  const morale = avg(m.crew, (c) => c.morale);
  const doseOk = m.crew.every((c) => c.doseMsv <= RADIATION.careerLimitMsv);
  const surfaceDose = avg(m.crew, (c) => c.doseMsv - c.transitDoseMsv);
  const unshieldedDose = unshieldedDosePerSol(m) * m.sol;
  const doseSaved = Math.max(0, 1 - surfaceDose / Math.max(1, unshieldedDose));

  const breakdown = {
    survival: Math.round(survived * 400),
    science: Math.round(sciencePct * 250),
    health: Math.round(health * 1.5),
    morale: Math.round(morale * 0.5),
    radiation: Math.round((doseOk ? 50 : 0) + doseSaved * 100),
  };
  const points = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const won = m.status === 'won';
  const stars = won ? 1 + (sciencePct >= 1 ? 1 : 0) + (health >= 70 && doseOk ? 1 : 0) : 0;
  return { points, stars, breakdown, sciencePct, health, morale, surfaceDose, doseOk, won };
}

const LOST_LESSONS = {
  oxygen: 'Oxygen ran out. Real missions carry backup oxygen AND machines that make more (electrolysis, MOXIE). Two ways to get something important is called redundancy.',
  water: 'Water ran out. On the ISS, 98% of water is recycled. Without a recycler, a crew of four uses about 14 kg of water every day.',
  food: 'Food ran out. Packaged food is heavy, so long missions need greenhouses. Remember: plants take about 25 sols before the first harvest!',
  cold: 'The power ran out and the heaters stopped. Mars nights drop below −70 °C. Batteries and nuclear power keep heaters running when the Sun is gone.',
  coldWorld: 'The power ran out and the heaters stopped. Far from a star, a habitat leaks heat all day and all night. Nuclear power keeps heaters running when there is little sunlight.',
  heat: 'The power ran out and the chillers stopped. On a world this hot, keeping the heat out takes as much power as heating does on a cold one. Nuclear power keeps chillers running day and night.',
  health: 'The crew’s health gave out. Watch radiation dose, rest, and supplies together.',
};

export function debrief(m) {
  const s = m.stats;
  const score = scoreMission(m);
  const went = [];
  const improve = [];

  if (m.status === 'lost') improve.push(LOST_LESSONS[m.profile && m.lostReason === 'cold' ? 'coldWorld' : m.lostReason] ?? LOST_LESSONS.health);
  if (s.o2Made > 0) went.push(`Your machines made ${Math.round(s.o2Made)} kg of oxygen on site. That is ISRU and life support working together!`);
  if (s.waterRecycled > 0) went.push(`The recycler saved ${Math.round(s.waterRecycled)} kg of water, about ${Math.round(s.waterRecycled / 3.5)} crew-days’ worth.`);
  if (s.waterMined > 0) went.push(`You mined ${Math.round(s.waterMined)} kg of water from buried ice.`);
  if (s.foodGrown > 0) went.push(`Your greenhouse grew ${Math.round(s.foodGrown)} kg of fresh food.`);
  if (s.sepSheltered > 0) went.push(`You took cover during ${s.sepSheltered} solar storm${s.sepSheltered > 1 ? 's' : ''}. Smart!`);
  if (m.shield.level > 0) went.push(`The crew built ${m.shield.level} level${m.shield.level > 1 ? 's' : ''} of regolith shielding.`);
  if (s.repairs > 0) went.push(`Your team fixed ${s.repairs} broken machine${s.repairs > 1 ? 's' : ''}.`);
  if (score.sciencePct >= 1) went.push(`Science goal reached: ${Math.round(m.science)} points!`);

  if (s.shortfallSols > 0) improve.push(`Power was short on ${s.shortfallSols} sol${s.shortfallSols > 1 ? 's' : ''}, so machines switched off. More panels, a battery, or a fission unit would help.`);
  if (s.coldSols > 0) improve.push(`The habitat got dangerously cold on ${s.coldSols} sol${s.coldSols > 1 ? 's' : ''}.`);
  if (s.sepEvents > s.sepSheltered) improve.push('Some solar storms hit while the crew was unprotected. A storm shelter or a water wall cuts solar particle dose by up to 95%.');
  if (score.sciencePct < 1) improve.push(`Science reached ${Math.round(score.sciencePct * 100)}% of the goal. More EVAs, a geologist on every EVA, or a rover would help.`);
  if (s.maxTau >= 3 && !(m.modules.fission > 0)) improve.push(`A dust storm pushed tau to ${s.maxTau}. Solar power drops sharply in storms; nuclear power does not.`);

  const surface = score.surfaceDose;
  const xrays = Math.round(surface / RADIATION.chestXrayMsv);
  const earthDays = Math.round(surface / RADIATION.earthBackgroundMsvPerDay);
  const radiation = `Each astronaut received about ${surface.toFixed(1)} mSv on the surface: like ${xrays} chest X-rays, or ${earthDays.toLocaleString()} days of natural radiation on Earth.`
    + (m.profile && score.surfaceDose > RADIATION.careerLimitMsv ? ` That is over the ${RADIATION.careerLimitMsv} mSv a NASA astronaut may receive in a whole career.` : '')
    + (m.crew[0].transitDoseMsv > 0 ? ` Plus ${m.crew[0].transitDoseMsv} mSv from the 6-month trip to Mars.` : '');

  return { score, went, improve, radiation };
}
