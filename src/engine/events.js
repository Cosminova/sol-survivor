import { EVENT_CARDS, eventById } from '../data/eventCards.js';
import { MODULES } from '../data/modules.js';
import { SHIELDING, POWER } from '../data/constants.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function fillTemplate(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (vars[key] != null ? String(vars[key]) : match));
}

export function choiceAvailable(mission, choice) {
  const req = choice.requires;
  if (!req) return true;
  if (req.module && !(mission.modules[req.module] > 0)) return false;
  if (req.spares && mission.resources.spares < req.spares) return false;
  return true;
}

function eligibleCards(mission) {
  return EVENT_CARDS.filter((card) => card.weight > 0
    && card.bodies.includes(mission.config.body)
    && !(card.once && mission.flags[card.id])
    && (!card.condition || card.condition(mission)));
}

function weightedPick(cards, rng) {
  const total = cards.reduce((s, c) => s + c.weight, 0);
  let roll = rng.next() * total;
  for (const card of cards) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return cards[cards.length - 1];
}

export function makeEventInstance(mission, card, rng, extraVars = {}) {
  const crewMember = rng.pick(mission.crew);
  return {
    id: card.id,
    vars: {
      crewName: crewMember.name,
      bodyName: mission.config.body === 'mars' ? 'Mars' : 'the Moon',
      ...extraVars,
    },
  };
}

// Priority: scripted story beats, then real DONKI storms, then dust storms / nightfall, then the random deck.
export function rollEvent(mission, rng, { sep, difficulty, nightfall }) {
  const scripted = mission.config.scripted?.find((s) => s.sol === mission.sol && !mission.flags[`script-${s.sol}`]);
  if (scripted) {
    const card = eventById(scripted.eventId);
    if (card) return { ...makeEventInstance(mission, card, rng), scriptKey: `script-${scripted.sol}` };
  }
  if (sep) {
    return makeEventInstance(mission, eventById('sep_alert'), rng, {
      flareClass: sep.flareClass ? `${sep.flareClass}-class` : 'strong',
      eventDate: new Date(sep.time).toISOString().slice(0, 10),
      severity: sep.severity,
    });
  }
  if (nightfall) return makeEventInstance(mission, eventById('lunar_night'), rng);
  if (mission.config.body === 'mars' && !mission.env.storm && rng.chance(mission.env.stormChance ?? 0)) {
    const big = mission.sol > 20 && !mission.flags.global_storm && rng.chance(0.15);
    return makeEventInstance(mission, eventById(big ? 'global_storm' : 'dust_storm'), rng);
  }
  if (!rng.chance(difficulty.eventRate)) return null;
  const cards = eligibleCards(mission);
  return cards.length ? makeEventInstance(mission, weightedPick(cards, rng), rng) : null;
}

const asList = (v) => (Array.isArray(v) ? v : [v]);

const mapCrew = (crew, fn) => crew.map((c) => ({ ...c, ...fn(c) }));

export function applyEffects(mission, effects, rng) {
  let m = mission;
  const res = { ...m.resources };
  const add = (key, amount, max = Infinity) => { res[key] = clamp((res[key] ?? 0) + amount, 0, max); };

  if (effects.o2) add('o2', effects.o2);
  if (effects.water) add('water', effects.water);
  if (effects.food) add('food', effects.food);
  if (effects.spares) add('spares', effects.spares);
  if (effects.battery) add('batteryKwh', effects.battery, m.capacity.batteryKwh);
  m = { ...m, resources: res };

  if (effects.science) m = { ...m, science: Math.max(0, m.science + effects.science) };
  if (effects.morale || effects.health || effects.dose) {
    m = {
      ...m,
      crew: mapCrew(m.crew, (c) => ({
        morale: clamp(c.morale + (effects.morale ?? 0), 0, 100),
        health: clamp(c.health + (effects.health ?? 0), 0, 100),
        doseMsv: c.doseMsv + (effects.dose ?? 0),
      })),
    };
  }
  if (effects.dust) m = { ...m, env: { ...m.env, dust: clamp(m.env.dust + effects.dust, 0, POWER.maxDust) } };
  if (effects.storm) {
    m = { ...m, env: { ...m.env, storm: { ...effects.storm, solsLeft: effects.storm.sols } }, stats: { ...m.stats, storms: m.stats.storms + 1 } };
  }
  if (effects.disable) {
    const enabled = { ...m.enabled };
    for (const id of asList(effects.disable)) enabled[id] = false;
    m = { ...m, enabled };
  }
  if (effects.disableSols) {
    const { id, sols } = effects.disableSols;
    m = { ...m, modifiers: { ...m.modifiers, offline: { ...m.modifiers.offline, [id]: sols } } };
  }
  if (effects.shelter) m = { ...m, today: { ...m.today, shelter: effects.shelter } };
  if (effects.iceBonus) m = { ...m, modifiers: { ...m.modifiers, iceBonus: m.modifiers.iceBonus + effects.iceBonus } };
  if (effects.greenhouseKw) m = { ...m, modifiers: { ...m.modifiers, greenhouseKw: m.modifiers.greenhouseKw + effects.greenhouseKw } };
  if (effects.perchlorate) m = { ...m, greenhouse: { ...m.greenhouse, perchlorate: true } };
  if (effects.blackout) m = { ...m, modifiers: { ...m.modifiers, blackout: effects.blackout } };
  if (effects.shieldWork) m = addShieldWork(m, effects.shieldWork);
  if (effects.repairAll) m = { ...m, broken: {} };
  if (effects.breakChance && rng.chance(effects.breakChance)) m = breakRandomModule(m, rng);
  return m;
}

export function addShieldWork(mission, work) {
  const total = mission.shield.work + work;
  const gained = Math.floor(total / SHIELDING.bermWorkPerLevel);
  const level = Math.min(SHIELDING.maxLevel, mission.shield.level + gained);
  const remainder = level >= SHIELDING.maxLevel ? 0 : total % SHIELDING.bermWorkPerLevel;
  return { ...mission, shield: { level, work: remainder } };
}

const BREAKABLE = MODULES.filter((m) => !['spares', 'shelter'].includes(m.id)).map((m) => m.id);

export function breakRandomModule(mission, rng) {
  const candidates = BREAKABLE.filter((id) => (mission.modules[id] ?? 0) > (mission.broken[id] ?? 0));
  if (!candidates.length) return mission;
  const id = rng.pick(candidates);
  return {
    ...mission,
    broken: { ...mission.broken, [id]: (mission.broken[id] ?? 0) + 1 },
    log: [...mission.log, { sol: mission.sol, type: 'fail', text: `${MODULES.find((x) => x.id === id).name} broke down! Assign someone to Maintain.` }],
  };
}

export { BREAKABLE };
