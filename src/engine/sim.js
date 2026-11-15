// Core outpost simulation. Every function returns a new mission object; nothing is mutated.
// Flow per sol: beginSol (environment + event roll) -> resolveEvent (if any) -> runSol (physics).
import { CREW, LIFE_SUPPORT, POWER, RADIATION, SHIELDING, MARS, MOON } from '../data/constants.js';
import { MODULES, SUPPLIES, moduleById, modulesForWorld } from '../data/modules.js';
import { siteById } from '../data/sites.js';
import { DIFFICULTY } from '../data/missions.js';
import { eventById } from '../data/eventCards.js';
import { marsTime, solsToEarthDays } from './marsTime.js';
import { marsSolarKwh, moonSolarKwh, daylightHours } from './solar.js';
import { marsWeather, baselineTau, dustStormChance, moonConditions } from './environment.js';
import { sepBetween } from './spaceWeather.js';
import { hashSeed, rngFromState } from './rng.js';
import { rollEvent, applyEffects, addShieldWork, BREAKABLE, choiceAvailable, fillTemplate } from './events.js';
import {
  RULES, worldForConfig, resolveSite, worldProfile, worldEnv, worldSolarKwh, thermalKw, isHot,
  insideDose, evaDose, openDose, acuteHealthLoss, stellarFlareSeverity, evaO2MultiplierFor, isLegacyWorldId,
} from './worldModel.js';

export const ROLES = {
  commander: { label: 'Commander', bonus: 'Keeps the whole crew’s morale up.' },
  engineer: { label: 'Engineer', bonus: 'Repairs, cleans panels and builds shielding 50% faster.' },
  botanist: { label: 'Botanist', bonus: 'Greenhouse harvests are 25% bigger.' },
  geologist: { label: 'Geologist', bonus: 'Finds 50% more science on EVAs.' },
};

export const TASKS = {
  rest: { label: 'Rest', icon: '😴', desc: 'Recover health and morale.' },
  science: { label: 'Explore (EVA)', icon: '🔭', desc: 'Go outside to do science. Uses more oxygen and adds radiation dose.' },
  maintain: { label: 'Maintain', icon: '🔧', desc: 'Fix a broken machine, or clean dust off the solar panels outside.' },
  shield: { label: 'Build Shielding (EVA)', icon: '⛏️', desc: 'Pile regolith on the habitat. Every 6 crew-sols adds a shielding level, and each level also cuts the heating bill 15%.' },
  greenhouse: { label: 'Tend Greenhouse', icon: '🌱', desc: 'Plants grow faster and harvests are bigger.' },
};

export const DEFAULT_CREW = [
  { id: 'c1', name: 'Ada Reyes', role: 'commander', avatar: '👩🏽‍🚀' },
  { id: 'c2', name: 'Kai Okafor', role: 'engineer', avatar: '👨🏿‍🔧' },
  { id: 'c3', name: 'Mei Tanaka', role: 'botanist', avatar: '👩🏻‍🔬' },
  { id: 'c4', name: 'Arjun Patel', role: 'geologist', avatar: '👨🏽‍🚀' },
];

const GREENHOUSE_WATER_KG = 0.5; // net water per running greenhouse unit per sol (transpiration losses)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (list, fn) => list.reduce((s, x, i) => s + fn(x, i), 0);
const round1 = (v) => Math.round(v * 10) / 10;

export const dayHours = (body) => (body === 'mars' ? MARS.dayHours : MOON.dayHours);
const dayLengthEarthDays = (body) => (body === 'mars' ? solsToEarthDays(1) : 1);
export const gcrPerSol = (body) => (body === 'mars' ? RADIATION.marsSurfaceGcrMsvPerSol : RADIATION.moonSurfaceMsvPerDay);

// Missions on any world other than the Moon or Mars carry a profile (src/engine/worldModel.js). Moon and Mars
// missions have none and run the original code paths untouched.
export const turnHoursFor = (m) => (m.profile ? m.profile.turnHours : dayHours(m.config.body));
/** Dose per turn for someone standing outside with no habitat: the yardstick for "dose saved". */
export const unshieldedDosePerSol = (m) => (m.profile ? openDose(m.profile) : gcrPerSol(m.config.body));

// ---------- Loadout ----------

export function loadoutMass({ modules = {}, supplies = {} }) {
  const moduleMass = sum(Object.entries(modules), ([id, n]) => (moduleById(id)?.massKg ?? 0) * n);
  const supplyMass = sum(SUPPLIES, (s) => (supplies[s.id] ?? 0) * s.packMass);
  return Math.round(moduleMass + supplyMass);
}

export function budgetFor(config, difficulty) {
  return Math.round(config.budgetKg * (DIFFICULTY[difficulty]?.budgetMultiplier ?? 1));
}

