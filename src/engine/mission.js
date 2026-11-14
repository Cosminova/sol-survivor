// Sol Survivor mission engine. Pure and deterministic: no DOM, no fetch, no Date.now(), no Math.random().
// Every exported function returns a new state and never mutates its input. See docs/engine-contract.md.
import { MARS, MOON, LIFE_SUPPORT, RADIATION, SHIELDING, POWER, CREW } from '../data/constants.js';
import { MODULES, SUPPLIES, moduleById } from '../data/modules.js';
import { siteById } from '../data/sites.js';
import { EVENT_CARDS, eventById } from '../data/eventCards.js';
import { rngFromState, hashSeed } from './rng.js';
import { marsSolarKwh, moonSolarKwh, moonDaysUntilChange, daylightHours } from './solar.js';
import { buildWeatherIndex, marsWeather, baselineTau, dustStormChance, moonConditions } from './environment.js';
import { marsTime, seasonName, lightDelaySeconds, sunEarthMarsAngleDeg } from './marsTime.js';
import { classifySepEvents, sepBetween } from './spaceWeather.js';

export const LANDER_CAPACITY_KG = 12000;
export const MISSION_LENGTHS = [30, 60];
export const DEFAULT_START_DATE = '2024-05-01';

// Balanced "Quick start" packs (see docs/balance.md). Each wins a 30-sol mission with 4 crew on the default
// seeds, but only just: the battery dips below 40% every clear night on Mars, food ends under a third, and a
// dust storm or the lunar night switches life support off at night unless the player packs more power.
export const QUICK_START_LOADOUT = {
  mars: {
    modules: { solar: 3, fission: 1, battery: 2, recycler: 1, oxygen: 1, shelter: 1, relay: 1, spares: 2 },
    supplies: { o2: 2, water: 5, food: 3 },
  },
  moon: {
    modules: { solar: 2, fission: 2, battery: 2, recycler: 1, oxygen: 1, shelter: 1, relay: 1, spares: 2 },
    supplies: { o2: 2, water: 5, food: 3 },
  },
};

// Everything the contract leaves open lives here so the UI team can read (and quote) the numbers.
export const TUNING = {
  eventDrawChance: 0.45, // chance of a weighted story card on a sol with no triggered card
  globalStormChance: 0.005, // per sol, Mars storm season (Ls 180-330), once per mission (~10% of 30-sol missions)
  globalStormMinSol: 5,
  supplyDropSol: 20,
  bermHeatSavingPerLevel: 0.15, // each regolith shielding level trims the habitat heat leak by 15%
  evaCrew: 1, // crew members outside each sol (1.3x oxygen, unshielded GCR, earn science)
  evaMaxTau: 5, // no EVA when the sky is darker than this
  breakdownChance: 0.03, // chance per sol that one machine breaks (a spare kit fixes it instantly)
  moraleDrift: -1,
  relayMorale: 2,
  blackoutMorale: -1,
  doctorHeal: 2,
  noO2HealthPerSol: 25,
  noWaterHealthPerSol: 8,
  hungryMoralePerSol: 4,
  hungryHealthPerSol: 2,
  coldHealthPerSol: 10, // health lost per sol when the habitat has NO power at all; scales with the unmet fraction
  coldMoralePerSol: 4, // same, for morale
  lowMoraleThreshold: 20,
  lowMoraleHealthPerSol: 1,
  doseHealthThresholdMsv: 100,
  doseHealthPerSol: 1,
  disableSols: 10, // default length of a "disable" effect outside a storm / lunar night
  remsReferenceEvery: 5, // log the real Curiosity reference sol every N sols
};

