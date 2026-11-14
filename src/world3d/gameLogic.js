// Pure real-time rules: day clock, sun position, suit oxygen and radiation dose.
import { RADIATION, SHIELDING, MOON } from '../data/constants.js';
import { marsSolarDeclinationDeg } from '../engine/solar.js';
import { clamp } from './rng.js';

const DEG = Math.PI / 180;

export const DIFFICULTY_TUNING = {
  cadet: { daySeconds: 240, o2Seconds: 210, hazardRate: 0.6, stormLead: 45, repairSeconds: 100, minigameEase: 1.3 },
  specialist: { daySeconds: 210, o2Seconds: 160, hazardRate: 1, stormLead: 35, repairSeconds: 80, minigameEase: 1 },
  commander: { daySeconds: 180, o2Seconds: 125, hazardRate: 1.4, stormLead: 25, repairSeconds: 60, minigameEase: 0.85 },
};

export function tuningFor(difficulty = 'cadet', { daySeconds, assist = false } = {}) {
  const base = DIFFICULTY_TUNING[difficulty] ?? DIFFICULTY_TUNING.cadet;
  const day = Number.isFinite(daySeconds) && daySeconds >= 30 ? daySeconds : base.daySeconds;
  return {
    ...base,
    daySeconds: day,
    o2Seconds: base.o2Seconds * (assist ? 1.5 : 1),
    stormLead: base.stormLead + (assist ? 15 : 0),
    repairSeconds: base.repairSeconds * (assist ? 1.4 : 1),
    minigameEase: base.minigameEase * (assist ? 1.4 : 1),
    assist,
  };
}

// A playable sol runs from 06:00 to 19:30 local time.
export const DAY_START_H = 6;
export const DAY_SPAN_H = 13.5;
export const DUSK_T = 0.8;

export function dayClock(elapsed, daySeconds) {
  const t = clamp(elapsed / daySeconds, 0, 1.2);
  const hours = DAY_START_H + Math.min(t, 1) * DAY_SPAN_H;
  const phase = t >= 1 ? 'night' : t >= DUSK_T ? 'dusk' : t < 0.06 ? 'dawn' : 'day';
  return { t, hours, phase, duskWarning: t >= DUSK_T, nightfall: t >= 1, secondsLeft: Math.max(0, daySeconds - elapsed) };
}

export function formatClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const gameHoursPerSecond = (daySeconds) => DAY_SPAN_H / daySeconds;

const fromAltAz = (el, az) => ({
  x: Math.cos(el) * Math.sin(az),
  y: Math.sin(el),
  z: -Math.cos(el) * Math.cos(az), // north is -z, so the noon sun in the north hemisphere is towards +z
  elevationDeg: el / DEG,
});

function marsSun(lat, ls, hours) {
  const phi = lat * DEG;
  const delta = marsSolarDeclinationDeg(ls ?? 0) * DEG;
  const h = ((hours - 12) / 12) * Math.PI;
  const el = Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h) * Math.cos(delta), Math.sin(delta) * Math.cos(phi) - Math.cos(delta) * Math.sin(phi) * Math.cos(h));
  return fromAltAz(el, az);
}

function moonSun(site, sol, t, lit, phaseOffsetDays = 0) {
  const days = sol + t + phaseOffsetDays;
  if (Math.abs(site.lat) > 80) {
    // Polar rim: the Sun circles the horizon once a month and never climbs high. Long, sharp shadows.
    const az = (days / MOON.synodicDays) * 2 * Math.PI + 0.8;
    const el = lit ? (5 + 1.5 * Math.sin(days * 0.7)) * DEG : -6 * DEG;
    return fromAltAz(el, az);
  }
  const p = (((days % MOON.synodicDays) + MOON.synodicDays) % MOON.synodicDays) / MOON.synodicDays;
  const dayFrac = site.sunlit ?? 0.5;
  if (!lit || p >= dayFrac) return fromAltAz(-20 * DEG, Math.PI * 1.5);
  const k = p / dayFrac; // 0 sunrise (east) -> 1 sunset (west)
  const el = Math.max(3 * DEG, Math.sin(k * Math.PI) * (88 - Math.abs(site.lat)) * DEG);
  return fromAltAz(el, k < 0.5 ? Math.PI / 2 : Math.PI * 1.5);
}

export function sunDirection(mission, t) {
  const body = mission.config?.body ?? 'mars';
  const hours = DAY_START_H + clamp(t, 0, 1.2) * DAY_SPAN_H;
  if (body === 'moon') return moonSun(mission.site ?? { lat: 0 }, mission.sol ?? 0, t, mission.env?.lit !== false, mission.config?.phaseOffsetDays ?? 0);
  return marsSun(mission.site?.lat ?? 0, mission.env?.ls ?? 0, hours);
}

// Earth hangs nearly still in the lunar sky: overhead at the near-side centre, on the horizon at the poles.
export function earthDirection(site) {
  const cosd = Math.cos((site?.lat ?? 0) * DEG) * Math.cos((site?.lon ?? 0) * DEG);
  const el = Math.max(7 * DEG, Math.asin(clamp(cosd, -1, 1)));
  const az = (site?.lat ?? 0) < 0 ? 0 : Math.PI; // towards the equator
  return fromAltAz(el, az + 0.35);
}

// ---------- Suit oxygen ----------
export const O2_LOW = 0.25;
export const O2_CRITICAL = 0.1;
export const O2_REFILL_PER_S = 0.35;

export function suitO2Step(o2, { dt, outside, refilling = false, o2Seconds, running = false, cold = false }) {
  if (refilling || !outside) return clamp(o2 + dt * O2_REFILL_PER_S, 0, 1);
  const rate = (1 / o2Seconds) * (running ? 1.35 : 1) * (cold ? 1.4 : 1);
  return clamp(o2 - dt * rate, 0, 1);
}

// ---------- Radiation (mSv per in-game hour) ----------
const SEP_HOURS = 3;

export function doseRatePerHour({ body = 'mars', outside, shelter = false, shieldLevel = 0, sepSeverity = null }) {
  const perSol = body === 'moon' ? RADIATION.moonSurfaceMsvPerDay : RADIATION.marsSurfaceGcrMsvPerSol;
  const hours = body === 'moon' ? 24 : 24.66;
  const level = clamp(Math.round(shieldLevel), 0, SHIELDING.maxLevel);
  const gcr = (perSol / hours) * (outside ? 1 : SHIELDING.gcrFactor[level]);
  if (!sepSeverity) return gcr;
  const sepFull = (RADIATION.sepDoseMsv[sepSeverity] ?? RADIATION.sepDoseMsv.minor) / SEP_HOURS;
  const factor = outside ? 1 : shelter ? SHIELDING.shelterSepFactor : SHIELDING.sepFactor[level];
  return gcr + sepFull * factor;
}

// ---------- Penalties reported to the coordinator ----------
export const PENALTY = {
  night: 4, // health points for being caught outside after dark
  o2: 8,
  cold: 3,
};

export function radiationPenalty(sepSeverity) {
  return Math.round((RADIATION.sepDoseMsv[sepSeverity] ?? RADIATION.sepDoseMsv.minor) * 10) / 10;
}