export function missionNeeds(config, crewCount = 4) {
  const n = config.targetSols * crewCount;
  return {
    o2: Math.round(n * LIFE_SUPPORT.o2KgPerCrewDay),
    water: Math.round(n * LIFE_SUPPORT.waterKgPerCrewDay),
    food: Math.round(n * LIFE_SUPPORT.foodKgPerCrewDay),
  };
}

export function validateLoadout(config, loadout, difficulty, world = worldForConfig(config)) {
  const allowed = world && !isLegacyWorldId(world.id) ? modulesForWorld(world, resolveSite(config, world)).map((mod) => mod.id) : null;
  const massKg = loadoutMass(loadout);
  const budgetKg = budgetFor(config, difficulty);
  const m = loadout.modules ?? {};
  const s = loadout.supplies ?? {};
  const needs = missionNeeds(config);
  const errors = [];
  const warnings = [];
  if (massKg > budgetKg) errors.push(`Too heavy! ${massKg.toLocaleString()} kg is over the ${budgetKg.toLocaleString()} kg limit.`);
  for (const mod of MODULES) {
    if ((m[mod.id] ?? 0) > mod.max) errors.push(`You can carry at most ${mod.max} × ${mod.name}.`);
    if (allowed) {
      if (!allowed.includes(mod.id) && (m[mod.id] ?? 0) > 0) errors.push(`${mod.name} does not work on ${world.name}.`);
    } else if (mod.body && mod.body !== config.body && (m[mod.id] ?? 0) > 0) errors.push(`${mod.name} only works on ${mod.body === 'mars' ? 'Mars' : 'the Moon'}.`);
  }
  if (!(m.solar > 0) && !(m.fission > 0)) errors.push('No power source! Pack solar arrays or a fission unit.');
  const makesO2 = (m.oxygen ?? 0) + (m.moxie ?? 0) + (m.regolithO2 ?? 0) > 0;
  if (!makesO2 && (s.o2 ?? 0) < needs.o2) warnings.push(`Oxygen: the crew needs about ${needs.o2} kg and nothing on board makes more.`);
  if (!(m.recycler > 0) && !(m.iceDrill > 0) && (s.water ?? 0) < needs.water) warnings.push(`Water: about ${needs.water} kg needed with no recycler. Consider a Water Recycler.`);
  if ((s.food ?? 0) < needs.food && !(m.greenhouse > 0)) warnings.push(`Food: about ${needs.food} kg needed for ${config.targetSols} sols.`);
  if ((m.oxygen ?? 0) > 0 && !(m.recycler > 0) && !(m.iceDrill > 0)) warnings.push('The Oxygen Generator splits water. Without a recycler or ice drill your water will drain fast.');
  if (config.body === 'moon' && config.siteId === 'tranquility' && !(m.fission > 0)) warnings.push('A 14-day lunar night is coming. Batteries alone may not last.');
  if (!(m.battery > 0) && (m.solar ?? 0) > 0) warnings.push('Solar with no battery: you cannot store daytime power for the night.');
  return { massKg, budgetKg, ok: errors.length === 0, errors, warnings, needs };
}

// ---------- Creation ----------

function defaultTask(role, modules) {
  if (role === 'engineer') return 'maintain';
  if (role === 'botanist') return modules.greenhouse > 0 ? 'greenhouse' : 'science';
  return 'science';
}

export function createMission({ config, loadout, difficulty = 'cadet', code = 'SOL001', crew = DEFAULT_CREW, world = worldForConfig(config) }, ctx = {}) {
  const playedWorld = world && !isLegacyWorldId(world.id) ? world : null;
  const site = playedWorld ? resolveSite(config, playedWorld) : siteById(config.siteId);
  if (!site) throw new Error(`Unknown site ${config.siteId}`);
  const profile = playedWorld ? worldProfile(playedWorld, site) : null;
  const modules = Object.fromEntries(Object.entries(loadout.modules ?? {}).filter(([, n]) => n > 0));
  const supplies = loadout.supplies ?? {};
  const capacity = { batteryKwh: (modules.battery ?? 0) * moduleById('battery').storageKwh };
  const transitDose = config.includeTransitDose && config.body === 'mars'
    ? round1(RADIATION.marsCruiseMsvPerDay * RADIATION.marsCruiseDays)
    : 0;
  const enabled = Object.fromEntries(MODULES.filter((mod) => mod.kw > 0 && modules[mod.id]).map((mod) => [mod.id, true]));

  const base = {
    version: 1,
    code,
    rngState: hashSeed(code),
    config: { ...config, difficulty },
    site,
    ...(profile ? { profile } : {}),
    sol: 0,
    phase: 'plan',
    status: 'active',
    lostReason: null,
    modules,
    broken: {},
    repairWork: 0,
    enabled,
    capacity,
    resources: {
      o2: supplies.o2 ?? 0,
      water: supplies.water ?? 0,
      food: supplies.food ?? 0,
      batteryKwh: capacity.batteryKwh,
      spares: modules.spares ?? 0,
    },
    env: null,
    greenhouse: { growth: 0, perchlorate: false },
    shield: { level: 0, work: 0 },
    crew: crew.map((c) => ({ ...c, health: CREW.maxHealth, morale: 85, doseMsv: transitDose, transitDoseMsv: transitDose, task: defaultTask(c.role, modules) })),
    science: 0,
    pendingEvent: null,
    lastEvent: null,
    today: { sep: null, shelter: false },
    modifiers: { iceBonus: 0, greenhouseKw: 0, blackout: 0, offline: {} },
    queue: [],
    flags: {},
    log: [{ sol: 0, type: 'story', text: config.intro }],
    history: [],
    lastReport: null,
    stats: {
      shortfallSols: 0, coldSols: 0, o2DeficitSols: 0, waterDeficitSols: 0, foodDeficitSols: 0,
      o2Made: 0, waterMined: 0, waterRecycled: 0, foodGrown: 0, evaCrewSols: 0, repairs: 0, failures: 0,
      maxTau: 0, sepEvents: 0, sepSheltered: 0, sepDoseMsv: 0, events: 0, storms: 0, minBatteryPct: 100,
    },
  };
  return { ...base, env: computeEnv(base, ctx, 0, null) };
}

