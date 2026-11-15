// Mission Control's recommended pack for any world, worked out from the same profile the simulation uses.
// Pure: (world, site, mission length) in, { modules, supplies } out.
import { POWER, LIFE_SUPPORT } from '../data/constants.js';
import { SUPPLIES, moduleById, modulesForWorld } from '../data/modules.js';
import { worldProfile, defaultSite, daylightHoursAt, worldSolarKwh, thermalKw } from './worldModel.js';

const CREW_COUNT = 4;
const SHORT_MISSION_SOLS = 20; // up to here, carrying air and water weighs less than the machines that make them
const DEMAND_MARGIN = 1.05;
const PANEL_DERATE = 0.25; // dust and wear the pack should shrug off
const STORM_PANEL_DERATE = 0.7; // a dust storm (tau 3) passes about a third of the light
const OXYGEN_MARGIN = 1.25;
const WATER_MARGIN = 1.2;
const FOOD_MARGIN = 1.15;
const OXYGEN_RESERVE_KG = 60; // extra kept on hand when a machine, which can break, makes the oxygen
const WATER_RESERVE_KG = 150; // same, for water
const DRILL_MIN_ICE_ACCESS = 0.5;
const ELECTROLYSIS_WATER_KG = 4; // per Oxygen Generator per turn (src/engine/sim.js)
const BASE_SPARES = 2;
const SOLS_PER_EXTRA_SPARE = 40;
const BUDGET_HEADROOM = 1.1;
const BUDGET_STEP_KG = 50;
const FALLBACK_POWER = { solar: 0, battery: 0, fission: 3 };
const NO_MACHINES = [];
// Long missions try the fullest life-support kit first and drop machines the power supply cannot run.
const MACHINE_KITS = [['recycler', 'oxygen', 'iceDrill'], ['recycler', 'oxygen'], ['recycler'], NO_MACHINES];

const roundUp = (v, step) => Math.ceil(v / step) * step;
const maxOf = (id) => moduleById(id).max;

export function packMassKg({ modules = {}, supplies = {} }) {
  const moduleMass = Object.entries(modules).reduce((s, [id, n]) => s + (moduleById(id)?.massKg ?? 0) * n, 0);
  const supplyMass = SUPPLIES.reduce((s, item) => s + (supplies[item.id] ?? 0) * item.packMass, 0);
  return Math.round(moduleMass + supplyMass);
}

// Runs the dawn → dusk → dawn power budget (same shape as computePower in sim.js) for a candidate power kit.
function powerHolds(profile, kit, machineKw, sols) {
  const capacity = kit.battery * moduleById('battery').storageKwh;
  const fissionKw = kit.fission * moduleById('fission').outputKw;
  const derate = profile.stormChance > 0 ? STORM_PANEL_DERATE : PANEL_DERATE;
  const kwAt = (tempC) => (POWER.habitatBaseKw + thermalKw(profile, tempC)) * DEMAND_MARGIN + machineKw;
  let battery = capacity;
  for (let sol = 1; sol <= sols; sol += 1) {
    const daylight = daylightHoursAt(profile, sol);
    const night = profile.turnHours - daylight;
    const solar = worldSolarKwh(profile, { areaM2: kit.solar * moduleById('solar').areaM2, daylightHours: daylight, dust: derate });
    battery += solar + (fissionKw - kwAt(profile.tempLitC)) * daylight;
    if (battery < 0) return false;
    battery = Math.min(battery, capacity) + (fissionKw - kwAt(profile.tempDarkC)) * night;
    if (battery < 0) return false;
    battery = Math.min(battery, capacity);
  }
  return true;
}

const kitMass = (kit) => kit.solar * moduleById('solar').massKg + kit.battery * moduleById('battery').massKg + kit.fission * moduleById('fission').massKg;

// The lightest mix of solar arrays, batteries and fission units that never runs dry over the mission.
function lightestPowerKit(profile, machineKw, sols, solarAllowed) {
  let best = null;
  for (let fission = 0; fission <= maxOf('fission'); fission += 1) {
    for (let solar = 0; solar <= (solarAllowed ? maxOf('solar') : 0); solar += 1) {
      for (let battery = 0; battery <= maxOf('battery'); battery += 1) {
        const kit = { solar, battery, fission };
        if (solar + fission === 0 || (best && kitMass(kit) >= kitMass(best))) continue;
        if (powerHolds(profile, kit, machineKw, sols)) best = kit;
      }
    }
  }
  return best;
}

