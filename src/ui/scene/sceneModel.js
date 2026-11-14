// The ONLY place the 3D layer reads MissionState. Everything the scenes draw comes from this plain object,
// so swapping the engine means touching one file. Tolerates a null state (Start screen, loading).
import { siteById, sitesForBody } from '../../data/sites.js';
import { clamp } from './sceneUtil.js';

export const SCENE_MODULE_IDS = ['solar', 'fission', 'battery', 'recycler', 'oxygen', 'moxie', 'regolithO2', 'iceDrill', 'greenhouse', 'shelter', 'rover', 'relay', 'spares'];

const MARS_SOL_HOURS = 24.66;

/**
 * @param {object|null} state MissionState (see docs/engine-contract.md)
 * @param {{ turnSeconds?: number, body?: string, siteId?: string }} [opts]
 *   turnSeconds: real seconds since this sol began; the sun drifts from mid-morning to late afternoon across the turn.
 *   body/siteId: fallbacks for the Start screen when there is no mission.
 */
export function sceneModelFrom(state, opts = {}) {
  const body = state?.body === 'moon' || (!state && opts.body === 'moon') ? 'moon' : 'mars';
  const siteSrc = state?.site ?? siteById(opts.siteId) ?? sitesForBody(body)[0] ?? null;
  const site = siteSrc ? { id: siteSrc.id, lat: siteSrc.lat ?? 0, lon: siteSrc.lon ?? 0, name: siteSrc.name ?? '' } : { id: null, lat: 0, lon: 0, name: '' };

  const env = state?.env ?? {};
  const power = state?.power ?? {};
  const lit = body === 'moon' ? env.lit !== false : true;
  const daylightHours = Number.isFinite(power.daylightHours) ? power.daylightHours : body === 'moon' ? (lit ? 24 : 0) : 12.3;
  const daylightFraction = clamp(daylightHours / (body === 'moon' ? 24 : MARS_SOL_HOURS), 0, 1);

  // Whole-sol phase: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. Drifts from mid-morning (0.34) to late
  // afternoon (0.66) over ~2 real minutes so the shadows creep while the player thinks.
  const drift = clamp((opts.turnSeconds ?? 0) / 120, 0, 1);
  const timeOfSol = 0.34 + 0.32 * drift;

  const tau = Number.isFinite(env.tau) ? env.tau : body === 'moon' ? 0 : 0.5;
  const stormSols = env.stormSols ?? 0;
  const batteryMax = power.batteryMaxKwh ?? 0;
  const batteryPct = batteryMax > 0 ? clamp((power.batteryKwh ?? 0) / batteryMax, 0, 1) : 0;

  const modules = {};
  for (const [id, count] of Object.entries(state?.modules ?? {})) {
    if (!count) continue;
    const off = state?.offline?.[id] ?? null;
    modules[id] = { count, online: !off, reason: off?.reason ?? null };
  }
  const solarCount = modules.solar?.count ?? 0;
  const fissionCount = modules.fission?.count ?? 0;

  return {
    body,
    site,
    sol: state?.sol ?? 0,
    lengthSols: state?.lengthSols ?? 0,
    timeOfSol,
    lockTime: false,
    daylightFraction,
    lit,
    tau,
    dust: clamp(env.dust ?? 0, 0, 1),
    stormActive: stormSols > 0 || Boolean(state?.flags?.storm),
    stormSols,
    sepActive: Boolean(state?.flags?.activeSep),
    blackout: (env.blackoutSols ?? 0) > 0,
    batteryPct,
    solarOn: solarCount > 0 && modules.solar.online && lit,
    fissionOn: fissionCount > 0 && modules.fission.online,
    modules,
    shieldLevel: clamp(state?.shielding?.level ?? 0, 0, 3),
    shelterMode: state?.shielding?.shelterMode ?? null,
    crewOutside: stormSols > 0 ? null : state?.lastSol?.budget?.evaCrew ?? null, // nobody walks in a storm
    tempC: Number.isFinite(env.avgC) ? env.avgC : Number.isFinite(env.maxC) && Number.isFinite(env.minC) ? (env.maxC + env.minC) / 2 : null,
    minC: env.minC ?? null,
    maxC: env.maxC ?? null,
    ls: state?.ls ?? null,
    season: state?.season ?? null,
    over: Boolean(state?.status?.over),
    pendingCard: Boolean(state?.pendingCard),
    hasMission: Boolean(state),
  };
}

/** Dev-only presets, applied from `?scene=storm,night,sep,blackout,eva,moon`. Handy for screenshots and the demo video. */
export const SCENE_PRESETS = {
  storm: (m) => ({ ...m, body: 'mars', tau: 4.2, dust: 0.65, stormActive: true, stormSols: 3, lit: true, crewOutside: null }),
  night: (m) => ({ ...m, timeOfSol: 0.93, lockTime: true, lit: m.body === 'moon' ? false : m.lit }),
  sep: (m) => ({ ...m, sepActive: true }),
  blackout: (m) => ({ ...m, blackout: true }),
  eva: (m) => ({ ...m, crewOutside: m.crewOutside ?? 'Zuri' }),
  moon: (m) => {
    const site = siteById('tranquility');
    return { ...m, body: 'moon', site: { id: site.id, lat: site.lat, lon: site.lon, name: site.name }, tau: 0, dust: 0, stormActive: false };
  },
  shackleton: (m) => {
    const site = siteById('shackleton');
    return { ...m, body: 'moon', site: { id: site.id, lat: site.lat, lon: site.lon, name: site.name }, tau: 0, dust: 0, stormActive: false };
  },
  offline: (m) => ({ ...m, modules: Object.fromEntries(Object.entries(m.modules).map(([id, v]) => [id, id === 'solar' || id === 'relay' ? { ...v, online: false, reason: 'broken' } : v])) }),
  shield: (m) => ({ ...m, shieldLevel: 3 }),
  full: (m) => ({
    ...m,
    modules: Object.fromEntries(SCENE_MODULE_IDS.filter((id) => (m.body === 'moon' ? id !== 'moxie' : id !== 'regolithO2')).map((id) => [id, { count: id === 'solar' ? 4 : id === 'battery' ? 2 : 1, online: true, reason: null }])),
  }),
};

export function applyScenePresets(model, names) {
  let m = model;
  for (const name of String(names ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const fn = SCENE_PRESETS[name];
    if (fn) m = fn(m);
  }
  return m;
}