// ---------- Environment ----------

export function missionDateMs(config, sol) {
  return Date.parse(`${config.startDate}T12:00:00Z`) + sol * dayLengthEarthDays(config.body) * 864e5;
}

const worldDateMs = (config, profile, sol) => Date.parse(`${config.startDate}T12:00:00Z`) + sol * profile.turnHours * 36e5;

export function computeEnv(mission, ctx, sol, prev) {
  const { config, site } = mission;
  const dust = prev?.dust ?? 0;
  if (mission.profile) {
    return { dateMs: worldDateMs(config, mission.profile, sol), ...worldEnv(mission.profile, sol, config.phaseOffsetDays ?? 0, prev), dust };
  }
  const dateMs = missionDateMs(config, sol);
  if (config.body === 'moon') {
    const c = moonConditions(site, sol, config.phaseOffsetDays ?? 0);
    return { dateMs, ls: null, ...c, tau: 0, storm: null, dust, stormChance: 0, reference: null };
  }
  const { ls } = marsTime(new Date(dateMs));
  const weather = marsWeather(ctx.weatherIndex, ls, site);
  const storm = prev?.storm ?? null;
  const tau = round1(baselineTau(ls) + (storm ? storm.tau : 0));
  return { dateMs, ls, ...weather, lit: true, tau, storm, dust, stormChance: dustStormChance(ls) };
}

// ---------- Sol phases ----------

export function beginSol(mission, ctx = {}) {
  if (mission.status !== 'active' || mission.phase === 'event') return mission;
  const rng = rngFromState(mission.rngState);
  const sol = mission.sol + 1;
  const stepped = { ...mission, sol, today: { sep: null, shelter: false }, lastEvent: null };
  const env = computeEnv(stepped, ctx, sol, mission.env);
  const profile = mission.profile;
  const sep = profile
    ? worldSep(profile, ctx, rng, mission.env.dateMs, env.dateMs)
    : ctx.seps ? sepBetween(ctx.seps, mission.env.dateMs, env.dateMs) : null;
  const withEnv = { ...stepped, env, today: { sep, shelter: false } };
  const nightfall = profile
    ? mission.env.lit && !env.lit && profile.nightTurns >= RULES.longNightTurns
    : mission.config.body === 'moon' && mission.env.lit && !env.lit;
  const queued = withEnv.queue.find((q) => q.sol <= sol);
  const scriptView = queued
    ? { ...withEnv, config: { ...withEnv.config, scripted: [...(withEnv.config.scripted ?? []), { sol, eventId: queued.eventId }] } }
    : withEnv;
  const event = rollEvent(scriptView, rng, { sep, difficulty: DIFFICULTY[mission.config.difficulty] ?? DIFFICULTY.cadet, nightfall });
  const next = { ...withEnv, rngState: rng.state(), queue: queued ? withEnv.queue.filter((q) => q !== queued) : withEnv.queue };
  if (!event) return next;
  return {
    ...next,
    phase: 'event',
    pendingEvent: event,
    stats: { ...next.stats, events: next.stats.events + 1, sepEvents: next.stats.sepEvents + (sep ? 1 : 0) },
  };
}

// Storms for a world mission. Inside our solar system the real NASA DONKI record is replayed wherever the
// particles would still matter; around another star the game rolls that star's own flares.
function worldSep(profile, ctx, rng, fromMs, toMs) {
  if (profile.solarStorms) return ctx.seps ? sepBetween(ctx.seps, fromMs, toMs) : null;
  if (!(profile.flareChance > 0) || !rng.chance(profile.flareChance)) return null;
  return { time: toMs, severity: stellarFlareSeverity(rng.next()), flareClass: null, cardId: 'stellar_flare' };
}

