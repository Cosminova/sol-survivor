// Live NASA data. The UI only calls loadLive / onLive / liveHealth / liveRadiationBriefing.
// Every value carries `source` ('live' = fetched from NASA in this browser, 'archive' = bundled snapshot)
// and `recordedAt` (ISO time of the underlying NASA record), so the UI can label it honestly.
//
// Sources (all keyless, CORS *):
//   DONKI  https://ccmc.gsfc.nasa.gov/DONKI/WS/get/{FLR|CME|SEP|GST|notifications}?startDate=&endDate=
//   REMS   https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json   (1.7 MB: fetched only when a
//          Mars weather card is shown, once per session, kept 6 h. mars.nasa.gov answers 403 to headless browsers.)
// Behaviour: 5 DONKI requests in parallel, each with a 6 s AbortController timeout; results cached in
// localStorage for 30 minutes; concurrent calls share one request burst; a stale cache is served at once
// and refreshed in the background; any failure falls back to the bundled archive. loadLive never rejects.
//
// SUN RULES (classifySun). Times are measured back from "now"; every rule points at one real DONKI record.
//   stormy, radiationRisk 3: a solar energetic particle (SEP) event began in the last 72 h,
//                            or an X-class flare peaked in the last 48 h,
//                            or a geomagnetic storm reached Kp >= 7 in the last 72 h.
//   busy,   radiationRisk 2: an M-class flare peaked in the last 72 h,
//                            or an X-class flare peaked 48 h to 7 days ago,
//                            or an SEP event began 3 to 7 days ago,
//                            or a CME of 1000 km/s or faster in the last 72 h that NASA's WSA-ENLIL model sends to Earth or Mars,
//                            or any CME that the model predicts will arrive at Earth or Mars within the next 72 h.
//   calm,   radiationRisk 1: none of the above, but in the last 7 days there was an M-class flare,
//                            a geomagnetic storm of Kp >= 5, or a predicted CME arrival at Earth or Mars.
//   calm,   radiationRisk 0: none of the above.

/**
 * @typedef {{ kind: 'flare'|'cme'|'sep'|'storm'|'alert', time: string, label: string, kidLine: string, url?: string }} SunEvent
 * @typedef {{ level: 'calm'|'busy'|'stormy', kidHeadline: string, kidLine: string, events: SunEvent[],
 *             radiationRisk: 0|1|2|3, source: 'live'|'archive', recordedAt: string|null, fetchedAt: string|null,
 *             attribution: { name: string, url: string },
 *             reason?: { rule: string, text: string, event: SunEvent|null }, counts?: Record<string, number>,
 *             windowDays?: number, sourceLabel?: string, forecast?: { where: string, time: string, speed: number|null, url?: string }[] }} SunNow
 * @typedef {{ sol: number, earthDate: string, minC: number, maxC: number, pressurePa: number, sky: string, uv: string,
 *             source: 'live'|'archive', attribution: { name: string, url: string },
 *             recordedAt?: string, fetchedAt?: string|null, recordedLabel?: string, sourceLabel?: string,
 *             ls?: number|null, sunrise?: string|null, sunset?: string|null }} MarsNow
 * @typedef {{ sun: SunNow, mars: MarsNow|null, loadedAt: string, donki?: object, requests?: object[], cached?: boolean }} LiveNow
 */

export const DONKI_API = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get';
export const DONKI_HOME = 'https://ccmc.gsfc.nasa.gov/tools/DONKI/';
export const REMS_FEED = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json';
export const REMS_HOME = 'https://mars.nasa.gov/msl/weather/';
export const DONKI_KINDS = ['FLR', 'CME', 'SEP', 'GST', 'notifications'];
export const WINDOW_DAYS = 30;
export const FORECAST_DAYS = 3;
export const CACHE_TTL_MS = 30 * 60 * 1000;
export const DONKI_TIMEOUT_MS = 6000;
export const REMS_TIMEOUT_MS = 9000;
const CACHE_KEY = 'sol-survivor:live:v1';
const RETRY_AFTER_FAIL_MS = 60 * 1000;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DONKI_ATTRIBUTION = { name: 'NASA DONKI', url: DONKI_HOME };
const REMS_ATTRIBUTION = { name: 'NASA/JPL-Caltech Curiosity REMS', url: REMS_HOME };

// ---------- Pure helpers (unit-tested, no network) ----------

const ms = (iso) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : null;
};
const num = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);