// Supplies for a mission that runs the given machines: enough to cover what the machines do not make, plus margin.
function suppliesFor(profile, sols, machines) {
  const has = (id) => machines.includes(id);
  const crewTurns = CREW_COUNT * sols;
  const o2Used = CREW_COUNT * LIFE_SUPPORT.o2KgPerCrewDay * (profile.remote ? 1 : profile.evaO2Multiplier);
  const o2Made = has('oxygen') ? ELECTROLYSIS_WATER_KG * LIFE_SUPPORT.waterToO2Ratio : 0;
  const waterUsed = CREW_COUNT * LIFE_SUPPORT.waterKgPerCrewDay * (has('recycler') ? 1 - moduleById('recycler').recovery : 1)
    + (has('oxygen') ? ELECTROLYSIS_WATER_KG : 0);
  const waterMined = has('iceDrill') ? moduleById('iceDrill').waterKg * profile.iceAccess : 0;
  return {
    o2: roundUp((has('oxygen') ? OXYGEN_RESERVE_KG : 0) + Math.max(0, o2Used - o2Made) * sols * OXYGEN_MARGIN, 10),
    water: roundUp((machines.length ? WATER_RESERVE_KG : 0) + Math.max(0, waterUsed - waterMined) * sols * WATER_MARGIN, 10),
    food: roundUp(crewTurns * LIFE_SUPPORT.foodKgPerCrewDay * FOOD_MARGIN, 10),
  };
}

function machineKits(profile, sols, allowed) {
  if (sols <= SHORT_MISSION_SOLS) return [NO_MACHINES];
  const drillWorthIt = allowed.includes('iceDrill') && profile.iceAccess >= DRILL_MIN_ICE_ACCESS;
  return MACHINE_KITS.filter((kit) => drillWorthIt || !kit.includes('iceDrill'));
}

/**
 * @param {import('../data/worlds.js').World} world
 * @param {object} [site] landing site (defaults to the world's stand-in site)
 * @param {number} [targetSols]
 * @returns {{ modules: Record<string, number>, supplies: { o2: number, water: number, food: number } }}
 */
export function recommendedLoadout(world, site = defaultSite(world), targetSols = 10) {
  const profile = worldProfile(world, site);
  const allowed = modulesForWorld(world, site).map((mod) => mod.id);
  const solarAllowed = allowed.includes('solar');
  const plans = machineKits(profile, targetSols, allowed).map((machines) => {
    const machineKw = machines.reduce((s, id) => s + moduleById(id).kw, 0);
    return { machines, power: lightestPowerKit(profile, machineKw, targetSols, solarAllowed) };
  });
  const plan = plans.find((p) => p.power) ?? { machines: NO_MACHINES, power: FALLBACK_POWER };
  // A base that runs on sunlight alone carries one array more than it needs, so one breakdown is not a blackout.
  const power = plan.power.fission === 0 ? { ...plan.power, solar: Math.min(maxOf('solar'), plan.power.solar + 1) } : plan.power;
  const modules = {
    ...power, ...Object.fromEntries(plan.machines.map((id) => [id, 1])),
    ...(profile.flareChance > 0 ? { shelter: 1 } : {}),
    spares: BASE_SPARES + Math.floor(targetSols / SOLS_PER_EXTRA_SPARE),
  };
  return {
    modules: Object.fromEntries(Object.entries(modules).filter(([, n]) => n > 0)),
    supplies: suppliesFor(profile, targetSols, plan.machines),
  };
}

/** Lander mass limit that always leaves room for the recommended pack, never below the standard free-play budget. */
export function worldBudgetKg(recommended, standardBudgetKg) {
  return Math.max(standardBudgetKg, roundUp(packMassKg(recommended) * BUDGET_HEADROOM, BUDGET_STEP_KG));
}