export function resolveEvent(mission, choiceIndex) {
  if (mission.phase !== 'event' || !mission.pendingEvent) return mission;
  const card = eventById(mission.pendingEvent.id);
  const choice = card?.choices[choiceIndex];
  if (!choice || !choiceAvailable(mission, choice)) return mission;
  const rng = rngFromState(mission.rngState);
  const applied = applyEffects(mission, choice.effects, rng);
  const flags = { ...applied.flags, [card.id]: true };
  if (mission.pendingEvent.scriptKey) flags[mission.pendingEvent.scriptKey] = true;
  return {
    ...applied,
    rngState: rng.state(),
    flags,
    phase: 'resolved',
    pendingEvent: null,
    lastEvent: { id: card.id, vars: mission.pendingEvent.vars, choiceIndex, outcome: choice.outcome },
    log: [...applied.log, { sol: mission.sol, type: 'event', text: `${card.icon} ${fillTemplate(card.title, mission.pendingEvent.vars)}: ${choice.label}. ${choice.outcome}` }],
  };
}

export function setTask(mission, crewId, task) {
  if (!TASKS[task]) return mission;
  return { ...mission, crew: mission.crew.map((c) => (c.id === crewId ? { ...c, task } : c)) };
}

export function toggleModule(mission, id) {
  if (!(id in mission.enabled)) return mission;
  return { ...mission, enabled: { ...mission.enabled, [id]: !mission.enabled[id] } };
}

export const workingCount = (m, id) => (m.modifiers.offline[id] > 0 ? 0 : Math.max(0, (m.modules[id] ?? 0) - (m.broken[id] ?? 0)));

export const effectiveShieldLevel = (m) => Math.min(SHIELDING.maxLevel, m.shield.level + (m.resources.water >= SHIELDING.waterWallKg ? 1 : 0));

const sheltering = (m) => Boolean(m.today.shelter);

function hasOutsideJob(m, c) {
  if (sheltering(m)) return false;
  if (c.task === 'science' || c.task === 'shield') return true;
  return c.task === 'maintain' && !BREAKABLE.some((id) => (m.broken[id] ?? 0) > 0) && (m.modules.solar ?? 0) > 0 && m.env.dust > 0.01;
}

// Some worlds are too dangerous to walk on (crushing air, deadly radiation, oven heat). There the crew stays
// inside and drives robots: no walk outside, and the outdoor work goes at RULES.remoteWorkFactor speed.
export const isRemoteOnly = (m) => Boolean(m.profile && m.env?.remote);
const outsideWorkFactor = (m) => (isRemoteOnly(m) ? RULES.remoteWorkFactor : 1);

export function isOnEva(m, c) {
  return !isRemoteOnly(m) && hasOutsideJob(m, c);
}

// Hours of sunlight in this sol: Mars from the site latitude and season, the Moon all day or not at all.
export function daylightFor(m) {
  if (m.profile) return m.env.daylightHours;
  if (m.config.body === 'mars') return daylightHours(m.site.lat, m.env.ls);
  return m.env.lit ? dayHours('moon') : 0;
}

