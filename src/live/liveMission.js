// "Today's real Sun": a free-play mission driven by live NASA DONKI space weather.
//
// How real events reach the game, honestly:
//  - The mission calendar is real. It starts `lookbackDays` before today, so its early sols are real days
//    that already happened, one sol reaches TODAY, and the last few sols are still in the future.
//  - Every real SEP event becomes a storm on the sol of its real timestamp (card `sun_live_sep`).
//  - Every real X or M flare that NASA did not link to an SEP becomes a smaller "storm watch" on its real
//    sol (card `sun_live_flare`; X = moderate, M = minor). The card says no radiation storm was recorded.
//  - Sols after today cannot have recorded events. They get forecast drills (card `sun_forecast`, clearly a
//    forecast): one for each CME that NASA's model predicts will arrive at the mission's world, plus a
//    seeded roll per sol whose chance comes from today's radiationRisk.
// Everything is frozen into config.live when the mission is built, and the forecast roll is seeded by the
// mission code, so a saved mission (and a re-run with the same code and snapshot) replays identically.
import { createRng } from '../engine/rng.js';
import { classifySepEvents, flareStrength } from '../engine/spaceWeather.js';
import { missionById, liveFreePlayConfig } from '../data/missions.js';
import { missionDateMs } from '../engine/sim.js';
import { kidDate } from './liveData.js';

const DAY = 864e5;
const LINK_WINDOW_MS = 48 * 3600 * 1000;
const MERGE_WINDOW_MS = 24 * 3600 * 1000;
/** Chance of a forecast drill on each future sol, by today's radiationRisk 0–3. */
export const FORECAST_CHANCE = [0.05, 0.12, 0.25, 0.45];
const SEVERITY_ORDER = { minor: 0, moderate: 1, major: 2 };

const isoDay = (t) => new Date(t).toISOString().slice(0, 10);

function ageWords(eventMs, launchMs) {
  const days = Math.max(0, Math.round((Date.parse(`${isoDay(launchMs)}T00:00:00Z`) - Date.parse(`${isoDay(eventMs)}T00:00:00Z`)) / DAY));
  if (days === 0) return 'the same day this mission launched';
  if (days === 1) return 'the day before this mission launched';
  return `${days} days before this mission launched`;
}

/**
 * Compact live DONKI data -> sim storm list ({ time, flareClass, severity } plus live labels).
 * Real SEPs keep the engine's own classification; unlinked X/M flares become lower-severity watches.
 * @param {{ flares?: object[], seps?: object[] }} donki compact shape from normalizeDonki
 * @param {{ launchMs?: number }} [opts]
 */
export function liveSeps(donki, { launchMs = Date.now() } = {}) {
  const flares = (donki?.flares ?? []).filter((f) => f.t && f.c).map((f) => ({ ...f, time: Date.parse(f.t) })).filter((f) => Number.isFinite(f.time));
  const sepTimes = (donki?.seps ?? []).map((s) => Date.parse(s.t)).filter(Number.isFinite);
  const urlAt = (list, time) => list.find((e) => Date.parse(e.t) === time)?.url ?? null;

  const real = classifySepEvents({ flares: donki?.flares ?? [], seps: donki?.seps ?? [] }).map((s) => ({
    ...s, kind: 'sep', live: true, cardId: 'sun_live_sep', url: urlAt(donki?.seps ?? [], s.time),
  }));

  const linked = (f) => sepTimes.some((t) => f.time <= t && t - f.time <= LINK_WINDOW_MS);
  const watches = flares
    .filter((f) => /^[XM]/i.test(f.c) && !linked(f))
    .sort((a, b) => a.time - b.time)
    .map((f) => ({ time: f.time, flareClass: f.c, severity: /^X/i.test(f.c) ? 'moderate' : 'minor', kind: 'flare', live: true, cardId: 'sun_live_flare', url: f.url ?? null }))
    // One watch a day: keep the strongest flare of each 24 h burst.
    .reduce((merged, w) => {
      const last = merged[merged.length - 1];
      if (last && w.time - last.time < MERGE_WINDOW_MS) {
        return flareStrength(w.flareClass) > flareStrength(last.flareClass) ? [...merged.slice(0, -1), { ...w, time: last.time }] : merged;
      }
      return [...merged, w];
    }, []);

  // A flare watch within a day of a real SEP is dropped: the real storm wins.
  const kept = watches.filter((w) => !real.some((s) => Math.abs(s.time - w.time) < MERGE_WINDOW_MS));
  return [...real, ...kept]
    .filter((s) => s.time <= launchMs)
    .sort((a, b) => a.time - b.time)
    .map((s) => ({ ...s, vars: { liveAge: ageWords(s.time, launchMs), liveKind: s.kind } }));
}

/** Merge storm lists by time; a stronger storm replaces a weaker one in the same 24 h. */
export function mergeSeps(base = [], extra = []) {
  return [...base, ...extra].sort((a, b) => a.time - b.time).reduce((out, s) => {
    const last = out[out.length - 1];
    if (last && s.time - last.time < MERGE_WINDOW_MS && Boolean(last.live) === Boolean(s.live)) {
      return SEVERITY_ORDER[s.severity] > SEVERITY_ORDER[last.severity] ? [...out.slice(0, -1), s] : out;
    }
    return [...out, s];
  }, []);
}

