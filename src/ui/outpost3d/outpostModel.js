// The ONLY place the 3D outpost layer reads the mission. Everything outpostScene.js draws comes from the plain
// object built here, so a change to src/engine/sim.js means touching one file. Tolerates a null mission.
import { computePower, effectiveShieldLevel, isOnEva, workingCount, dayHours, turnHoursFor } from '../../engine/sim.js';
import { siteById, sitesForBody } from '../../data/sites.js';
import { clamp } from './sceneUtil.js';
import { dayKey, dayWord } from '../kid/words.js';

export const SCENE_MODULE_IDS = ['solar', 'fission', 'battery', 'recycler', 'oxygen', 'moxie', 'regolithO2', 'iceDrill', 'greenhouse', 'shelter', 'rover', 'relay', 'spares'];

const sitePlain = (s) => (s ? { id: s.id, lat: s.lat ?? 0, lon: s.lon ?? 0, name: s.name ?? '', iceAccess: s.iceAccess, tempDayC: s.tempDayC, tempNightC: s.tempNightC } : { id: null, lat: 0, lon: 0, name: '' });

/** Why a module is dark, in the order the player can act on it. */
function offReason(m, id, power) {
  if ((m.modifiers?.offline?.[id] ?? 0) > 0) return 'offline';
  if (workingCount(m, id) <= 0) return 'broken';
  if (m.enabled?.[id] === false) return 'switched off';
  if (id in (m.enabled ?? {}) && !(power.running?.[id] > 0)) return 'no power'; // shed by the power budget
  return null;
}

/**
 * @param {object|null} m sim.js mission
 * @param {{ turnSeconds?: number, body?: string, worldId?: string, siteId?: string, reducedMotion?: boolean }} [opts]
 *   turnSeconds: real seconds since this sol began; the sun drifts from mid-morning to late afternoon across the turn.
 *   body/siteId: fallbacks when there is no mission.
 */
export function outpostModelFrom(m, opts = {}) {
  const body = (m?.config?.body ?? opts.body) === 'moon' ? 'moon' : 'mars';
  const site = sitePlain(m?.site ?? siteById(m?.config?.siteId ?? opts.siteId) ?? sitesForBody(body)[0]);
  const env = m?.env ?? {};
  const power = m ? computePower(m) : null;
  // Worlds other than the Moon and Mars carry an engine profile: their turn length and daylight come from it.
  const profiled = Boolean(m?.profile);
  const lit = profiled || body === 'moon' ? env.lit !== false : true;
  const hours = profiled ? turnHoursFor(m) : dayHours(body);
  const fallbackDaylight = profiled && Number.isFinite(env.daylightHours) ? env.daylightHours : lit ? hours / (body === 'moon' ? 1 : 2) : 0;
  const daylightHours = Number.isFinite(power?.daylightHours) ? power.daylightHours : fallbackDaylight;
  const daylightFraction = clamp(daylightHours / hours, 0, 1);

  // Whole-sol phase: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. Drifts from mid-morning (0.34) to late
  // afternoon (0.66) over ~2 real minutes so the shadows creep while the player thinks.
  const drift = clamp((opts.turnSeconds ?? 0) / 120, 0, 1);
  const timeOfSol = 0.34 + 0.32 * drift;

  const tau = Number.isFinite(env.tau) ? env.tau : body === 'moon' ? 0 : 0.5;
  const storm = body === 'mars' ? env.storm ?? null : null;
  const stormActive = Boolean(storm) || (body === 'mars' && tau >= 2);
  const cap = m?.capacity?.batteryKwh ?? 0;
  const batteryPct = cap > 0 ? clamp((m.resources?.batteryKwh ?? 0) / cap, 0, 1) : 0;

  const modules = {};
  for (const [id, count] of Object.entries(m?.modules ?? {})) {
    if (!count) continue;
    const reason = offReason(m, id, power);
    modules[id] = { count, online: !reason, reason };
  }

  const sheltering = Boolean(m?.today?.shelter);
  const playing = Boolean(m) && m.status === 'active' && m.sol > 0;
  const outside = playing && !sheltering && !stormActive ? m.crew.filter((c) => c.health > 0 && isOnEva(m, c)) : [];
  const crewOutside = outside.length ? (outside.length > 1 ? `${outside.length} crew` : outside[0].name.split(' ')[0]) : null;

  return {
    body,
    // Which world's look to paint (src/render/worldLook.js). The Moon and Mars keep their Trek terrain.
    worldId: m?.config?.worldId ?? opts.worldId ?? body,
    site,
    sol: m?.sol ?? 0,
    lengthSols: m?.config?.targetSols ?? 0,
    timeOfSol,
    lockTime: false,
    daylightFraction,
    lit,
    tau,
    dust: clamp(env.dust ?? 0, 0, 1),
    stormActive,
    stormSols: storm?.solsLeft ?? 0,
    sepActive: Boolean(m?.today?.sep) || m?.pendingEvent?.id === 'sep_alert',
    blackout: (m?.modifiers?.blackout ?? 0) > 0,
    batteryPct,
    solarOn: Boolean(modules.solar?.online) && lit && (power?.solarKwh ?? 0) > 0,
    fissionOn: Boolean(modules.fission?.online) && (power?.fissionKwh ?? 0) > 0,
    modules,
    shieldLevel: m ? clamp(effectiveShieldLevel(m), 0, 3) : 0,
    shelterMode: sheltering ? (m.today.shelter === true ? 'shelter' : 'partial') : null,
    crewOutside,
    tempC: Number.isFinite(env.avgC) ? env.avgC : Number.isFinite(env.maxC) && Number.isFinite(env.minC) ? (env.maxC + env.minC) / 2 : null,
    minC: env.minC ?? null,
    maxC: env.maxC ?? null,
    ls: env.ls ?? null,
    over: Boolean(m) && m.status !== 'active',
    pendingCard: m?.phase === 'event' && Boolean(m?.pendingEvent),
    hasMission: Boolean(m),
    dayUnit: dayWord(dayKey(m?.config), { cap: true }), // 'Sol' on Mars, 'Day' everywhere else
    reducedMotion: Boolean(opts.reducedMotion),
  };
}