// The power budget runs dawn → dusk → dawn. Panels work only in daylight, fission runs all the time, and the
// battery carries the night. Daytime surplus beyond a full battery is wasted. A deficit the battery cannot
// cover switches machines off by priority (life support last); whatever is still unmet leaves the habitat cold.
export function computePower(m) {
  const profile = m.profile;
  const hours = turnHoursFor(m);
  const daylight = daylightFor(m);
  const night = Math.max(0, hours - daylight);
  const solarArea = workingCount(m, 'solar') * moduleById('solar').areaM2;
  const solarKwh = profile
    ? worldSolarKwh(profile, { areaM2: solarArea, daylightHours: daylight, tau: m.env.tau, dust: m.env.dust })
    : m.config.body === 'mars'
    ? marsSolarKwh({ areaM2: solarArea, latDeg: m.site.lat, ls: m.env.ls, tau: m.env.tau, dust: m.env.dust })
    : moonSolarKwh({ areaM2: solarArea, site: m.site, dayIndex: m.sol, phaseOffsetDays: m.config.phaseOffsetDays ?? 0, dust: m.env.dust });
  const fissionKw = workingCount(m, 'fission') * moduleById('fission').outputKw;
  const fissionKwh = fissionKw * hours;

  const insulation = 1 - SHIELDING.bermHeatSavingPerLevel * Math.min(SHIELDING.maxLevel, m.shield.level);
  const heatKwAt = profile
    ? (tempC) => thermalKw(profile, tempC) * insulation
    : (tempC) => POWER.heatKwPerDegree * Math.max(0, POWER.habitatTargetC - tempC) * insulation;
  const splitDayNight = profile || m.config.body === 'mars';
  const dayTempC = splitDayNight ? m.env.maxC : m.env.avgC;
  const nightTempC = splitDayNight ? m.env.minC : m.env.avgC;
  const habitatDayKwh = (POWER.habitatBaseKw + heatKwAt(dayTempC)) * daylight;
  const habitatNightKwh = (POWER.habitatBaseKw + heatKwAt(nightTempC)) * night;
  const baseKwh = habitatDayKwh + habitatNightKwh;
  const heatKwh = heatKwAt(dayTempC) * daylight + heatKwAt(nightTempC) * night;

  // One entry per working unit, most important first (lowest priority number).
  const units = MODULES
    .filter((mod) => mod.kw > 0 && m.enabled[mod.id] !== false && workingCount(m, mod.id) > 0)
    .flatMap((mod) => Array.from({ length: workingCount(m, mod.id) }, () => ({
      id: mod.id, kw: mod.kw + (mod.id === 'greenhouse' ? m.modifiers.greenhouseKw : 0), priority: mod.priority ?? 9,
    })))
    .sort((a, b) => a.priority - b.priority);

  const budget = (list) => {
    const kw = sum(list, (u) => u.kw);
    const dayDemand = habitatDayKwh + kw * daylight;
    const nightDemand = habitatNightKwh + kw * night;
    let shortfall = 0;
    let b = m.resources.batteryKwh + solarKwh + fissionKw * daylight - dayDemand;
    if (b < 0) { shortfall -= b; b = 0; }
    const afterDay = Math.min(b, m.capacity.batteryKwh);
    const wasted = Math.max(0, b - m.capacity.batteryKwh);
    b = afterDay + fissionKw * night - nightDemand;
    if (b < 0) { shortfall -= b; b = 0; }
    return { battery: Math.min(b, m.capacity.batteryKwh), afterDay, wasted, shortfall, demand: dayDemand + nightDemand, nightDemand };
  };

  let online = units;
  let plan = budget(online);
  const shed = [];
  while (plan.shortfall > 0 && online.length) {
    const cut = online[online.length - 1];
    online = online.slice(0, -1);
    if (!shed.includes(cut.id)) shed.push(cut.id);
    plan = budget(online);
  }
  const running = {};
  for (const u of online) running[u.id] = (running[u.id] ?? 0) + 1;
  const coldFraction = baseKwh > 0 ? clamp(plan.shortfall / baseKwh, 0, 1) : 0;

  return {
    solarKwh: round1(solarKwh), solarRawKwh: round1(solarKwh), fissionKwh: round1(fissionKwh),
    generatedKwh: round1(solarKwh + fissionKwh), demandKwh: round1(plan.demand), baseKwh: round1(baseKwh),
    heatKwh: round1(heatKwh), nightKwh: round1(plan.nightDemand), batteryAtDuskKwh: round1(plan.afterDay),
    wastedKwh: round1(plan.wasted), shortfallKwh: round1(plan.shortfall), daylightHours: round1(daylight),
    coldFraction: Math.round(coldFraction * 100) / 100,
    thermalOk: plan.shortfall <= 0, running, shed, batteryAfter: plan.battery,
    // World missions only: true when the thermal bill is for chillers (hot outside), not heaters.
    ...(profile ? { hot: isHot(daylight > 0 ? dayTempC : nightTempC) } : {}),
  };
}

function lifeSupport(m, power, evaFlags) {
  const crewN = m.crew.length;
  const tenders = m.crew.filter((c, i) => c.task === 'greenhouse' && !evaFlags[i] && !sheltering(m));
  const botanistTending = tenders.some((c) => c.role === 'botanist');
  const r = power.running;

  const o2Need = sum(m.crew, (_c, i) => LIFE_SUPPORT.o2KgPerCrewDay * (evaFlags[i] ? evaO2MultiplierFor(m.profile) : 1));
  const waterNeed = crewN * LIFE_SUPPORT.waterKgPerCrewDay;
  const foodNeed = crewN * LIFE_SUPPORT.foodKgPerCrewDay;

  const recycled = r.recycler ? waterNeed * moduleById('recycler').recovery : 0;
  const mined = (r.iceDrill ?? 0) * moduleById('iceDrill').waterKg * (m.profile ? m.profile.iceAccess : m.site.iceAccess) * (1 + m.modifiers.iceBonus);
  const greenhouseUnits = r.greenhouse ?? 0;
  const greenhouseWater = greenhouseUnits * GREENHOUSE_WATER_KG;
  let water = m.resources.water - waterNeed + recycled + mined - greenhouseWater;

  const electrolysisWanted = (r.oxygen ?? 0) * 4;
  const electrolysisWater = Math.max(0, Math.min(electrolysisWanted, water));
  water -= electrolysisWater;
  let o2Made = electrolysisWater * LIFE_SUPPORT.waterToO2Ratio
    + (r.moxie ?? 0) * moduleById('moxie').o2Kg
    + (r.regolithO2 ?? 0) * moduleById('regolithO2').o2Kg;

  const gh = moduleById('greenhouse');
  let growth = m.greenhouse.growth;
  let grown = 0;
  if ((m.modules.greenhouse ?? 0) > 0) {
    growth = greenhouseUnits > 0 ? growth + 1 + 0.5 * tenders.length : Math.max(0, growth - 2);
    if (greenhouseUnits > 0 && growth >= gh.growSols) {
      grown = greenhouseUnits * gh.foodKg * (botanistTending ? 1.25 : 1) * (1 + 0.15 * tenders.length) * (m.greenhouse.perchlorate ? 0.5 : 1);
      o2Made += greenhouseUnits * gh.o2Kg;
    }
  }

  const o2 = m.resources.o2 + o2Made - o2Need;
  const food = m.resources.food + grown - foodNeed;
  return {
    o2: Math.max(0, o2), water: Math.max(0, water), food: Math.max(0, food),
    o2Deficit: o2 < 0, waterDeficit: water < 0, foodDeficit: food < 0,
    o2Need, o2Made, waterNeed, recycled, mined, electrolysisWater, greenhouseWater, foodNeed, grown,
    growth, freshFood: grown > 0,
  };
}