/** "11 Nov" (adds the year when it is not the current one). */
export function kidDate(iso, now = Date.now()) {
  const t = ms(iso?.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (t == null) return 'an unknown date';
  const d = new Date(t);
  const sameYear = d.getUTCFullYear() === new Date(now).getUTCFullYear();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${sameYear ? '' : ` ${d.getUTCFullYear()}`}`;
}

/** "just now", "12 minutes ago", "2 hours ago", "3 days ago". */
export function relativeTime(iso, now = Date.now()) {
  const t = ms(iso);
  if (t == null) return 'at an unknown time';
  const diff = Math.max(0, now - t);
  if (diff < 90 * 1000) return 'just now';
  if (diff < 90 * 60 * 1000) return `${Math.round(diff / 60000)} minutes ago`;
  if (diff < 36 * HOUR) return `${Math.round(diff / HOUR)} hours ago`;
  return `${Math.round(diff / DAY)} days ago`;
}

/** The DONKI query window: the last 30 days plus 3 days ahead (model-predicted CME arrivals). */
export function donkiWindow(now = Date.now()) {
  return { startDate: isoDay(now - WINDOW_DAYS * DAY), endDate: isoDay(now + FORECAST_DAYS * DAY) };
}

export const donkiUrl = (kind, { startDate, endDate }) => `${DONKI_API}/${kind}?startDate=${startDate}&endDate=${endDate}`;

const flareLetter = (c) => String(c ?? '')[0]?.toUpperCase() ?? '';
const FLARE_WORD = { X: 'huge', M: 'medium', C: 'small', B: 'tiny', A: 'tiny' };
const FLARE_RANK = { A: 0, B: 1, C: 2, M: 3, X: 4 };
export const flareSize = (c) => (FLARE_RANK[flareLetter(c)] ?? 0) + Math.min(num(String(c ?? '').slice(1)) ?? 1, 9.9) / 10;

function summaryOf(body) {
  const text = String(body ?? '');
  const at = text.indexOf('## Summary:');
  const tail = (at >= 0 ? text.slice(at + 11) : text).split(/\n\s*##/)[0];
  const clean = tail.replace(/\s+/g, ' ').trim();
  const first = clean.split(/(?<=\.)\s+(?=[A-Z])/)[0] ?? '';
  return first.length > 240 ? `${first.slice(0, 237)}…` : first;
}

// One CME -> where NASA's WSA-ENLIL model says it will arrive (only Earth and Mars matter to the game).
function cmeArrivals(analysis) {
  const out = [];
  for (const run of analysis?.enlilList ?? []) {
    if (run?.estimatedShockArrivalTime) out.push({ where: 'Earth', t: run.estimatedShockArrivalTime });
    for (const hit of run?.impactList ?? []) {
      if (hit?.location === 'Mars' && hit.arrivalTime) out.push({ where: 'Mars', t: hit.arrivalTime });
    }
  }
  const seen = new Set();
  return out.filter((a) => (seen.has(a.where) ? false : seen.add(a.where)));
}

/**
 * Raw DONKI responses -> the compact shape the game keeps and caches.
 * @param {{ FLR?: object[], CME?: object[], SEP?: object[], GST?: object[], notifications?: object[] }} raw
 */
export function normalizeDonki(raw = {}) {
  const list = (v) => (Array.isArray(v) ? v : []);
  const byTime = (a, b) => (ms(a.t) ?? 0) - (ms(b.t) ?? 0);
  const flares = list(raw.FLR)
    .map((f) => ({ t: f.peakTime ?? f.beginTime, c: f.classType ?? null, loc: f.sourceLocation || null, region: f.activeRegionNum ?? null, url: f.link ?? null }))
    .filter((f) => ms(f.t) != null && f.c).sort(byTime);
  const cmes = list(raw.CME).map((c) => {
    const analyses = list(c.cmeAnalyses);
    const best = analyses.find((a) => a.isMostAccurate) ?? analyses[0] ?? null;
    return { t: c.startTime, v: num(best?.speed), type: best?.type ?? null, arrivals: cmeArrivals(best), url: c.link ?? null };
  }).filter((c) => ms(c.t) != null).sort(byTime);
  const seps = list(raw.SEP)
    .map((s) => ({ t: s.eventTime, id: s.sepID ?? null, url: s.link ?? null }))
    .filter((s) => ms(s.t) != null).sort(byTime);
  const storms = list(raw.GST).map((g) => ({
    t: g.startTime,
    kp: list(g.allKpIndex).reduce((hi, k) => Math.max(hi, num(k.kpIndex) ?? 0), 0),
    url: g.link ?? null,
  })).filter((g) => ms(g.t) != null).sort(byTime);
  const alerts = list(raw.notifications)
    .map((n) => ({ t: n.messageIssueTime, type: n.messageType ?? 'Report', id: n.messageID ?? null, url: n.messageURL ?? null, summary: summaryOf(n.messageBody) }))
    .filter((n) => ms(n.t) != null).sort(byTime);
  return { flares, cmes, seps, storms, alerts };
}

/** The bundled public/data/donki.json -> the same compact shape, limited to its own final 30 days. */
export function archiveDonki(donki) {
  const newest = Math.max(0, ...[...(donki?.flares ?? []), ...(donki?.cmes ?? []), ...(donki?.seps ?? [])].map((e) => ms(e.t) ?? 0));
  const from = newest - WINDOW_DAYS * DAY;
  const recent = (arr) => (arr ?? []).filter((e) => (ms(e.t) ?? 0) >= from);
  return {
    flares: recent(donki?.flares).map((f) => ({ t: f.t, c: f.c ?? null, loc: f.loc ?? null, region: null, url: null })).filter((f) => f.c),
    cmes: recent(donki?.cmes).map((c) => ({ t: c.t, v: num(c.v), type: null, arrivals: [], url: null })),
    seps: recent(donki?.seps).map((s) => ({ t: s.t, id: s.id ?? null, url: null })),
    storms: [],
    alerts: [],
  };
}

const ALERT_WORD = { FLR: 'solar flare', SEP: 'radiation storm', CME: 'Sun eruption', IPS: 'shock wave', MPC: 'magnetic field', GST: 'geomagnetic storm', RBE: 'radiation belt', Report: 'weekly report' };

/** Compact DONKI -> kid-readable event list, newest first. */
export function sunEvents(data, now = Date.now()) {
  const on = (t) => kidDate(t, now);
  const flares = (data?.flares ?? []).map((f) => ({
    kind: 'flare', time: f.t, label: `Flare ${f.c}`, url: f.url ?? undefined, flareClass: f.c,
    kidLine: `A ${FLARE_WORD[flareLetter(f.c)] ?? 'small'} solar flare (class ${f.c}) erupted on ${on(f.t)}.`,
  }));
  const cmes = (data?.cmes ?? []).map((c) => {
    const target = c.arrivals?.find((a) => a.where === 'Mars') ?? c.arrivals?.find((a) => a.where === 'Earth');
    const speed = c.v != null ? ` at ${Math.round(c.v)} km/s` : '';
    const reach = target ? ` NASA’s model ${ms(target.t) > now ? 'expects it to reach' : 'expected it to reach'} ${target.where} on ${on(target.t)}.` : '';
    return {
      kind: 'cme', time: c.t, label: c.v != null ? `CME ${Math.round(c.v)} km/s` : 'CME', url: c.url ?? undefined, speed: c.v, arrivals: c.arrivals ?? [],
      kidLine: `The Sun threw out a giant cloud of gas (a CME)${speed} on ${on(c.t)}.${reach}`,
    };
  });
  const seps = (data?.seps ?? []).map((s) => ({
    kind: 'sep', time: s.t, label: 'Radiation storm (SEP)', url: s.url ?? undefined,
    kidLine: `A radiation storm of fast particles from the Sun began on ${on(s.t)}.`,
  }));
  const storms = (data?.storms ?? []).map((g) => ({
    kind: 'storm', time: g.t, label: `Geomagnetic storm Kp ${g.kp}`, url: g.url ?? undefined, kp: g.kp,
    kidLine: `A solar storm shook Earth’s magnetic shield on ${on(g.t)} (strength Kp ${g.kp} out of 9).`,
  }));
  const alerts = (data?.alerts ?? []).map((n) => ({
    kind: 'alert', time: n.t, label: `NASA ${n.type} notice`, url: n.url ?? undefined, summary: n.summary,
    kidLine: `NASA’s space weather team sent a ${ALERT_WORD[n.type] ?? 'space weather'} notice on ${on(n.t)}.`,
  }));
  return [...flares, ...cmes, ...seps, ...storms, ...alerts].sort((a, b) => ms(b.time) - ms(a.time));
}

/**
 * The documented Sun rules (see the top of this file). Returns the level, the 0–3 radiation risk and the
 * single real record that triggered the rule.
 */
export function classifySun(data, now = Date.now()) {
  const within = (t, fromH, toH = 0) => { const age = now - (ms(t) ?? -Infinity); return age >= toH * HOUR && age <= fromH * HOUR; };
  const newest = (arr) => arr.reduce((best, e) => (!best || ms(e.t) > ms(best.t) ? e : best), null);
  const strongest = (arr) => arr.reduce((best, f) => (!best || flareSize(f.c) > flareSize(best.c) ? f : best), null);
  const flares = data?.flares ?? [];
  const x = flares.filter((f) => flareLetter(f.c) === 'X');
  const m = flares.filter((f) => flareLetter(f.c) === 'M');
  const seps = data?.seps ?? [];
  const storms = data?.storms ?? [];
  const cmes = data?.cmes ?? [];
  const aimed = (c) => (c.arrivals ?? []).filter((a) => a.where === 'Earth' || a.where === 'Mars');
  const arrivalIn = (c, fromMs, toMs) => aimed(c).find((a) => ms(a.t) >= fromMs && ms(a.t) <= toMs);
  const hit = (rule, level, radiationRisk, kind, record) => ({ rule, level, radiationRisk, kind, record });

  let r;
  if ((r = newest(seps.filter((s) => within(s.t, 72))))) return hit('sep-72h', 'stormy', 3, 'sep', r);
  if ((r = strongest(x.filter((f) => within(f.t, 48))))) return hit('x-flare-48h', 'stormy', 3, 'flare', r);
  if ((r = newest(storms.filter((g) => g.kp >= 7 && within(g.t, 72))))) return hit('kp7-72h', 'stormy', 3, 'storm', r);

  if ((r = strongest(m.filter((f) => within(f.t, 72))))) return hit('m-flare-72h', 'busy', 2, 'flare', r);
  if ((r = strongest(x.filter((f) => within(f.t, 7 * 24, 48))))) return hit('x-flare-7d', 'busy', 2, 'flare', r);
  if ((r = newest(seps.filter((s) => within(s.t, 7 * 24, 72))))) return hit('sep-7d', 'busy', 2, 'sep', r);
  if ((r = newest(cmes.filter((c) => (c.v ?? 0) >= 1000 && within(c.t, 72) && aimed(c).length)))) return hit('fast-cme-72h', 'busy', 2, 'cme', r);
  if ((r = newest(cmes.filter((c) => arrivalIn(c, now, now + 72 * HOUR))))) return hit('cme-arriving-72h', 'busy', 2, 'cme', r);

  if ((r = newest(m.filter((f) => within(f.t, 7 * 24))))) return hit('m-flare-7d', 'calm', 1, 'flare', r);
  if ((r = newest(storms.filter((g) => g.kp >= 5 && within(g.t, 7 * 24))))) return hit('kp5-7d', 'calm', 1, 'storm', r);
  if ((r = newest(cmes.filter((c) => arrivalIn(c, now - 7 * DAY, now))))) return hit('cme-arrived-7d', 'calm', 1, 'cme', r);
  return hit('quiet', 'calm', 0, null, null);
}

const HEADLINE = {
  stormy: 'The Sun is stormy right now',
  busy: 'The Sun is busy right now',
  calm1: 'The Sun is mostly calm right now',
  calm0: 'The Sun is calm right now',
};

function reasonText(hit, now) {
  const rec = hit.record;
  const on = rec ? kidDate(rec.t, now) : '';
  const flare = rec?.c ? `${FLARE_WORD[flareLetter(rec.c)] ?? 'small'} solar flare (class ${rec.c})` : '';
  const arrival = (rec?.arrivals ?? []).find((a) => a.where === 'Mars') ?? (rec?.arrivals ?? [])[0];
  switch (hit.rule) {
    case 'sep-72h': return `A radiation storm of fast particles from the Sun began on ${on}. Crews need a shelter for storms like this.`;
    case 'x-flare-48h': return `A ${flare} erupted on ${on}. Flares this big can send a radiation storm.`;
    case 'kp7-72h': return `A strong solar storm (Kp ${rec.kp} out of 9) shook Earth’s magnetic shield on ${on}.`;
    case 'm-flare-72h': return `A ${flare} erupted on ${on}. Mission Control is watching for more.`;
    case 'x-flare-7d': return `A ${flare} erupted on ${on}. The Sun has been restless this week.`;
    case 'sep-7d': return `A radiation storm of fast particles began on ${on}. It has passed, but the Sun is still restless.`;
    case 'fast-cme-72h': return `The Sun threw out a fast cloud of gas (${Math.round(rec.v)} km/s) on ${on}, and NASA’s model sends it toward ${arrival?.where ?? 'the planets'}.`;
    case 'cme-arriving-72h': return `A cloud of gas the Sun threw out on ${on} is expected to reach ${arrival?.where ?? 'the planets'} on ${kidDate(arrival?.t, now)}.`;
    case 'm-flare-7d': return `The last ${flare} erupted on ${on}. Nothing bigger since then.`;
    case 'kp5-7d': return `A solar storm (Kp ${rec.kp} out of 9) shook Earth’s magnetic shield on ${on}. It is quiet now.`;
    case 'cme-arrived-7d': return `A cloud of gas from the Sun was expected to reach ${arrival?.where ?? 'the planets'} on ${kidDate(arrival?.t, now)}. No big flares this week.`;
    default: return 'No big flares or radiation storms in the last 7 days.';
  }
}

/**
 * Compact DONKI -> SunNow. For the archive, "now" is the newest saved record, and the text says so.
 * @returns {SunNow}
 */
export function buildSunNow(data, { now = Date.now(), source = 'live', fetchedAt = null } = {}) {
  const events = sunEvents(data, now);
  const live = source === 'live';
  const realEvents = events.filter((e) => ms(e.time) <= now);
  const recordedAt = realEvents[0]?.time ?? events[0]?.time ?? null;
  const asOf = live ? now : (ms(recordedAt) ?? now);
  const hit = classifySun(data, asOf);
  const text = reasonText(hit, now);
  const reasonEvent = hit.record ? events.find((e) => e.kind === hit.kind && e.time === hit.record.t) ?? null : null;
  const headline = hit.level === 'calm' ? HEADLINE[`calm${hit.radiationRisk}`] : HEADLINE[hit.level];
  const forecast = (data?.cmes ?? []).flatMap((c) => (c.arrivals ?? [])
    .filter((a) => (a.where === 'Earth' || a.where === 'Mars') && ms(a.t) > asOf)
    .map((a) => ({ where: a.where, time: a.t, speed: c.v, url: c.url ?? undefined })));
  return {
    level: hit.level,
    radiationRisk: hit.radiationRisk,
    kidHeadline: live ? headline : `Saved NASA records, not live: ${headline.replace('The Sun is', 'the Sun was').replace(' right now', '')} on ${kidDate(recordedAt, now)}`,
    kidLine: live ? text : `${text} These are saved NASA records, not live.`,
    events,
    source,
    recordedAt,
    fetchedAt,
    attribution: DONKI_ATTRIBUTION,
    reason: { rule: hit.rule, text, event: reasonEvent },
    counts: {
      flares: data?.flares?.length ?? 0, cmes: data?.cmes?.length ?? 0, seps: data?.seps?.length ?? 0,
      storms: data?.storms?.length ?? 0, alerts: data?.alerts?.length ?? 0,
    },
    windowDays: WINDOW_DAYS,
    forecast,
    sourceLabel: live ? 'Live from NASA DONKI' : 'Saved NASA records, not live',
  };
}

/** The REMS feed -> MarsNow. Reads only the first few soles; the feed lists the newest first. */
export function parseRems(feed, { source = 'live', fetchedAt = null, scan = 5 } = {}) {
  const rows = (feed?.soles ?? []).slice(0, scan)
    .map((s) => ({ s, sol: num(s.sol), minC: num(s.min_temp), maxC: num(s.max_temp) }))
    .filter((r) => r.sol != null && r.minC != null && r.maxC != null)
    .sort((a, b) => b.sol - a.sol);
  if (!rows.length) return null;
  const { s, sol, minC, maxC } = rows[0];
  return marsNow({
    sol, earthDate: s.terrestrial_date, minC, maxC, pressurePa: num(s.pressure), sky: s.atmo_opacity, uv: s.local_uv_irradiance_index,
    ls: num(s.ls), sunrise: s.sunrise, sunset: s.sunset,
  }, { source, fetchedAt });
}

/** The bundled public/data/rems.json -> MarsNow from its newest complete row. */
export function archiveRems(rems) {
  const col = Object.fromEntries((rems?.columns ?? []).map((name, i) => [name, i]));
  const rows = rems?.rows ?? [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const r = rows[i];
    if (r[col.minC] == null || r[col.maxC] == null) continue;
    return marsNow({
      sol: r[col.sol], earthDate: r[col.earthDate], minC: r[col.minC], maxC: r[col.maxC], pressurePa: r[col.pressurePa],
      sky: r[col.opacity] ?? r[col.sky], uv: r[col.uv], ls: r[col.ls], sunrise: r[col.sunrise], sunset: r[col.sunset],
    }, { source: 'archive', fetchedAt: null });
  }
  return null;
}

const dashed = (v) => (v == null || v === '--' || v === '' ? null : v);

function marsNow(row, { source, fetchedAt }) {
  const live = source === 'live';
  return {
    sol: row.sol,
    earthDate: row.earthDate,
    minC: row.minC,
    maxC: row.maxC,
    pressurePa: row.pressurePa ?? null,
    sky: dashed(row.sky) ?? 'Not reported',
    uv: dashed(row.uv) ?? 'Not reported',
    ls: row.ls ?? null,
    sunrise: dashed(row.sunrise),
    sunset: dashed(row.sunset),
    source,
    recordedAt: `${row.earthDate}T12:00:00Z`,
    fetchedAt,
    // Curiosity's public feed lags by weeks or months: always show the date it was recorded, never "today".
    recordedLabel: `Latest Curiosity reading, recorded ${kidDate(row.earthDate, Date.parse('1970-01-01'))}`,
    sourceLabel: live ? 'Read just now from NASA’s Curiosity weather feed' : 'Saved NASA records, not live',
    attribution: REMS_ATTRIBUTION,
  };
}

/**
 * Kid text for the pre-launch briefing: what the real Sun is doing and what that means for the
 * shielding-versus-power trade tonight.
 * @param {LiveNow} live
 */
export function liveRadiationBriefing(live) {
  const sun = live?.sun;
  if (!sun) {
    return { level: 'calm', radiationRisk: 0, source: 'archive', title: 'Checking the real Sun…', sun: '', meaning: '', tip: '', label: '', text: 'Checking the real Sun…' };
  }
  const risk = sun.radiationRisk;
  const meaning = [
    'Sun is calm: a shield is still smart, but tonight you can spend more crew time and power on science.',
    'Sun is mostly calm: keep a little crew time for shielding. The Sun can change fast.',
    'Sun is busy: building a shield uses crew time and power, but could save your crew from a real storm.',
    'Sun is stormy: pack a storm shelter and build shielding first. Science can wait until the storm passes.',
  ][risk];
  const tip = [
    'Good night to charge batteries and run the lab.',
    'Pile some regolith on the roof when the crew has a spare shift.',
    'Take a storm shelter if you can lift it, and send one crew member to build shielding.',
    'Take a storm shelter. When the alert comes, everyone goes inside.',
  ][risk];
  const label = sun.source === 'live'
    ? `Live from NASA DONKI, checked ${relativeTime(sun.fetchedAt)}`
    : 'Saved NASA records, not live. We could not reach NASA just now.';
  const title = sun.source === 'live' ? `Real Sun report: ${sun.kidHeadline.replace('The Sun is ', '').replace(' right now', '')}` : 'Sun report from saved NASA records';
  const sunLine = sun.source === 'live' ? sun.kidLine : sun.kidLine.replace(' These are saved NASA records, not live.', '');
  return { level: sun.level, radiationRisk: risk, source: sun.source, title, sun: sunLine, meaning, tip, label, text: `${title}. ${sunLine} ${meaning} ${tip}` };
}

/** One ticker readout, or null when the data is not live. */
export function liveTickerItem(live) {
  const sun = live?.sun;
  if (!sun || sun.source !== 'live') return null;
  const c = sun.counts ?? {};
  return { label: 'NASA DONKI, live', value: `${c.cmes} Sun eruptions and ${c.flares} solar flares in the last ${sun.windowDays} days · Sun is ${sun.level} today` };
}

// ---------- Network, cache, subscribers (browser only; all access guarded) ----------

const MARS_KEEP_MS = 6 * HOUR;
const subscribers = new Set();
let current = null;
let inflight = null;
let lastFailAt = 0;
let timer = null;
let marsWanted = false;
let remsSession = null;
let sessionMars = null;
let archiveMars;

function readCache() {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.donki && parsed.fetchedAt ? parsed : null;
  } catch { return null; }
}

function writeCache(entry) {
  try { globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* storage full or blocked: run uncached */ }
}

async function fetchJson(url, timeoutMs) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!res.ok) return { ok: false, status: res.status, ms: Date.now() - started, error: `HTTP ${res.status}` };
    const text = await res.text();
    // DONKI answers an empty body (not "[]") for some empty ranges.
    return { ok: true, status: res.status, ms: Date.now() - started, data: text.trim() ? JSON.parse(text) : [] };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - started, error: err?.name === 'AbortError' ? `timed out after ${timeoutMs / 1000} s` : (err?.message ?? 'network error') };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDonkiLive(now) {
  const range = donkiWindow(now);
  const results = await Promise.all(DONKI_KINDS.map((kind) => fetchJson(donkiUrl(kind, range), DONKI_TIMEOUT_MS)));
  const raw = {};
  const requests = results.map((r, i) => {
    const kind = DONKI_KINDS[i];
    if (r.ok && Array.isArray(r.data)) raw[kind] = r.data;
    return { name: `DONKI ${kind}`, url: donkiUrl(kind, range), ok: r.ok && Array.isArray(r.data), status: r.status, ms: r.ms, count: Array.isArray(r.data) ? r.data.length : null, error: r.error ?? null };
  });
  // The three feeds that drive the risk rules must all answer; alerts and geomagnetic storms are extras.
  const usable = ['FLR', 'CME', 'SEP'].every((k) => Array.isArray(raw[k]));
  return { donki: usable ? normalizeDonki(raw) : null, requests };
}

async function bundled(path) {
  try {
    const res = await fetch(path);
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

const cachedMars = (cache) => (cache?.mars && Date.now() - Date.parse(cache.marsFetchedAt ?? 0) < MARS_KEEP_MS ? cache.mars : null);

// Mars for a LiveNow: this session's live reading, else a recent cached one, else the bundled archive row.
async function withMars(live, cache) {
  let mars = sessionMars ?? cachedMars(cache);
  if (!mars) {
    if (archiveMars === undefined) archiveMars = archiveRems(await bundled('./data/rems.json'));
    mars = archiveMars;
  }
  return { ...live, mars };
}

function fromEntry(entry, { cached, requests }) {
  return {
    sun: buildSunNow(entry.donki, { now: Date.now(), source: 'live', fetchedAt: entry.fetchedAt }),
    mars: null,
    loadedAt: new Date().toISOString(),
    donki: entry.donki,
    requests: requests ?? entry.requests ?? [],
    cached,
  };
}

function archiveNow(requests) {
  return bundled('./data/donki.json').then((donki) => {
    const data = archiveDonki(donki ?? {});
    return withMars({
      sun: buildSunNow(data, { now: Date.now(), source: 'archive', fetchedAt: null }),
      mars: null, loadedAt: new Date().toISOString(), donki: data, requests, cached: false,
    }, null);
  });
}

async function refresh() {
  const cache = readCache();
  const res = await fetchDonkiLive(Date.now());
  const marsRequests = (current?.requests ?? []).filter((r) => r.name === 'Curiosity REMS');
  const requests = [...res.requests, ...marsRequests];
  if (!res.donki) {
    lastFailAt = Date.now();
    // Keep serving an older live reading if we have one: it is still real, and its age is shown.
    if (cache) return withMars(fromEntry(cache, { cached: true, requests }), cache);
    return archiveNow(requests);
  }
  const entry = { fetchedAt: new Date().toISOString(), donki: res.donki, mars: sessionMars ?? cachedMars(cache), marsFetchedAt: sessionMars?.fetchedAt ?? cache?.marsFetchedAt ?? null, requests: res.requests };
  writeCache(entry);
  return withMars(fromEntry(entry, { cached: false, requests }), entry);
}

function publish(live) {
  current = live;
  for (const fn of subscribers) {
    try { fn(live); } catch (err) { console.warn('[live] subscriber failed', err); }
  }
  return live;
}

function startRefresh() {
  if (!inflight) {
    inflight = refresh()
      .catch((err) => { console.warn('[live] refresh failed', err); return archiveNow([]); })
      .then(publish)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

function schedule() {
  if (timer || typeof setInterval !== 'function' || typeof document === 'undefined') return;
  timer = setInterval(() => { if (!document.hidden) startRefresh(); }, CACHE_TTL_MS);
}

/**
 * Asks for the latest Curiosity reading. The REMS feed is 1.7 MB, so it is fetched only when something
 * shows Mars weather (liveMarsCard, the Data Lab), at most once per page session, and kept for 6 hours.
 * Subscribers are called again when it lands. Until then `mars` is the bundled archive row.
 */
export function requestMars() {
  if (marsWanted) return;
  marsWanted = true;
  if (cachedMars(readCache())) return;
  remsSession = fetchJson(REMS_FEED, REMS_TIMEOUT_MS).then(async (r) => {
    const mars = r.ok ? parseRems(r.data, { source: 'live', fetchedAt: new Date().toISOString() }) : null;
    const request = { name: 'Curiosity REMS', url: REMS_FEED, ok: Boolean(mars), status: r.status, ms: r.ms, count: r.ok ? (r.data?.soles?.length ?? null) : null, error: r.error ?? (mars ? null : 'no usable reading') };
    if (mars) {
      sessionMars = mars;
      const cache = readCache();
      if (cache) writeCache({ ...cache, mars, marsFetchedAt: mars.fetchedAt });
    }
    if (inflight) await inflight.catch(() => null);
    const base = current ?? await loadLive();
    publish({ ...base, mars: mars ?? base.mars, requests: [...(base.requests ?? []).filter((x) => x.name !== request.name), request], loadedAt: new Date().toISOString() });
  }).catch((err) => console.warn('[live] Curiosity feed failed', err));
}

/**
 * Resolves quickly (cached, with timeouts); never rejects. Falls back to archive data offline.
 * @param {{ force?: boolean, mars?: boolean }} [opts] force: skip the 30-minute cache (the Data Lab
 *   "Check again" button). mars: also fetch the latest Curiosity reading (see requestMars).
 * @returns {Promise<LiveNow>}
 */
export async function loadLive(opts = {}) {
  try {
    schedule();
    if (opts.mars) requestMars();
    if (inflight) return await inflight;
    const cache = readCache();
    const age = cache ? Date.now() - Date.parse(cache.fetchedAt) : Infinity;
    if (!opts.force) {
      if (cache && age < CACHE_TTL_MS) {
        if (!current || current.sun.source !== 'live' || current.sun.fetchedAt !== cache.fetchedAt) {
          current = await withMars(fromEntry(cache, { cached: true, requests: [...(cache.requests ?? []), ...(current?.requests ?? []).filter((r) => r.name === 'Curiosity REMS')] }), cache);
        }
        return current;
      }
      // Offline a moment ago: do not hammer NASA on every screen change.
      if (current && Date.now() - lastFailAt < RETRY_AFTER_FAIL_MS) return current;
      if (cache) {
        // Stale but real: show it at once (its age is on the card) and refresh behind it.
        startRefresh();
        return await withMars(fromEntry(cache, { cached: true }), cache);
      }
    }
    return await startRefresh();
  } catch (err) {
    console.warn('[live] falling back to saved NASA records', err);
    return current ?? archiveNow([]).catch(() => ({
      sun: buildSunNow({}, { source: 'archive' }), mars: null, loadedAt: new Date().toISOString(), donki: {}, requests: [], cached: false,
    }));
  }
}

/** Subscribe to live updates (called now, and again whenever a refresh lands). Returns an unsubscribe fn. */
export function onLive(fn) {
  let active = true;
  let last = null;
  const deliver = (live) => {
    if (!active || live === last) return;
    last = live;
    fn(live);
  };
  subscribers.add(deliver);
  loadLive().then(deliver);
  return () => { active = false; subscribers.delete(deliver); };
}

let healthPromise = null;

/**
 * Real space-biology findings from NASA's Open Science Data Repository, bundled at build time by
 * scripts/fetch-osdr.mjs (OSDR does not allow browser calls). Always source 'archive'.
 * @returns {Promise<{ findings: object[], fetched: string|null, source: 'archive', label: string, attribution: { name: string, url: string } }>}
 */
export function liveHealth() {
  if (!healthPromise) {
    healthPromise = bundled('./data/osdr.json').then((json) => ({
      findings: json?.findings ?? [],
      fetched: json?.fetched ?? null,
      source: 'archive',
      label: json?.fetched ? `Saved from NASA OSDR on ${kidDate(json.fetched, Date.parse('1970-01-01'))}` : 'NASA OSDR findings are not available',
      attribution: { name: 'NASA Open Science Data Repository', url: 'https://osdr.nasa.gov/bio/repo/' },
    }));
  }
  return healthPromise;
}

/** Optional api.nasa.gov key, read at build time only. Never hardcoded; the game works without it. */
export const nasaApiKey = () => import.meta.env?.VITE_NASA_API_KEY || null;