const SOL_DAYS = 1.0274912517;
const DAY_MS = 86400000;
const SOL_MS = SOL_DAYS * DAY_MS;
const SOLAR_AREA_M2 = moduleById('solar').areaM2;
const BATTERY_KWH = moduleById('battery').storageKwh;
const BODY_NAME = { mars: MARS.name, moon: MOON.name };
const BREAKABLE = MODULES.filter((m) => m.id !== 'battery' && m.id !== 'shelter' && m.id !== 'spares').map((m) => m.id);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;
const sum = (list) => list.reduce((s, v) => s + v, 0);
const mean = (list) => (list.length ? sum(list) / list.length : 0);
const fmt = (n) => (n < 0 ? '−' : '') + String(Math.abs(n));
const signed = (n) => (n > 0 ? `+${n}` : fmt(n));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = clone(value[key]);
    return out;
  }
  return value;
}

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const prettyDate = (ms) => {
  const d = new Date(ms);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// ---------------------------------------------------------------------------------------------
// Data

export function prepareData({ rems, donki } = {}) {
  const remsBySol = {};
  if (rems?.columns && rems?.rows) {
    const col = Object.fromEntries(rems.columns.map((name, i) => [name, i]));
    for (const row of rems.rows) {
      const sol = row[col.sol];
      if (sol == null) continue;
      remsBySol[sol] = {
        opacity: col.opacity != null ? row[col.opacity] : null,
        uv: col.uv != null ? row[col.uv] : null,
        sunrise: col.sunrise != null ? row[col.sunrise] : null,
        sunset: col.sunset != null ? row[col.sunset] : null,
      };
    }
  }
  return {
    weatherIndex: rems ? buildWeatherIndex(rems) : null,
    sepEvents: donki ? classifySepEvents(donki) : [],
    remsBySol,
  };
}

export function landerMass(loadout) {
  let modulesKg = 0;
  for (const [id, count] of Object.entries(loadout?.modules ?? {})) {
    const mod = moduleById(id);
    if (mod && count > 0) modulesKg += mod.massKg * count;
  }
  let suppliesKg = 0;
  for (const supply of SUPPLIES) {
    const crates = loadout?.supplies?.[supply.id] ?? 0;
    suppliesKg += crates * supply.unitKg * supply.packMass;
  }
  const totalKg = Math.round(modulesKg + suppliesKg);
  return { modulesKg: Math.round(modulesKg), suppliesKg: Math.round(suppliesKg), totalKg, overBy: Math.max(0, totalKg - LANDER_CAPACITY_KG) };
}

// ---------------------------------------------------------------------------------------------
// Helpers shared by createMission and advanceSol

const startMs = (state) => Date.parse(`${state.startDate}T00:00:00Z`);
const solMs = (state, sol) => startMs(state) + sol * (state.body === 'mars' ? SOL_MS : DAY_MS);
const hoursFor = (body) => (body === 'mars' ? MARS.dayHours : MOON.dayHours);

const isOnline = (state, id) => (state.modules[id] ?? 0) > 0 && !state.offline[id];
const count = (state, id) => state.modules[id] ?? 0;
const hasRole = (state, role) => state.crew.some((c) => c.role === role && c.health > 0);
const alive = (state) => state.crew.filter((c) => c.health > 0);

function effectiveShieldLevel(state) {
  const waterWall = state.supplies.waterKg >= SHIELDING.waterWallKg ? 1 : 0;
  return clamp(state.shielding.level + waterWall, 0, SHIELDING.maxLevel);
}

function computeEnv(state, data, rng, previous) {
  const date = solMs(state, state.sol);
  if (state.body === 'mars') {
    const mt = marsTime(new Date(date));
    const ls = mt.ls;
    const weather = marsWeather(data?.weatherIndex ?? null, ls, state.site, rng.next());
    const storm = state.flags.storm;
    const extras = weather.reference ? data?.remsBySol?.[weather.reference.sol] ?? null : null;
    const angle = sunEarthMarsAngleDeg(new Date(date));
    const conjunction = angle < 3;
    const previousBlackout = previous?.blackoutSols ?? 0;
    return {
      ls: round1(ls),
      season: seasonName(ls, state.site.lat >= 0),
      env: {
        minC: weather.minC,
        maxC: weather.maxC,
        avgC: weather.avgC,
        pressurePa: weather.pressurePa,
        tau: round1(storm ? storm.tau : baselineTau(ls)),
        dust: previous?.dust ?? 0,
        stormSols: storm ? storm.sols : 0,
        lit: true,
        lightDelayMin: round1(lightDelaySeconds(new Date(date)) / 60),
        blackoutSols: conjunction ? Math.max(1, previousBlackout) : previousBlackout,
        uv: extras?.uv && extras.uv !== '--' ? extras.uv : null,
        sunrise: extras?.sunrise && extras.sunrise !== '--' ? extras.sunrise : null,
        sunset: extras?.sunset && extras.sunset !== '--' ? extras.sunset : null,
        opacity: extras?.opacity && extras.opacity !== '--' ? extras.opacity : null,
        reference: weather.reference ? { ...weather.reference } : null,
      },
    };
  }
  const cond = moonConditions(state.site, state.sol, 0);
  return {
    ls: null,
    season: null,
    env: {
      minC: cond.minC,
      maxC: cond.maxC,
      avgC: cond.avgC,
      pressurePa: 0,
      tau: 0,
      dust: 0,
      stormSols: 0,
      lit: cond.lit,
      lightDelayMin: round1(MOON.lightSeconds / 60),
      blackoutSols: previous?.blackoutSols ?? 0,
      uv: null,
      sunrise: null,
      sunset: null,
      opacity: null,
      reference: null,
    },
  };
}

function computeStatus(state, over, outcome, reason) {
  const healths = state.crew.map((c) => c.health);
  const morales = state.crew.map((c) => c.morale);
  const dose = sum(state.crew.map((c) => c.doseMsv));
  const score = Math.max(0, Math.round(state.science + 2 * mean(healths) + mean(morales) - dose));
  let stars = 0;
  if (outcome === 'won') {
    stars = 1;
    if (healths.every((h) => h > 0)) stars = 2;
    if (healths.every((h) => h >= 70)) stars = 3;
  }
  return { over, outcome, reason, score, stars };
}

function availability(state, choice) {
  const req = choice.requires ?? {};
  if (req.module && count(state, req.module) <= 0) {
    return { available: false, why: `Needs a ${moduleById(req.module)?.name ?? req.module}` };
  }
  if (req.spares && state.supplies.spares < req.spares) {
    return { available: false, why: `Needs ${plural(req.spares, 'spare parts kit')}` };
  }
  return { available: true, why: null };
}

function fillText(text, vars) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (match, key) => (vars[key] != null ? String(vars[key]) : match));
}

function buildCard(state, card, rng, vars = {}) {
  const living = alive(state);
  const crewName = living.length ? rng.pick(living).name : state.crew[0]?.name ?? 'The crew';
  const all = { bodyName: BODY_NAME[state.body], siteName: state.site.name, crewName, flareClass: 'a', eventDate: 'an unknown day', ...vars };
  return {
    id: card.id,
    icon: card.icon,
    title: fillText(card.title, all),
    body: fillText(card.body, all),
    science: fillText(card.science, all),
    source: card.source,
    terms: [...(card.terms ?? [])],
    choices: card.choices.map((choice) => ({
      label: fillText(choice.label, all),
      ...availability(state, choice),
      effects: clone(choice.effects ?? {}),
      outcome: fillText(choice.outcome, all),
    })),
  };
}

function queueCard(state, cardId, rng, vars) {
  const card = eventById(cardId);
  if (!card) return false;
  if (card.once) state.flags.drawn = [...state.flags.drawn, cardId];
  state.pendingCard = buildCard(state, card, rng, vars);
  return true;
}