function crewWork(m, power, evaFlags) {
  const level = effectiveShieldLevel(m);
  const profile = m.profile;
  const gcr = gcrPerSol(m.config.body);
  const sep = m.today.sep;
  const sepScale = profile ? profile.flareDoseFactor : 1;
  const remoteFactor = outsideWorkFactor(m);
  const buildSpeed = profile ? profile.buildSpeed : 1;
  const roverBoost = power.running.rover ? 1.5 : 1;
  const stormPenalty = m.env.tau > 2 ? 0.6 : 1;
  const nightPenalty = m.env.lit ? 1 : 0.7;
  let science = 0;
  let dust = m.env.dust;
  let shieldWork = 0;
  let repairs = 0;
  let spares = m.resources.spares;
  let repairWork = m.repairWork;
  let broken = { ...m.broken };
  let sepDose = 0;

  const doses = m.crew.map((c, i) => {
    const eva = evaFlags[i];
    let dose = profile
      ? (eva ? evaDose(profile, level) : insideDose(profile, level))
      : eva ? gcr : gcr * SHIELDING.gcrFactor[level];
    if (sep) {
      const shelter = m.today.shelter;
      const factor = shelter === true ? SHIELDING.shelterSepFactor
        : shelter === 'partial' ? SHIELDING.sepFactor[Math.min(SHIELDING.maxLevel, level + 1)]
          : eva ? 1 : SHIELDING.sepFactor[level];
      const d = RADIATION.sepDoseMsv[sep.severity] * factor * sepScale;
      sepDose += d;
      dose += d;
    }
    return dose;
  });

  m.crew.forEach((c, i) => {
    if (sheltering(m)) return;
    const prod = c.morale < 30 ? 0.5 : 1;
    const eng = c.role === 'engineer' ? 1.5 : 1;
    if (c.task === 'science') {
      science += CREW.evaScience * m.site.science * roverBoost * (c.role === 'geologist' ? CREW.sciencePerGeologistBonus : 1) * prod * stormPenalty * nightPenalty * remoteFactor;
    } else if (c.task === 'shield') {
      shieldWork += prod * eng * buildSpeed * remoteFactor;
    } else if (c.task === 'maintain') {
      const brokenId = BREAKABLE.find((id) => (broken[id] ?? 0) > 0);
      if (brokenId) {
        if (spares > 0) {
          spares -= 1;
          broken = { ...broken, [brokenId]: broken[brokenId] - 1 };
          repairs += 1;
        } else {
          repairWork += prod * eng;
          if (repairWork >= 3) {
            repairWork = 0;
            broken = { ...broken, [brokenId]: broken[brokenId] - 1 };
            repairs += 1;
          }
        }
      } else if (evaFlags[i] || (isRemoteOnly(m) && hasOutsideJob(m, c))) {
        dust = Math.max(0, dust - 0.15 * eng * prod * remoteFactor);
      }
    }
  });

  return { doses, science, dust, shieldWork, repairs, spares, repairWork, broken, sepDose };
}