const solDateMs = (startDate, body, sol) => missionDateMs({ startDate, body }, sol);

/**
 * Forecast drills for the sols after today. Deterministic for a given code + snapshot.
 * @returns {{ sol: number, eventId: 'sun_forecast', why: 'nasa-model'|'risk-roll', time?: string }[]}
 */
export function forecastSols({ code, startDate, body, targetSols, todaySol, radiationRisk, arrivals = [] }) {
  const rng = createRng(`${code}|live-forecast|${startDate}`);
  const where = body === 'mars' ? 'Mars' : 'Earth';
  const out = [];
  for (let sol = todaySol + 1; sol <= targetSols; sol += 1) {
    const from = solDateMs(startDate, body, sol - 1);
    const to = solDateMs(startDate, body, sol);
    const predicted = arrivals.find((a) => a.where === where && Date.parse(a.time) >= from && Date.parse(a.time) < to);
    // Always draw, so the sequence does not depend on which sols have a NASA prediction.
    const rolled = rng.chance(FORECAST_CHANCE[radiationRisk] ?? FORECAST_CHANCE[0]);
    if (predicted) out.push({ sol, eventId: 'sun_forecast', why: 'nasa-model', time: predicted.time });
    else if (rolled) out.push({ sol, eventId: 'sun_forecast', why: 'risk-roll' });
  }
  return out;
}

/**
 * Builds the "Today's real Sun" mission config from a LiveNow snapshot.
 * @param {{ live: import('./liveData.js').LiveNow, body?: 'mars'|'moon', siteId?: string, targetSols?: number,
 *           difficulty?: string, code?: string, now?: number, lookbackDays?: number }} opts
 * @returns {{ config: object, seps: object[], todaySol: number, isLive: boolean, summary: string }}
 */
export function todaysSunMission({ live, body = 'mars', siteId, targetSols = 30, difficulty = 'cadet', code = 'SOL001', now = Date.now(), lookbackDays } = {}) {
  const sun = live?.sun;
  const isLive = sun?.source === 'live';
  const back = lookbackDays ?? Math.max(3, Math.min(28, Math.round(targetSols * 0.7)));
  const startDate = isoDay(now - back * DAY);
  const solLength = solDateMs(startDate, body, 1) - solDateMs(startDate, body, 0);
  const todaySol = Math.min(targetSols, Math.max(1, Math.ceil((now - solDateMs(startDate, body, 0)) / solLength)));
  const endMs = solDateMs(startDate, body, targetSols);
  // Saved (archive) records are years old: none of them belong on this calendar, so none are used.
  const seps = isLive ? liveSeps(live.donki, { launchMs: now }).filter((s) => s.time >= Date.parse(`${startDate}T12:00:00Z`) && s.time < endMs) : [];
  const radiationRisk = isLive ? sun.radiationRisk : 1;
  const scripted = forecastSols({ code, startDate, body, targetSols, todaySol, radiationRisk, arrivals: isLive ? (sun.forecast ?? []) : [] });
  const twin = missionById(body === 'mars' ? 'solar-storm' : 'long-night');
  const base = liveFreePlayConfig({
    body, siteId: siteId ?? twin.siteId, targetSols, difficulty, startDate,
    budgetKg: targetSols === twin.targetSols ? twin.budgetKg : undefined,
    recommended: targetSols === twin.targetSols ? twin.recommended : null,
  });
  const realCount = seps.length;
  const summary = isLive
    ? `${realCount} real Sun event${realCount === 1 ? '' : 's'} from NASA DONKI on ${todaySol} real days, then ${targetSols - todaySol} forecast day${targetSols - todaySol === 1 ? '' : 's'}.`
    : 'NASA could not be reached, so this run has no live Sun events, only practice forecasts.';
  const config = {
    ...base,
    scripted,
    intro: isLive
      ? `This mission runs on the real Sun. Your first ${body === 'mars' ? 'sol' : 'day'} is ${kidDate(startDate, now)}, and every solar flare and radiation storm NASA has recorded since then will reach your base on the day it really happened. Day ${todaySol} is today, ${kidDate(isoDay(now), now)}. After that nobody knows what the Sun will do, so Mission Control sends forecasts. ${sun.kidLine}`
      : 'This mission is meant to run on the real Sun, but NASA could not be reached just now. You will get practice forecasts instead of live events. Try again when you are online.',
    live: {
      source: isLive ? 'live' : 'archive',
      fetchedAt: sun?.fetchedAt ?? null,
      launchedAt: new Date(now).toISOString(),
      todaySol,
      radiationRisk,
      level: isLive ? sun.level : 'calm',
      headline: sun?.kidHeadline ?? '',
      seps,
      forecast: scripted,
      summary,
    },
  };
  return { config, seps, todaySol, isLive, summary };
}

/** Storms frozen into a live mission's config, or [] for campaign and ordinary free-play missions. */
export const missionLiveSeps = (mission) => mission?.config?.live?.seps ?? [];