/** Dev-only presets, applied from `?scene=storm,night,sep,blackout,eva,moon`. Handy for screenshots and the demo video. */
export const SCENE_PRESETS = {
  storm: (m) => ({ ...m, body: 'mars', worldId: 'mars', tau: 4.2, dust: 0.65, stormActive: true, stormSols: 3, lit: true, crewOutside: null }),
  night: (m) => ({ ...m, timeOfSol: 0.93, lockTime: true, lit: m.body === 'moon' ? false : m.lit }),
  sep: (m) => ({ ...m, sepActive: true }),
  blackout: (m) => ({ ...m, blackout: true }),
  eva: (m) => ({ ...m, crewOutside: m.crewOutside ?? 'Zuri' }),
  moon: (m) => ({ ...m, body: 'moon', worldId: 'moon', site: sitePlain(siteById('tranquility')), tau: 0, dust: 0, stormActive: false }),
  shackleton: (m) => ({ ...m, body: 'moon', worldId: 'moon', site: sitePlain(siteById('shackleton')), tau: 0, dust: 0, stormActive: false }),
  offline: (m) => ({ ...m, modules: Object.fromEntries(Object.entries(m.modules).map(([id, v]) => [id, id === 'solar' || id === 'relay' ? { ...v, online: false, reason: 'broken' } : v])) }),
  shield: (m) => ({ ...m, shieldLevel: 3 }),
  full: (m) => ({
    ...m,
    modules: Object.fromEntries(SCENE_MODULE_IDS.filter((id) => (m.body === 'moon' ? id !== 'moxie' : id !== 'regolithO2')).map((id) => [id, { count: id === 'solar' ? 4 : id === 'battery' ? 2 : 1, online: true, reason: null }])),
  }),
};

export function applyScenePresets(model, names) {
  let out = model;
  for (const name of String(names ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const fn = SCENE_PRESETS[name];
    if (fn) out = fn(out);
  }
  return out;
}