function nextCrew(m, life, power, doses, evaFlags) {
  const commander = m.crew.some((c) => c.role === 'commander' && c.health > 0);
  const deficit = life.o2Deficit || life.waterDeficit || life.foodDeficit;
  return m.crew.map((c, i) => {
    const resting = c.task === 'rest' || sheltering(m);
    let health = 0;
    if (life.o2Deficit) health -= 25;
    if (life.waterDeficit) health -= 10;
    if (life.foodDeficit) health -= 6;
    if (!power.thermalOk) health -= Math.ceil(POWER.coldHealthPerSol * power.coldFraction);
    const dose = c.doseMsv + doses[i];
    if (dose > RADIATION.careerLimitMsv) health -= 2;
    if (m.profile) health -= acuteHealthLoss(doses[i]);
    if (c.morale <= 0) health -= 2;
    if (!deficit && power.thermalOk) health += resting ? CREW.restHeal : 1;

    let morale = resting ? 3 : -1;
    if (evaFlags[i]) morale += 1;
    if (life.freshFood) morale += 1;
    if (power.running.relay) morale += 1;
    if (m.modifiers.blackout > 0) morale -= 1;
    if (!power.thermalOk) morale -= Math.ceil(POWER.coldMoralePerSol * power.coldFraction);
    if (deficit) morale -= 5;
    if (commander) morale += 1;

    return {
      ...c,
      health: clamp(c.health + health, 0, CREW.maxHealth),
      morale: clamp(c.morale + morale, 0, CREW.maxMorale),
      doseMsv: round1(dose),
    };
  });
}

function breakModule(m, id) {
  const mod = moduleById(id);
  return {
    ...m,
    broken: { ...m.broken, [id]: (m.broken[id] ?? 0) + 1 },
    stats: { ...m.stats, failures: m.stats.failures + 1 },
    log: [...m.log, { sol: m.sol, type: 'fail', text: `${mod.icon} ${mod.name} broke down! Assign someone to Maintain.` }],
  };
}

function rollFailures(m, rng) {
  const rate = (DIFFICULTY[m.config.difficulty] ?? DIFFICULTY.cadet).failRate;
  return BREAKABLE.reduce((acc, id) => (rng.chance(rate * workingCount(acc, id)) ? breakModule(acc, id) : acc), m);
}

const tick = (n) => Math.max(0, n - 1);

export function runSol(mission) {
  const alreadyRan = mission.lastReport?.sol === mission.sol;
  if (mission.status !== 'active' || mission.phase === 'event' || mission.sol === 0 || alreadyRan) return mission;
  const rng = rngFromState(mission.rngState);
  const m = mission;
  const evaFlags = m.crew.map((c) => isOnEva(m, c));
  const power = computePower(m);
  const life = lifeSupport(m, power, evaFlags);
  const work = crewWork(m, power, evaFlags);
  const crew = nextCrew(m, life, power, work.doses, evaFlags);

  const dustRate = m.profile
    ? m.profile.dustPerSol * (m.env.storm ? RULES.stormDustMultiplier : 1)
    : m.config.body === 'mars' ? (m.env.storm ? POWER.stormDustPerSol : POWER.dustPerSol) : 0.0005;
  const storm = m.env.storm && m.env.storm.solsLeft > 1 ? { ...m.env.storm, solsLeft: m.env.storm.solsLeft - 1 } : null;
  const firstHarvest = life.freshFood && !m.flags.harvest && !m.queue.some((q) => q.eventId === 'harvest');

  let next = {
    ...m,
    phase: 'plan',
    crew,
    broken: work.broken,
    repairWork: work.repairWork,
    science: round1(m.science + work.science),
    resources: { ...m.resources, o2: round1(life.o2), water: round1(life.water), food: round1(life.food), batteryKwh: round1(power.batteryAfter), spares: work.spares },
    env: { ...m.env, dust: clamp(work.dust + dustRate, 0, POWER.maxDust), storm },
    greenhouse: { ...m.greenhouse, growth: life.growth },
    modifiers: {
      ...m.modifiers,
      blackout: tick(m.modifiers.blackout),
      offline: Object.fromEntries(Object.entries(m.modifiers.offline).map(([id, n]) => [id, tick(n)]).filter(([, n]) => n > 0)),
    },
    queue: firstHarvest ? [...m.queue, { sol: m.sol + 1, eventId: 'harvest' }] : m.queue,
  };
  next = addShieldWork(next, work.shieldWork);

  const avgDoseToday = work.doses.reduce((s, d) => s + d, 0) / work.doses.length;
  const pct = m.capacity.batteryKwh > 0 ? (100 * power.batteryAfter) / m.capacity.batteryKwh : 100;
  next = {
    ...next,
    stats: {
      ...next.stats,
      shortfallSols: next.stats.shortfallSols + (power.shed.length ? 1 : 0),
      coldSols: next.stats.coldSols + (power.thermalOk ? 0 : 1),
      o2DeficitSols: next.stats.o2DeficitSols + (life.o2Deficit ? 1 : 0),
      waterDeficitSols: next.stats.waterDeficitSols + (life.waterDeficit ? 1 : 0),
      foodDeficitSols: next.stats.foodDeficitSols + (life.foodDeficit ? 1 : 0),
      o2Made: round1(next.stats.o2Made + life.o2Made),
      waterMined: round1(next.stats.waterMined + life.mined),
      waterRecycled: round1(next.stats.waterRecycled + life.recycled),
      foodGrown: round1(next.stats.foodGrown + life.grown),
      evaCrewSols: next.stats.evaCrewSols + evaFlags.filter(Boolean).length,
      repairs: next.stats.repairs + work.repairs,
      maxTau: Math.max(next.stats.maxTau, m.env.tau),
      sepSheltered: next.stats.sepSheltered + (m.today.sep && m.today.shelter ? 1 : 0),
      sepDoseMsv: round1(next.stats.sepDoseMsv + work.sepDose / m.crew.length),
      minBatteryPct: Math.min(next.stats.minBatteryPct, Math.round(pct)),
    },
  };
  next = rollFailures(next, rng);

  const report = {
    sol: m.sol, power, life,
    doseToday: round1(avgDoseToday), scienceToday: round1(work.science),
    shieldLevel: effectiveShieldLevel(next), evaCount: evaFlags.filter(Boolean).length,
  };
  next = {
    ...next,
    rngState: rng.state(),
    lastReport: report,
    history: [...next.history, snapshot(next, power, avgDoseToday)],
    log: [...next.log, ...solNotes(m, power, life)],
  };
  return checkEnd(next, life, power);
}