function breakModule(state, rng, log, cause) {
  const candidates = BREAKABLE.filter((id) => count(state, id) > 0 && !state.offline[id]);
  if (!candidates.length) return null;
  const id = rng.pick(candidates);
  const name = moduleById(id).name;
  if (state.supplies.spares > 0) {
    state.supplies.spares -= 1;
    log('warn', `${cause}: the ${name} broke. A spare parts kit fixed it right away. ${plural(state.supplies.spares, 'kit')} left.`);
    return id;
  }
  state.offline[id] = { reason: 'broken', sols: Infinity };
  log('danger', `${cause}: the ${name} broke and there are no spare parts. ${hasRole(state, 'engineer') ? 'The engineer will repair it.' : 'It stays off until it is repaired.'}`);
  return id;
}

function recomputeShieldLevel(state) {
  state.shielding.level = clamp(Math.floor(state.shielding.bermWork / SHIELDING.bermWorkPerLevel), 0, SHIELDING.maxLevel);
}

function disableSolsFor(state) {
  if (state.flags.storm) return Math.max(1, state.flags.storm.sols);
  if (state.body === 'moon' && !state.env.lit) return Math.max(1, moonDaysUntilChange(state.site, state.sol, 0));
  return TUNING.disableSols;
}

// Applies one card choice's declarative effects to a (already cloned) state.
function applyEffects(state, effects, rng, log) {
  for (const [key, value] of Object.entries(effects ?? {})) {
    switch (key) {
      case 'morale':
        for (const c of state.crew) if (c.health > 0) c.morale = clamp(c.morale + value, 0, CREW.maxMorale);
        break;
      case 'health':
        for (const c of state.crew) if (c.health > 0) c.health = clamp(c.health + value, 0, CREW.maxHealth);
        break;
      case 'science':
        state.science = Math.max(0, Math.round((state.science + value) * 10) / 10);
        break;
      case 'water':
        state.supplies.waterKg = Math.max(0, state.supplies.waterKg + value);
        break;
      case 'food':
        state.supplies.foodKg = Math.max(0, state.supplies.foodKg + value);
        break;
      case 'o2':
        state.supplies.o2Kg = Math.max(0, state.supplies.o2Kg + value);
        break;
      case 'spares':
        state.supplies.spares = Math.max(0, state.supplies.spares + value);
        break;
      case 'dose':
        for (const c of state.crew) if (c.health > 0) c.doseMsv = round1(c.doseMsv + value);
        break;
      case 'dust':
        state.env.dust = round1(clamp(state.env.dust + value, 0, POWER.maxDust) * 1000) / 1000;
        break;
      case 'tau':
        state.env.tau = round1(Math.max(0, state.env.tau + value));
        if (state.flags.storm) state.flags.storm.tau = Math.max(0, state.flags.storm.tau + value);
        break;
      case 'battery':
        state.power.batteryKwh = clamp(state.power.batteryKwh + value, 0, state.power.batteryMaxKwh);
        break;
      case 'storm':
        state.flags.storm = { tau: value.tau, sols: value.sols };
        state.env.tau = round1(value.tau);
        state.env.stormSols = value.sols;
        break;
      case 'shelter':
        state.shielding.shelterMode = value === true || value === 'full' ? 'full' : value ? 'partial' : null;
        break;
      case 'disable': {
        const ids = Array.isArray(value) ? value : [value];
        const sols = disableSolsFor(state);
        const reason = state.flags.storm ? 'storm' : 'off';
        for (const id of ids) {
          if (count(state, id) > 0 && state.offline[id]?.reason !== 'broken') state.offline[id] = { reason, sols };
        }
        break;
      }
      case 'disableSols':
        if (count(state, value.id) > 0 && state.offline[value.id]?.reason !== 'broken') {
          state.offline[value.id] = { reason: 'off', sols: value.sols };
        }
        break;
      case 'blackout':
        state.env.blackoutSols = Math.max(state.env.blackoutSols, value);
        break;
      case 'shieldWork':
        state.shielding.bermWork += value;
        recomputeShieldLevel(state);
        break;
      case 'repairAll':
        if (value) {
          for (const id of Object.keys(state.offline)) if (state.offline[id].reason === 'broken') delete state.offline[id];
        }
        break;
      case 'perchlorate':
        state.flags.perchlorate = Boolean(value);
        break;
      case 'iceBonus':
        state.flags.iceBonus = round1(state.flags.iceBonus + value);
        break;
      case 'greenhouseKw':
        state.flags.greenhouseKw = round1(state.flags.greenhouseKw + value);
        break;
      case 'breakChance':
        if (rng.chance(value)) {
          if (!breakModule(state, rng, log, 'Hidden damage')) log('info', 'Nothing seems damaged.');
        } else {
          log('good', 'Checked later: nothing was damaged.');
        }
        break;
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Public API

export function createMission({ body, siteId, crew, loadout, seed, lengthSols, startDate }, data) {
  const site = siteById(siteId);
  if (!site) throw new Error(`Unknown site: ${siteId}`);
  if (site.body !== body) throw new Error(`Site ${siteId} is not on ${body}`);
  if (!Array.isArray(crew) || crew.length < 2 || crew.length > 4) throw new Error('Crew must have 2 to 4 people');
  const code = String(seed ?? 'SOLSOL');
  const rng = rngFromState(hashSeed(code));
  const modules = {};
  for (const [id, n] of Object.entries(loadout?.modules ?? {})) if (moduleById(id) && n > 0) modules[id] = n;
  const crates = (id) => Math.max(0, loadout?.supplies?.[id] ?? 0);
  const unit = (id) => SUPPLIES.find((s) => s.id === id).unitKg;
  const batteryMaxKwh = (modules.battery ?? 0) * BATTERY_KWH;

  const state = {
    code,
    seed: code,
    rng: rng.state(),
    body,
    site: clone(site),
    lengthSols: lengthSols ?? MISSION_LENGTHS[0],
    sol: 0,
    startDate: (startDate ?? DEFAULT_START_DATE).slice(0, 10),
    date: null,
    ls: null,
    season: null,
    crew: crew.map((c) => ({ name: c.name, role: c.role, health: CREW.maxHealth, morale: CREW.maxMorale, doseMsv: 0 })),
    modules,
    offline: {},
    supplies: { o2Kg: crates('o2') * unit('o2'), waterKg: crates('water') * unit('water'), foodKg: crates('food') * unit('food'), spares: modules.spares ?? 0 },
    power: { batteryKwh: batteryMaxKwh, batteryMaxKwh, producedKwh: 0, usedKwh: 0, shortfallKwh: 0 },
    env: null,
    shielding: { level: 0, bermWork: 0, shelterMode: null },
    science: 0,
    flags: { perchlorate: false, iceBonus: 0, greenhouseKw: 0, greenhouseSols: 0, drawn: [], storm: null, activeSep: null, harvested: false },
    pendingCard: null,
    lastSol: { log: [] },
    status: { over: false, outcome: null, reason: '', score: 0, stars: 0 },
  };
  state.date = isoDay(solMs(state, 0));
  const { ls, season, env } = computeEnv(state, data, rng, null);
  state.ls = ls;
  state.season = season;
  state.env = env;
  state.rng = rng.state();
  const log = [];
  log.push({ kind: 'good', text: `Touchdown at ${site.name} on ${BODY_NAME[body]}! ${plural(state.crew.length, 'astronaut')} step out onto sol 0.` });
  if (body === 'mars') {
    log.push({ kind: 'info', text: `It is ${season} here (Ls ${Math.round(ls)}°). Today: ${fmt(env.minC)} °C to ${fmt(env.maxC)} °C, air pressure ${env.pressurePa} Pa.`, source: 'rems' });
    log.push({ kind: 'info', text: `A radio message to Earth takes ${env.lightDelayMin} minutes right now.`, source: 'jpl-elements' });
  } else {
    log.push({ kind: 'info', text: env.lit ? `The Sun is up. It stays up for about ${moonDaysUntilChange(site, 0, 0)} days.` : 'It is lunar night.', source: 'moon-fact' });
  }
  const mass = landerMass(loadout);
  log.push({ kind: 'info', text: `The lander carried ${mass.totalKg} kg of gear and supplies.` });
  state.lastSol = { log, budget: null };
  state.status = computeStatus(state, false, null, '');
  return state;
}

export function advanceSol(prev, data) {
  if (prev.pendingCard || prev.status.over) return prev;
  const state = clone(prev);
  const rng = rngFromState(state.rng);
  const log = [];
  const say = (kind, text, source) => log.push(source ? { kind, text, source } : { kind, text });
  const hours = hoursFor(state.body);
  const living = () => alive(state);

  // 1. Resolve the solar particle storm announced last sol.
  if (state.flags.activeSep) {
    const { severity, flareClass } = state.flags.activeSep;
    const level = effectiveShieldLevel(state);
    const mode = state.shielding.shelterMode;
    let factor = SHIELDING.sepFactor[level];
    let where = `inside the habitat (shielding level ${level})`;
    if (mode === 'full') {
      factor = SHIELDING.shelterSepFactor;
      where = 'in the storm shelter';
    } else if (mode === 'partial') {
      factor /= 2;
      where = 'behind the water tanks';
    }
    const dose = round1(RADIATION.sepDoseMsv[severity] * factor);
    for (const c of state.crew) if (c.health > 0) c.doseMsv = round1(c.doseMsv + dose);
    say(dose >= 5 ? 'danger' : dose >= 1 ? 'warn' : 'good', `The ${flareClass} solar storm hit. Each astronaut got ${dose} mSv ${where}. That is about ${Math.round(dose / RADIATION.chestXrayMsv)} chest X-rays.`, 'donki');
    state.flags.activeSep = null;
    state.shielding.shelterMode = null;
  }
  const sheltered = Boolean(prev.flags.activeSep && prev.shielding.shelterMode);

  // 2. New sol: date, offline countdown, storm countdown.
  state.sol += 1;
  state.date = isoDay(solMs(state, state.sol));
  for (const id of Object.keys(state.offline)) {
    const entry = state.offline[id];
    if (Number.isFinite(entry.sols)) {
      entry.sols -= 1;
      if (entry.sols <= 0) {
        delete state.offline[id];
        say('good', `${moduleById(id)?.name ?? id} is back online.`);
      }
    }
  }
  if (state.flags.storm) {
    state.flags.storm.sols -= 1;
    if (state.flags.storm.sols <= 0) {
      state.flags.storm = null;
      say('good', 'The dust storm has cleared. The sky is brightening.', 'opportunity');
    }
  }
  if (hasRole(state, 'engineer')) {
    const broken = Object.keys(state.offline).find((id) => state.offline[id].reason === 'broken');
    if (broken) {
      delete state.offline[broken];
      say('good', `The engineer repaired the ${moduleById(broken).name}.`);
    }
  }
  if (state.supplies.spares > 0) {
    const broken = Object.keys(state.offline).find((id) => state.offline[id].reason === 'broken');
    if (broken) {
      delete state.offline[broken];
      state.supplies.spares -= 1;
      say('good', `A spare parts kit fixed the ${moduleById(broken).name}. ${plural(state.supplies.spares, 'kit')} left.`);
    }
  }

  // 3. Environment.
  const prevEnv = state.env;
  const envResult = computeEnv(state, data, rng, prevEnv);
  state.ls = envResult.ls;
  state.season = envResult.season;
  state.env = envResult.env;
  if (state.body === 'mars') {
    const perSol = state.flags.storm ? POWER.stormDustPerSol : POWER.dustPerSol;
    state.env.dust = Math.round(clamp(prevEnv.dust + perSol, 0, POWER.maxDust) * 1000) / 1000;
  }
  if (state.env.blackoutSols > 0 && !(state.body === 'mars' && sunEarthMarsAngleDeg(new Date(solMs(state, state.sol))) < 3)) {
    state.env.blackoutSols = Math.max(0, prevEnv.blackoutSols - 1);
  }
  if (state.body === 'mars') {
    const ref = state.env.reference;
    if (ref && state.sol % TUNING.remsReferenceEvery === 0) {
      say('info', `Today feels like Curiosity's sol ${ref.sol} on ${ref.earthDate}: ${fmt(ref.minC)} °C to ${fmt(ref.maxC)} °C.`, 'rems');
    } else {
      say('info', `Weather: ${fmt(state.env.minC)} °C to ${fmt(state.env.maxC)} °C, pressure ${state.env.pressurePa} Pa, dust tau ${state.env.tau}.`, 'rems');
    }
    if (state.env.dust >= 0.05) say('info', `Dust covers ${Math.round(state.env.dust * 100)}% of the solar panels.`, 'mer-dust');
  } else {
    say('info', state.env.lit ? `Lunar day. Outside it is about ${fmt(state.env.avgC)} °C.` : `Lunar night. Outside it is about ${fmt(state.env.avgC)} °C.`, 'moon-fact');
  }

  // 4. Power budget. The sol runs dawn → dusk → dawn: panels work only in daylight, fission runs all the time,
  //    and the battery carries the night. Surplus beyond a full battery is wasted; a night deficit the battery
  //    cannot cover switches machines off by priority (life support last) and leaves the habitat cold.
  const daylight = state.body === 'mars' ? daylightHours(state.site.lat, state.ls) : state.env.lit ? hours : 0;
  const night = Math.max(0, hours - daylight);
  let solarKwh = 0;
  if (isOnline(state, 'solar')) {
    const areaM2 = SOLAR_AREA_M2 * count(state, 'solar');
    solarKwh = state.body === 'mars'
      ? marsSolarKwh({ areaM2, latDeg: state.site.lat, ls: state.ls, tau: state.env.tau, dust: state.env.dust })
      : moonSolarKwh({ areaM2, site: state.site, dayIndex: state.sol, phaseOffsetDays: 0, dust: state.env.dust });
  }
  const fissionKw = isOnline(state, 'fission') ? moduleById('fission').outputKw * count(state, 'fission') : 0;
  const fissionKwh = fissionKw * hours;
  const producedKwh = solarKwh + fissionKwh;
  const insulation = 1 - TUNING.bermHeatSavingPerLevel * state.shielding.level;
  const dayTempC = state.body === 'mars' ? state.env.maxC : state.env.avgC;
  const nightTempC = state.body === 'mars' ? state.env.minC : state.env.avgC;
  const heatKwAt = (tempC) => POWER.heatKwPerDegree * Math.max(0, POWER.habitatTargetC - tempC) * insulation;
  const heatKwh = heatKwAt(dayTempC) * daylight + heatKwAt(nightTempC) * night;
  const habitatDayKwh = (POWER.habitatBaseKw + heatKwAt(dayTempC)) * daylight;
  const habitatNightKwh = (POWER.habitatBaseKw + heatKwAt(nightTempC)) * night;
  const habitatKwh = habitatDayKwh + habitatNightKwh;
  const moduleKw = (id) => {
    const mod = moduleById(id);
    return ((mod.kw ?? 0) + (id === 'greenhouse' ? state.flags.greenhouseKw : 0)) * count(state, id);
  };
  let online = Object.keys(state.modules).filter((id) => isOnline(state, id) && moduleKw(id) > 0);
  const budgetFor = (ids) => {
    const modKw = sum(ids.map(moduleKw));
    const dayDemand = habitatDayKwh + modKw * daylight;
    const nightDemand = habitatNightKwh + modKw * night;
    let shortfall = 0;
    let b = state.power.batteryKwh + solarKwh + fissionKw * daylight - dayDemand;
    if (b < 0) {
      shortfall -= b;
      b = 0;
    }
    const afterDay = Math.min(b, state.power.batteryMaxKwh);
    b = afterDay + fissionKw * night - nightDemand;
    if (b < 0) {
      shortfall -= b;
      b = 0;
    }
    return { battery: Math.min(b, state.power.batteryMaxKwh), afterDay, shortfall, demand: dayDemand + nightDemand, nightDemand };
  };
  let budget = budgetFor(online);
  const cut = [];
  if (budget.shortfall > 0) {
    const byPriority = [...online].sort((a, b) => (moduleById(b).priority ?? 0) - (moduleById(a).priority ?? 0));
    for (const id of byPriority) {
      if (budget.shortfall <= 0) break;
      online = online.filter((x) => x !== id);
      state.offline[id] = { reason: 'off', sols: 1 };
      cut.push(id);
      budget = budgetFor(online);
    }
  }
  const shortfallKwh = budget.shortfall;
  const usedKwh = budget.demand - shortfallKwh;
  state.power = {
    batteryKwh: Math.round(budget.battery),
    batteryMaxKwh: state.power.batteryMaxKwh,
    producedKwh: Math.round(producedKwh),
    usedKwh: Math.round(usedKwh),
    shortfallKwh: Math.round(shortfallKwh),
    // Extra detail for the UI (additive to the contract).
    solarKwh: Math.round(solarKwh),
    fissionKwh: Math.round(fissionKwh),
    heatKwh: Math.round(heatKwh),
    habitatKwh: Math.round(habitatKwh),
    nightKwh: Math.round(budget.nightDemand),
    batteryAtDuskKwh: Math.round(budget.afterDay),
    daylightHours: round1(daylight),
    cut: [...cut],
  };
  if (count(state, 'solar') > 0 && count(state, 'fission') > 0) {
    say('info', `Solar panels made ${Math.round(solarKwh)} kWh in ${round1(daylight)} hours of daylight and the fission unit made ${Math.round(fissionKwh)} kWh. The base used ${Math.round(usedKwh)} kWh, ${Math.round(heatKwh)} of it for heating.`, 'kilopower');
  } else if (count(state, 'fission') > 0) {
    say('info', `The fission unit made ${Math.round(fissionKwh)} kWh. The base used ${Math.round(usedKwh)} kWh, ${Math.round(heatKwh)} of it for heating.`, 'kilopower');
  } else {
    say('info', `Solar panels made ${Math.round(solarKwh)} kWh in ${round1(daylight)} hours of daylight. The base used ${Math.round(usedKwh)} kWh, ${Math.round(heatKwh)} of it for heating.`, 'mer-dust');
  }
  if (state.power.batteryMaxKwh > 0) {
    const pct = Math.round((100 * state.power.batteryKwh) / state.power.batteryMaxKwh);
    say(pct <= 20 ? 'warn' : 'info', `Battery at dawn: ${state.power.batteryKwh} of ${state.power.batteryMaxKwh} kWh (${pct}%). The night needed ${Math.round(budget.nightDemand)} kWh.`, 'kilopower');
  }
  if (cut.length) say('warn', `Not enough power for the night! Switched off: ${cut.map((id) => moduleById(id).name).join(', ')}.`);
  const coldFraction = habitatKwh > 0 ? clamp(shortfallKwh / habitatKwh, 0, 1) : 0;
  const cold = shortfallKwh > 0;
  if (cold) say('danger', `Still ${Math.round(shortfallKwh)} kWh short (${Math.round(coldFraction * 100)}% of the habitat's power). It is getting cold and stuffy inside.`);

  // 5. Air, water, food.
  const crewAlive = living();
  const n = crewAlive.length;
  const evaAllowed = !sheltered && state.env.tau <= TUNING.evaMaxTau && n > 0;
  const evaCount = evaAllowed ? Math.min(TUNING.evaCrew, n) : 0;
  const evaIndex = evaCount ? state.sol % n : -1;
  const o2Need = LIFE_SUPPORT.o2KgPerCrewDay * (n + evaCount * (LIFE_SUPPORT.evaO2Multiplier - 1));

  let waterIn = 0;
  let waterOut = LIFE_SUPPORT.waterKgPerCrewDay * n;
  if (isOnline(state, 'recycler')) waterIn += waterOut * moduleById('recycler').recovery;
  let o2In = 0;
  if (isOnline(state, 'oxygen')) {
    const gen = moduleById('oxygen');
    const wanted = gen.o2Kg * count(state, 'oxygen');
    const waterNeeded = wanted / LIFE_SUPPORT.waterToO2Ratio;
    const waterAvail = Math.max(0, state.supplies.waterKg + waterIn - waterOut);
    const share = waterNeeded > 0 ? clamp(waterAvail / waterNeeded, 0, 1) : 0;
    o2In += wanted * share;
    waterOut += waterNeeded * share;
  }
  for (const id of ['moxie', 'regolithO2']) if (isOnline(state, id)) o2In += moduleById(id).o2Kg * count(state, id);
  if (isOnline(state, 'greenhouse')) o2In += moduleById('greenhouse').o2Kg * count(state, 'greenhouse');
  if (isOnline(state, 'iceDrill')) {
    waterIn += moduleById('iceDrill').waterKg * count(state, 'iceDrill') * state.site.iceAccess * (1 + state.flags.iceBonus);
  }

  const o2Before = state.supplies.o2Kg;
  state.supplies.o2Kg = Math.max(0, Math.round((o2Before + o2In - o2Need) * 10) / 10);
  const suffocating = o2Before + o2In - o2Need < 0;
  const waterBefore = state.supplies.waterKg;
  state.supplies.waterKg = Math.max(0, Math.round((waterBefore + waterIn - waterOut) * 10) / 10);
  const thirsty = waterBefore + waterIn - waterOut < 0;

  let foodIn = 0;
  let harvestedNow = false;
  if (isOnline(state, 'greenhouse')) {
    state.flags.greenhouseSols += 1;
    const gh = moduleById('greenhouse');
    if (state.flags.greenhouseSols >= gh.growSols) {
      foodIn = gh.foodKg * count(state, 'greenhouse') * (state.flags.perchlorate ? 0.5 : 1) * (hasRole(state, 'botanist') ? 1.25 : 1);
      if (!state.flags.harvested) {
        state.flags.harvested = true;
        harvestedNow = true;
      }
    }
  }
  const foodOut = LIFE_SUPPORT.foodKgPerCrewDay * n;
  const foodBefore = state.supplies.foodKg;
  state.supplies.foodKg = Math.max(0, Math.round((foodBefore + foodIn - foodOut) * 10) / 10);
  const hungry = foodBefore + foodIn - foodOut < 0;

  say('info', `Air: the crew breathed ${round1(o2Need)} kg of oxygen${o2In > 0 ? ` and the machines made ${round1(o2In)} kg` : ''}. Tanks: ${Math.round(state.supplies.o2Kg)} kg.`, 'bvad');
  say('info', `Water: used ${Math.round(waterOut)} kg, recovered ${Math.round(waterIn)} kg. Stored: ${Math.round(state.supplies.waterKg)} kg.`, 'bvad');
  say('info', `Food: ate ${round1(foodOut)} kg${foodIn > 0 ? `, harvested ${round1(foodIn)} kg` : ''}. Pantry: ${Math.round(state.supplies.foodKg)} kg.`, foodIn > 0 ? 'veggie' : 'bvad');
  if (harvestedNow) say('good', 'The greenhouse grew its first food!', 'veggie');
  if (suffocating) say('danger', 'OXYGEN IS OUT! The crew is gasping for air.', 'bvad');
  if (thirsty) say('danger', 'No water left! The crew is dehydrated.', 'bvad');
  if (hungry) say('danger', 'No food left! The crew is hungry.', 'bvad');

  // 6. Science from EVA.
  let scienceGained = 0;
  if (evaCount > 0) {
    let per = CREW.evaScience * state.site.science;
    if (hasRole(state, 'geologist')) per *= CREW.sciencePerGeologistBonus;
    if (isOnline(state, 'rover')) per *= CREW.roverScienceBonus;
    scienceGained = round1(per * evaCount);
    state.science = round1(state.science + scienceGained);
    say('good', `${crewAlive[evaIndex].name} went on an EVA and collected ${scienceGained} science points.`, 'mars-sites');
  } else if (sheltered) {
    say('info', 'No EVA today: everyone stayed under cover.');
  } else if (n > 0) {
    say('warn', 'No EVA today: the dust storm is too thick.');
  }

  // 7. Radiation.
  const gcrRate = state.body === 'mars' ? RADIATION.marsSurfaceGcrMsvPerSol : RADIATION.moonSurfaceMsvPerDay;
  const level = effectiveShieldLevel(state);
  const insideDose = round1(gcrRate * SHIELDING.gcrFactor[level]);
  crewAlive.forEach((c, i) => {
    const dose = i === evaIndex ? gcrRate : gcrRate * SHIELDING.gcrFactor[level];
    c.doseMsv = round1(c.doseMsv + dose);
  });
  say('info', `Cosmic rays: ${insideDose} mSv for each astronaut inside (shielding level ${level}).`, state.body === 'mars' ? 'rad-2014' : 'lnd-2020');

  // 8. Crew health and morale.
  const relayUp = isOnline(state, 'relay') && state.env.blackoutSols <= 0;
  const fed = !suffocating && !thirsty && !hungry;
  for (const c of crewAlive) {
    let morale = TUNING.moraleDrift;
    if (relayUp) morale += TUNING.relayMorale;
    if (state.env.blackoutSols > 0) morale += TUNING.blackoutMorale;
    if (hungry) morale -= TUNING.hungryMoralePerSol;
    if (cold) morale -= Math.ceil(TUNING.coldMoralePerSol * coldFraction);
    c.morale = clamp(c.morale + morale, 0, CREW.maxMorale);

    let health = 0;
    if (fed && !cold) health += CREW.restHeal;
    if (hasRole(state, 'doctor')) health += TUNING.doctorHeal;
    if (suffocating) health -= TUNING.noO2HealthPerSol;
    if (thirsty) health -= TUNING.noWaterHealthPerSol;
    if (hungry) health -= TUNING.hungryHealthPerSol;
    if (cold) health -= Math.ceil(TUNING.coldHealthPerSol * coldFraction);
    if (c.morale <= TUNING.lowMoraleThreshold) health -= TUNING.lowMoraleHealthPerSol;
    if (c.doseMsv > TUNING.doseHealthThresholdMsv) health -= TUNING.doseHealthPerSol;
    c.health = clamp(c.health + health, 0, CREW.maxHealth);
  }
  if (state.env.blackoutSols > 0) say('warn', `Radio blackout: ${plural(state.env.blackoutSols, 'sol')} left with no word from Earth.`, 'jpl-elements');
  const worst = crewAlive.reduce((w, c) => (c.health < w.health ? c : w), crewAlive[0] ?? null);
  if (worst && worst.health < 50) say('warn', `${worst.name} is not well: health ${worst.health}.`);

  // 9. Random breakdowns.
  if (rng.chance(TUNING.breakdownChance)) breakModule(state, rng, say, 'Wear and tear');

  // 10. Mission end checks.
  const dead = state.crew.find((c) => c.health <= 0);
  if (dead) {
    const why = suffocating ? 'ran out of oxygen' : thirsty ? 'ran out of water' : hungry ? 'ran out of food' : cold ? 'got too cold' : 'got too sick';
    state.status = computeStatus(state, true, 'lost', `${dead.name} ${why}. Mission over on sol ${state.sol}.`);
    say('danger', state.status.reason);
  } else if (state.sol >= state.lengthSols) {
    state.status = computeStatus(state, true, 'won', `You kept everyone alive for ${plural(state.lengthSols, 'sol')}. Welcome home, astronauts!`);
    say('good', state.status.reason);
  } else {
    state.status = computeStatus(state, false, null, '');
  }

  // 11. Events (one card at most).
  if (!state.status.over) {
    const thisSolMs = solMs(state, state.sol);
    const nextSolMs = solMs(state, state.sol + 1);
    const sep = sepBetween(data?.sepEvents ?? [], thisSolMs, nextSolMs);
    let queued = false;
    if (sep) {
      const flareClass = sep.flareClass ?? 'strong';
      state.flags.activeSep = { severity: sep.severity, flareClass, eventDate: isoDay(sep.time) };
      queued = queueCard(state, 'sep_alert', rng, { flareClass, eventDate: prettyDate(sep.time) });
      say('danger', `Solar radiation storm alert! A ${flareClass} flare erupted on ${prettyDate(sep.time)}.`, 'donki');
    }
    const stormSeason = state.body === 'mars' && state.ls >= 180 && state.ls <= 330;
    if (!queued && state.body === 'mars' && !state.flags.storm) {
      if (stormSeason && state.sol >= TUNING.globalStormMinSol && !state.flags.drawn.includes('global_storm') && rng.chance(TUNING.globalStormChance)) {
        queued = queueCard(state, 'global_storm', rng);
      } else if (rng.chance(dustStormChance(state.ls))) {
        queued = queueCard(state, 'dust_storm', rng);
      }
    }
    if (!queued && state.body === 'moon' && prevEnv.lit && !state.env.lit) {
      queued = queueCard(state, 'lunar_night', rng);
      say('warn', `The Sun has set. Night lasts about ${moonDaysUntilChange(state.site, state.sol, 0)} days.`, 'kilopower');
    }
    if (!queued && state.flags.harvested && !state.flags.drawn.includes('harvest')) queued = queueCard(state, 'harvest', rng);
    if (!queued && state.sol >= TUNING.supplyDropSol && !state.flags.drawn.includes('supply_drop')) queued = queueCard(state, 'supply_drop', rng);
    if (!queued && rng.chance(TUNING.eventDrawChance)) {
      const pool = EVENT_CARDS.filter((card) => card.weight > 0 && card.bodies.includes(state.body)
        && !(card.once && state.flags.drawn.includes(card.id))
        && (!card.condition || card.condition(state)));
      const total = sum(pool.map((c) => c.weight));
      if (total > 0) {
        let roll = rng.next() * total;
        let picked = pool[pool.length - 1];
        for (const card of pool) {
          roll -= card.weight;
          if (roll < 0) {
            picked = card;
            break;
          }
        }
        queued = queueCard(state, picked.id, rng);
      }
    }
    if (queued) say('info', `${state.pendingCard.icon} ${state.pendingCard.title}`);
  }

  state.rng = rng.state();
  state.lastSol = {
    log,
    budget: {
      solarKwh: Math.round(solarKwh),
      fissionKwh: Math.round(fissionKwh),
      heatKwh: Math.round(heatKwh),
      nightKwh: Math.round(budget.nightDemand),
      shortfallKwh: Math.round(shortfallKwh),
      coldFraction: round1(coldFraction),
      daylightHours: round1(daylight),
      o2In: round1(o2In),
      o2Out: round1(o2Need),
      waterIn: round1(waterIn),
      waterOut: round1(waterOut),
      foodIn: round1(foodIn),
      foodOut: round1(foodOut),
      scienceGained,
      gcrMsv: insideDose,
      evaCrew: evaIndex >= 0 ? crewAlive[evaIndex].name : null,
    },
  };
  return state;
}

export function applyChoice(prev, choiceIndex, data) {
  const card = prev.pendingCard;
  if (!card) return prev;
  const choice = card.choices[choiceIndex];
  if (!choice || !choice.available) return prev;
  const state = clone(prev);
  const rng = rngFromState(state.rng);
  const log = [...(state.lastSol?.log ?? [])];
  const say = (kind, text, source) => log.push(source ? { kind, text, source } : { kind, text });
  say('info', `You chose: ${choice.label}.`);
  applyEffects(state, choice.effects, rng, say);
  if (choice.outcome) say('good', choice.outcome, card.source);
  if (card.id === 'sep_alert' && !choice.effects?.shelter) state.shielding.shelterMode = null;
  state.pendingCard = null;
  const dead = state.crew.find((c) => c.health <= 0);
  if (dead && !state.status.over) {
    state.status = computeStatus(state, true, 'lost', `${dead.name} got too sick. Mission over on sol ${state.sol}.`);
    say('danger', state.status.reason);
  } else {
    state.status = computeStatus(state, state.status.over, state.status.outcome, state.status.reason);
  }
  state.rng = rng.state();
  state.lastSol = { ...state.lastSol, log };
  return state;
}

export function describeEffects(effects, state) {
  const lines = [];
  const names = (ids) => (Array.isArray(ids) ? ids : [ids]).map((id) => moduleById(id)?.name ?? id).join(', ');
  for (const [key, value] of Object.entries(effects ?? {})) {
    switch (key) {
      case 'morale': lines.push(`Morale ${signed(value)} for everyone`); break;
      case 'health': lines.push(`Health ${signed(value)} for everyone`); break;
      case 'science': lines.push(`Science ${signed(value)} points`); break;
      case 'water': lines.push(`Water ${signed(value)} kg`); break;
      case 'food': lines.push(`Food ${signed(value)} kg`); break;
      case 'o2': lines.push(`Oxygen ${signed(value)} kg`); break;
      case 'spares': lines.push(`Spare parts ${signed(value)} ${Math.abs(value) === 1 ? 'kit' : 'kits'}`); break;
      case 'dose': lines.push(`Radiation ${signed(value)} mSv for each astronaut`); break;
      case 'dust': lines.push(`Panel dust ${signed(Math.round(value * 100))}%`); break;
      case 'tau': lines.push(`Sky dust (tau) ${signed(value)}`); break;
      case 'battery': {
        const max = state?.power?.batteryMaxKwh;
        lines.push(`Battery ${signed(value)} kWh${max ? ` (holds ${max} kWh)` : ''}`);
        break;
      }
      case 'storm': lines.push(`Dust storm: tau ${value.tau} for ${plural(value.sols, 'sol')}, much less solar power`); break;
      case 'shelter': lines.push(value === 'partial' ? 'Half protection from the radiation storm' : 'Almost full protection from the radiation storm (95% blocked)'); break;
      case 'disable': lines.push(`Switched off: ${names(value)}`); break;
      case 'disableSols': lines.push(`${names(value.id)} off for ${plural(value.sols, 'sol')}`); break;
      case 'blackout': lines.push(`No radio contact with Earth for ${plural(value, 'sol')}`); break;
      case 'shieldWork': lines.push(`Shielding work +${value} (${SHIELDING.bermWorkPerLevel} per level)`); break;
      case 'repairAll': lines.push('Repairs every broken machine'); break;
      case 'perchlorate': lines.push('Harvests cut in half (toxic soil)'); break;
      case 'iceBonus': lines.push(`Ice drill water ${signed(Math.round(value * 100))}%`); break;
      case 'greenhouseKw': lines.push(`Each greenhouse uses ${signed(value)} kW of power`); break;
      case 'breakChance': lines.push(`${Math.round(value * 100)}% chance that a machine breaks`); break;
      default: lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  return lines;
}

export function missionStatus(state) {
  return state.status;
}