function snapshot(m, power, doseToday) {
  const avg = (fn) => Math.round(sum(m.crew, fn) / m.crew.length);
  return {
    sol: m.sol, o2: m.resources.o2, water: m.resources.water, food: m.resources.food,
    battery: m.resources.batteryKwh, generated: power.generatedKwh, demand: power.demandKwh,
    tau: m.env.tau, tempC: m.env.avgC, ls: m.env.ls, dust: Math.round(m.env.dust * 100),
    health: avg((c) => c.health), morale: avg((c) => c.morale),
    dose: round1(sum(m.crew, (c) => c.doseMsv - c.transitDoseMsv) / m.crew.length),
    doseToday: round1(doseToday), science: m.science, shield: effectiveShieldLevel(m),
  };
}

function solNotes(m, power, life) {
  const notes = [];
  if (power.shed.length) notes.push({ sol: m.sol, type: 'warn', text: `⚡ Not enough power: ${power.shed.map((id) => moduleById(id).name).join(', ')} switched off automatically.` });
  if (!power.thermalOk && power.hot) notes.push({ sol: m.sol, type: 'danger', text: `🥵 Power ran out! ${Math.round(power.coldFraction * 100)}% of the habitat's power was missing, so the chillers could not keep the heat out.` });
  else if (!power.thermalOk) notes.push({ sol: m.sol, type: 'danger', text: `🥶 Power ran out! ${Math.round(power.coldFraction * 100)}% of the habitat's power was missing, so the heaters could not keep it warm.` });
  else if (m.capacity.batteryKwh > 0 && power.nightKwh > 0 && power.batteryAfter <= 0.2 * m.capacity.batteryKwh) {
    notes.push({ sol: m.sol, type: 'warn', text: `🌙 The night needed ${Math.round(power.nightKwh)} kWh. Battery at dawn: only ${Math.round((100 * power.batteryAfter) / m.capacity.batteryKwh)}%.` });
  }
  if (life.o2Deficit) notes.push({ sol: m.sol, type: 'danger', text: '🫁 OXYGEN EMPTY! The crew is in danger.' });
  if (life.waterDeficit) notes.push({ sol: m.sol, type: 'danger', text: '💧 Out of water! The crew is getting dehydrated.' });
  if (life.foodDeficit) notes.push({ sol: m.sol, type: 'danger', text: '🥫 Out of food! The crew is going hungry.' });
  return notes;
}

function checkEnd(m, life, power) {
  const down = m.crew.find((c) => c.health <= 0);
  if (down) {
    const reason = life.o2Deficit ? 'oxygen' : life.waterDeficit ? 'water' : life.foodDeficit ? 'food' : !power.thermalOk ? (power.hot ? 'heat' : 'cold') : 'health';
    return {
      ...m, status: 'lost', lostReason: reason,
      log: [...m.log, { sol: m.sol, type: 'danger', text: `🚨 ${down.name} needed an emergency evacuation to orbit. Mission aborted.` }],
    };
  }
  if (m.sol >= m.config.targetSols) {
    return { ...m, status: 'won', log: [...m.log, { sol: m.sol, type: 'story', text: m.config.win }] };
  }
  return m;
}

// Runs one full sol, auto-picking an event choice. Used by tests and the "auto-pilot" button.
export function advance(mission, ctx, chooser = () => 0) {
  let m = beginSol(mission, ctx);
  if (m.phase === 'event') {
    const card = eventById(m.pendingEvent.id);
    const preferred = chooser(m, card);
    const index = card.choices[preferred] && choiceAvailable(m, card.choices[preferred])
      ? preferred
      : card.choices.findIndex((c) => choiceAvailable(m, c));
    m = resolveEvent(m, index);
  }
  return runSol(m);
}
