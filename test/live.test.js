// Live NASA data: parsing, the documented Sun rules, and the "Today's real Sun" mission. No network:
// the fixtures are trimmed copies of real DONKI and REMS responses fetched on 2026-11-14.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  normalizeDonki, archiveDonki, classifySun, buildSunNow, sunEvents, parseRems, archiveRems,
  liveRadiationBriefing, liveTickerItem, donkiWindow, donkiUrl, relativeTime, kidDate,
} from '../src/live/liveData.js';
import { liveSeps, mergeSeps, forecastSols, todaysSunMission, FORECAST_CHANCE } from '../src/live/liveMission.js';
import { classifySepEvents } from '../src/engine/spaceWeather.js';
import { buildWeatherIndex } from '../src/engine/environment.js';
import { createMission, beginSol, resolveEvent, runSol, missionDateMs } from '../src/engine/sim.js';
import { eventById } from '../src/data/eventCards.js';
import { fillTemplate } from '../src/engine/events.js';
import { missionById } from '../src/data/missions.js';
import { SOURCES } from '../src/data/sources.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const remsArchive = read('../public/data/rems.json');
const donkiArchive = read('../public/data/donki.json');
const osdr = read('../public/data/osdr.json');

const NOW = Date.parse('2026-11-14T23:40:00Z');
const HOUR = 3600e3;

const flr = (peakTime, classType, id) => ({ flrID: `${peakTime}-FLR`, beginTime: peakTime, peakTime, endTime: peakTime, classType, sourceLocation: 'S07W46', activeRegionNum: 14566, link: `https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/${id}/-1` });
const RAW = {
  FLR: [
    flr('2026-10-16T15:42Z', 'M1.3', 1), flr('2026-10-26T18:40Z', 'C2.8', 2), flr('2026-11-05T18:33Z', 'M3.5', 3),
    flr('2026-11-07T12:43Z', 'M1.2', 4), flr('2026-11-07T18:42Z', 'M1.9', 5), flr('2026-11-08T07:46Z', 'M1.7', 6),
    flr('2026-11-11T21:21Z', 'M1.7', 49504),
  ],
  CME: [
    {
      activityID: '2026-11-09T18:15:00-CME-001', startTime: '2026-11-09T18:15Z', link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/CME/49480/-1',
      cmeAnalyses: [
        { isMostAccurate: false, speed: 500, type: 'C', enlilList: [] },
        { isMostAccurate: true, speed: 726.0, halfAngle: 10, type: 'C', enlilList: [{ isEarthGB: false, estimatedShockArrivalTime: null, impactList: [{ location: 'Mars', arrivalTime: '2026-11-13T12:00Z' }, { location: 'Psyche', arrivalTime: '2026-11-14T06:00Z' }] }] },
      ],
    },
    { activityID: '2026-11-14T14:00:00-CME-001', startTime: '2026-11-14T14:00Z', link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/CME/49554/-1', cmeAnalyses: [{ isMostAccurate: true, speed: 397.0, type: 'S', enlilList: [] }] },
    { activityID: 'no-analysis', startTime: '2026-11-13T03:24Z', link: null, cmeAnalyses: null },
  ],
  SEP: [],
  GST: [{ gstID: '2026-10-31T18:00:00-GST-001', startTime: '2026-10-31T18:00Z', allKpIndex: [{ kpIndex: 6.0, observedTime: '2026-10-31T21:00Z', source: 'NOAA' }], link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/GST/49348/-1' }],
  notifications: [{
    messageType: 'RBE', messageID: '20261114-AL-001', messageURL: 'https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/49556/1', messageIssueTime: '2026-11-14T21:34Z',
    messageBody: '## Message Type: Space Weather Notification\n##\n## Summary:\n\nSignificantly elevated energetic electron fluxes in the Earth\'s outer radiation belt. GOES flux remains elevated.\n\n## Notes: \n\nDisclaimer',
  }],
};
const DATA = normalizeDonki(RAW);
const withSep = (t) => ({ ...DATA, seps: [{ t, id: 'sep', url: 'https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/1/-1' }] });
const withFlare = (t, c) => ({ ...DATA, flares: [...DATA.flares, { t, c, loc: null, region: null, url: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/9/-1' }] });
const ago = (h) => new Date(NOW - h * HOUR).toISOString();

describe('DONKI parsing', () => {
  it('builds the 30-day-plus-forecast query window and URLs', () => {
    expect(donkiWindow(NOW)).toEqual({ startDate: '2026-10-15', endDate: '2026-11-17' });
    expect(donkiUrl('FLR', donkiWindow(NOW))).toBe('https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?startDate=2026-10-15&endDate=2026-11-17');
  });

  it('normalizes raw DONKI records into the compact shape', () => {
    expect(DATA.flares).toHaveLength(7);
    expect(DATA.flares.at(-1)).toEqual({ t: '2026-11-11T21:21Z', c: 'M1.7', loc: 'S07W46', region: 14566, url: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/49504/-1' });
    const cme = DATA.cmes.find((c) => c.t === '2026-11-09T18:15Z');
    expect(cme.v).toBe(726);
    expect(cme.arrivals).toEqual([{ where: 'Mars', t: '2026-11-13T12:00Z' }]);
    expect(DATA.cmes.find((c) => c.t === '2026-11-13T03:24Z')).toMatchObject({ v: null, arrivals: [] });
    expect(DATA.storms).toEqual([{ t: '2026-10-31T18:00Z', kp: 6, url: 'https://ccmc.gsfc.nasa.gov/DONKI/view/GST/49348/-1' }]);
    expect(DATA.alerts[0].summary).toBe('Significantly elevated energetic electron fluxes in the Earth\'s outer radiation belt.');
  });

  it('survives empty, missing and malformed responses', () => {
    expect(normalizeDonki()).toEqual({ flares: [], cmes: [], seps: [], storms: [], alerts: [] });
    expect(normalizeDonki({ FLR: 'oops', CME: [{}], SEP: null, GST: [{ startTime: 'not a date' }] })).toEqual({ flares: [], cmes: [], seps: [], storms: [], alerts: [] });
  });

  it('writes kid lines that name the real event, newest first, with NASA links', () => {
    const events = sunEvents(DATA, NOW);
    expect(events[0]).toMatchObject({ kind: 'alert', time: '2026-11-14T21:34Z', url: 'https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/49556/1' });
    const flare = events.find((e) => e.kind === 'flare' && e.time === '2026-11-05T18:33Z');
    expect(flare.kidLine).toBe('A medium solar flare (class M3.5) erupted on 5 Nov.');
    const cme = events.find((e) => e.kind === 'cme' && e.time === '2026-11-09T18:15Z');
    expect(cme.kidLine).toContain('726 km/s');
    expect(cme.kidLine).toContain('expected it to reach Mars on 13 Nov');
    expect(events.every((e) => e.kidLine && e.label)).toBe(true);
  });
});

describe('Sun rules', () => {
  it('real data from 14 Nov 2026: mostly calm, risk 1, because of the M1.7 flare three days earlier', () => {
    const hit = classifySun(DATA, NOW);
    expect(hit).toMatchObject({ rule: 'm-flare-7d', level: 'calm', radiationRisk: 1 });
    expect(hit.record).toMatchObject({ c: 'M1.7', t: '2026-11-11T21:21Z' });
  });

  it('stormy (3): SEP in the last 72 h, X flare in the last 48 h, or Kp >= 7 in the last 72 h', () => {
    expect(classifySun(withSep(ago(70)), NOW)).toMatchObject({ rule: 'sep-72h', level: 'stormy', radiationRisk: 3 });
    expect(classifySun(withFlare(ago(47), 'X1.2'), NOW)).toMatchObject({ rule: 'x-flare-48h', level: 'stormy', radiationRisk: 3 });
    expect(classifySun({ ...DATA, storms: [{ t: ago(10), kp: 7.33 }] }, NOW)).toMatchObject({ rule: 'kp7-72h', level: 'stormy', radiationRisk: 3 });
  });

  it('busy (2): M flare in 72 h, older X flare or SEP, fast aimed CME, or a predicted arrival', () => {
    expect(classifySun(withFlare(ago(71), 'M2.0'), NOW)).toMatchObject({ rule: 'm-flare-72h', level: 'busy', radiationRisk: 2 });
    expect(classifySun(withFlare(ago(49), 'X1.2'), NOW)).toMatchObject({ rule: 'x-flare-7d', level: 'busy', radiationRisk: 2 });
    expect(classifySun(withSep(ago(100)), NOW)).toMatchObject({ rule: 'sep-7d', level: 'busy', radiationRisk: 2 });
    const quiet = { flares: [], seps: [], storms: [] };
    const fast = { ...quiet, cmes: [{ t: ago(20), v: 1400, arrivals: [{ where: 'Earth', t: ago(-40) }] }] };
    expect(classifySun(fast, NOW)).toMatchObject({ rule: 'fast-cme-72h', radiationRisk: 2 });
    const slowArriving = { ...quiet, cmes: [{ t: ago(90), v: 500, arrivals: [{ where: 'Mars', t: ago(-30) }] }] };
    expect(classifySun(slowArriving, NOW)).toMatchObject({ rule: 'cme-arriving-72h', level: 'busy', radiationRisk: 2 });
    const fastButNotAimed = { ...quiet, cmes: [{ t: ago(20), v: 1400, arrivals: [] }] };
    expect(classifySun(fastButNotAimed, NOW)).toMatchObject({ rule: 'quiet', radiationRisk: 0 });
  });

  it('calm (0) when nothing happened, and never throws on empty data', () => {
    expect(classifySun({}, NOW)).toMatchObject({ rule: 'quiet', level: 'calm', radiationRisk: 0, record: null });
    expect(classifySun({ flares: [{ t: ago(24), c: 'C9.9' }] }, NOW)).toMatchObject({ level: 'calm', radiationRisk: 0 });
  });

  it('builds a live SunNow with honest labels and the contract fields', () => {
    const sun = buildSunNow(DATA, { now: NOW, source: 'live', fetchedAt: '2026-11-14T23:39:00Z' });
    expect(sun).toMatchObject({ level: 'calm', radiationRisk: 1, source: 'live', recordedAt: '2026-11-14T21:34Z', fetchedAt: '2026-11-14T23:39:00Z', kidHeadline: 'The Sun is mostly calm right now' });
    expect(sun.kidLine).toBe('The last medium solar flare (class M1.7) erupted on 11 Nov. Nothing bigger since then.');
    expect(sun.attribution).toEqual({ name: 'NASA DONKI', url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' });
    expect(sun.counts).toEqual({ flares: 7, cmes: 3, seps: 0, storms: 1, alerts: 1 });
    expect(sun.reason.event.url).toBe('https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/49504/-1');
    expect(sun.events.length).toBe(12);
  });

  it('names the real event in a busy headline', () => {
    const sun = buildSunNow(withFlare(ago(30), 'M3.5'), { now: NOW, source: 'live', fetchedAt: ago(0) });
    expect(sun.kidHeadline).toBe('The Sun is busy right now');
    expect(sun.kidLine).toMatch(/^A medium solar flare \(class M3\.5\) erupted on 13 Nov\./);
  });

  it('labels the archive fallback as saved records, judged at its own newest record', () => {
    const data = archiveDonki(donkiArchive);
    const sun = buildSunNow(data, { now: NOW, source: 'archive' });
    expect(sun.source).toBe('archive');
    expect(sun.fetchedAt).toBeNull();
    expect(sun.kidHeadline).toMatch(/^Saved NASA records, not live: the Sun was (calm|mostly calm|busy|stormy) on \d+ \w+ 2025$/);
    expect(sun.kidLine).toMatch(/These are saved NASA records, not live\.$/);
    expect(sun.recordedAt.startsWith('2025-12')).toBe(true);
    expect(sun.events.length).toBeGreaterThan(0);
    expect(sun.events.every((e) => Date.parse(e.time) >= Date.parse(sun.recordedAt) - 30 * 24 * HOUR)).toBe(true);
  });
});

describe('Curiosity REMS', () => {
  const feed = { soles: [
    { id: '4746', terrestrial_date: '2026-08-25', sol: '4995', ls: '341', min_temp: '-71', max_temp: '-5', pressure: '777', atmo_opacity: 'Sunny', sunrise: '06:46', sunset: '18:51', local_uv_irradiance_index: 'Moderate' },
    { id: '4745', terrestrial_date: '2026-08-24', sol: '4994', ls: '340', min_temp: '-72', max_temp: '-6', pressure: '778', atmo_opacity: 'Sunny', sunrise: '06:46', sunset: '18:51', local_uv_irradiance_index: 'High' },
  ] };

  it('reads the newest sol and dates it instead of calling it today', () => {
    const mars = parseRems(feed, { source: 'live', fetchedAt: '2026-11-14T23:40:00Z' });
    expect(mars).toMatchObject({ sol: 4995, earthDate: '2026-08-25', minC: -71, maxC: -5, pressurePa: 777, sky: 'Sunny', uv: 'Moderate', source: 'live' });
    expect(mars.recordedLabel).toBe('Latest Curiosity reading, recorded 25 Aug 2026');
    expect(mars.recordedLabel).not.toMatch(/today/i);
  });

  it('skips incomplete newest rows and tolerates junk', () => {
    const gap = { soles: [{ sol: '4996', terrestrial_date: '2026-08-26', min_temp: '--', max_temp: '--' }, ...feed.soles] };
    expect(parseRems(gap).sol).toBe(4995);
    expect(parseRems({})).toBeNull();
    expect(parseRems(null)).toBeNull();
  });

  it('falls back to the newest row of the bundled archive', () => {
    const mars = archiveRems(remsArchive);
    expect(mars).toMatchObject({ source: 'archive', sourceLabel: 'Saved NASA records, not live' });
    expect(mars.sol).toBe(remsArchive.rows.at(-1)[0]);
    expect(Number.isFinite(mars.minC) && Number.isFinite(mars.maxC)).toBe(true);
  });
});

describe('Briefing, ticker and text helpers', () => {
  it('turns the real Sun into shielding advice', () => {
    const busy = { sun: buildSunNow(withFlare(ago(30), 'M3.5'), { now: NOW, source: 'live', fetchedAt: new Date().toISOString() }) };
    const b = liveRadiationBriefing(busy);
    expect(b.radiationRisk).toBe(2);
    expect(b.meaning).toBe('Sun is busy: building a shield uses crew time and power, but could save your crew from a real storm.');
    expect(b.sun).toContain('class M3.5');
    expect(b.label).toMatch(/^Live from NASA DONKI/);
    const offline = liveRadiationBriefing({ sun: buildSunNow(archiveDonki(donkiArchive), { now: NOW, source: 'archive' }) });
    expect(offline.label).toMatch(/Saved NASA records, not live/);
    expect(offline.title).toBe('Sun report from saved NASA records');
    expect(liveRadiationBriefing(null).text).toBe('Checking the real Sun…');
  });

  it('only offers a ticker item when the data is live', () => {
    const live = { sun: buildSunNow(DATA, { now: NOW, source: 'live', fetchedAt: ago(0) }) };
    expect(liveTickerItem(live)).toEqual({ label: 'NASA DONKI, live', value: '3 Sun eruptions and 7 solar flares in the last 30 days · Sun is calm today' });
    expect(liveTickerItem({ sun: buildSunNow(DATA, { now: NOW, source: 'archive' }) })).toBeNull();
  });

  it('formats relative times and dates', () => {
    expect(relativeTime(ago(0), NOW)).toBe('just now');
    expect(relativeTime(ago(0.5), NOW)).toBe('30 minutes ago');
    expect(relativeTime(ago(2), NOW)).toBe('2 hours ago');
    expect(relativeTime(ago(72), NOW)).toBe('3 days ago');
    expect(kidDate('2026-11-11T21:21Z', NOW)).toBe('11 Nov');
    expect(kidDate('2025-12-30', NOW)).toBe('30 Dec 2025');
  });
});

describe('Today’s real Sun mission', () => {
  const live = { sun: buildSunNow(DATA, { now: NOW, source: 'live', fetchedAt: '2026-11-14T23:39:00Z' }), donki: DATA };

  it('maps real flares onto storms by their real timestamps, keeping the strongest of each 24 h burst', () => {
    const seps = liveSeps(DATA, { launchMs: NOW });
    expect(seps.map((s) => [new Date(s.time).toISOString().slice(0, 16), s.flareClass, s.severity, s.cardId])).toEqual([
      ['2026-10-16T15:42', 'M1.3', 'minor', 'sun_live_flare'],
      ['2026-11-05T18:33', 'M3.5', 'minor', 'sun_live_flare'],
      ['2026-11-07T12:43', 'M1.9', 'minor', 'sun_live_flare'],
      ['2026-11-11T21:21', 'M1.7', 'minor', 'sun_live_flare'],
    ]);
    expect(seps.at(-1).vars.liveAge).toBe('3 days before this mission launched');
    expect(seps.every((s) => s.live && s.url)).toBe(true);
  });

  it('keeps real SEP events as SEP storms and rates X flares higher than M flares', () => {
    const data = { flares: [{ t: '2026-11-12T10:00Z', c: 'X2.1', url: 'u1' }, { t: '2026-11-01T10:00Z', c: 'X1.0', url: 'u2' }], seps: [{ t: '2026-11-12T14:00Z', id: 's', url: 'u3' }] };
    const seps = liveSeps(data, { launchMs: NOW });
    expect(seps).toHaveLength(2);
    expect(seps[0]).toMatchObject({ kind: 'flare', flareClass: 'X1.0', severity: 'moderate', cardId: 'sun_live_flare' });
    expect(seps[1]).toMatchObject({ kind: 'sep', flareClass: 'X2.1', severity: 'major', cardId: 'sun_live_sep', url: 'u3' });
    expect(seps[1].vars.liveAge).toBe('2 days before this mission launched');
  });

  it('leaves the archived storm list untouched when there is nothing live to add', () => {
    const base = classifySepEvents(donkiArchive);
    expect(mergeSeps(base, [])).toEqual(base);
    const merged = mergeSeps(base, liveSeps(DATA, { launchMs: NOW }));
    expect(merged.length).toBe(base.length + 4);
    expect(merged.filter((s) => s.time < Date.parse('2026-01-01'))).toEqual(base);
  });

  it('builds a mission on the real calendar that reaches today', () => {
    const { config, seps, todaySol, isLive } = todaysSunMission({ live, body: 'mars', targetSols: 30, code: 'ABC123', now: NOW });
    expect(isLive).toBe(true);
    expect(config).toMatchObject({ id: 'free-play', title: 'Today’s Real Sun', body: 'mars', startDate: '2026-10-24', budgetKg: missionById('solar-storm').budgetKg });
    expect(config.recommended).toEqual(missionById('solar-storm').recommended);
    expect(missionDateMs(config, todaySol)).toBeGreaterThanOrEqual(NOW);
    expect(missionDateMs(config, todaySol - 1)).toBeLessThan(NOW);
    expect(seps.map((s) => new Date(s.time).toISOString().slice(0, 10))).toEqual(['2026-11-05', '2026-11-07', '2026-11-11']);
    expect(config.live).toMatchObject({ source: 'live', radiationRisk: 1, todaySol, fetchedAt: '2026-11-14T23:39:00Z' });
    expect(config.scripted.every((s) => s.sol > todaySol && s.sol <= 30 && s.eventId === 'sun_forecast')).toBe(true);
    expect(config.intro).toContain('real Sun');
  });

  it('replays: the same code and snapshot give the same mission; forecasts follow the risk', () => {
    const a = todaysSunMission({ live, code: 'ABC123', now: NOW });
    const b = todaysSunMission({ live, code: 'ABC123', now: NOW });
    expect(b.config).toEqual(a.config);
    const count = (risk) => Array.from({ length: 200 }, (_, i) => forecastSols({ code: `C${i}`, startDate: '2026-10-24', body: 'mars', targetSols: 30, todaySol: 22, radiationRisk: risk }).length).reduce((x, y) => x + y, 0);
    expect(count(3)).toBeGreaterThan(count(1) * 2);
    expect(count(1)).toBeGreaterThan(0);
    expect(FORECAST_CHANCE).toHaveLength(4);
  });

  it('adds a forecast drill on the sol when NASA predicts a CME arrival at the mission world', () => {
    const arrivals = [{ where: 'Mars', time: '2026-11-16T06:00Z' }, { where: 'Earth', time: '2026-11-15T20:00Z' }];
    const args = { code: 'ZZZ', startDate: '2026-10-24', targetSols: 30, todaySol: 22, radiationRisk: 0, arrivals };
    const mars = forecastSols({ ...args, body: 'mars' }).find((s) => s.why === 'nasa-model');
    expect(mars.time).toBe('2026-11-16T06:00Z');
    expect(missionDateMs({ startDate: '2026-10-24', body: 'mars' }, mars.sol)).toBeGreaterThan(Date.parse(mars.time));
    expect(forecastSols({ ...args, body: 'moon' }).find((s) => s.why === 'nasa-model').time).toBe('2026-11-15T20:00Z');
  });

  it('uses no archive events and says so when NASA could not be reached', () => {
    const offline = { sun: buildSunNow(archiveDonki(donkiArchive), { now: NOW, source: 'archive' }), donki: archiveDonki(donkiArchive) };
    const { config, seps, isLive } = todaysSunMission({ live: offline, code: 'ABC123', now: NOW });
    expect(isLive).toBe(false);
    expect(seps).toEqual([]);
    expect(config.live.source).toBe('archive');
    expect(config.intro).toContain('NASA could not be reached');
  });

  it('plays through the engine: live flares raise their own honest card on their real dates', () => {
    const { config, seps } = todaysSunMission({ live, body: 'mars', targetSols: 30, code: 'ABC123', now: NOW });
    const ctx = { weatherIndex: buildWeatherIndex(remsArchive), seps: mergeSeps(classifySepEvents(donkiArchive), seps) };
    let m = createMission({ config, loadout: config.recommended, difficulty: 'cadet', code: 'ABC123' }, ctx);
    const seen = [];
    for (let i = 0; i < 40 && m.status === 'active'; i += 1) {
      m = beginSol(m, ctx);
      if (m.phase === 'event') {
        const card = eventById(m.pendingEvent.id);
        if (m.pendingEvent.id.startsWith('sun_')) seen.push({ id: m.pendingEvent.id, sol: m.sol, science: fillTemplate(card.science, m.pendingEvent.vars), sep: m.today.sep });
        m = resolveEvent(m, 0, ctx);
      }
      m = runSol(m, ctx);
    }
    const flares = seen.filter((e) => e.id === 'sun_live_flare');
    expect(flares.map((e) => e.sep.flareClass)).toEqual(['M3.5', 'M1.9', 'M1.7']);
    expect(flares[0].science).toContain('recorded it on 2026-11-05, 9 days before this mission launched');
    expect(flares[0].science).toContain('NASA did not record a radiation storm after this flare');
    expect(flares.every((e) => !/\{\w+\}/.test(e.science))).toBe(true);
    expect(seen.filter((e) => e.id === 'sun_forecast').every((e) => e.sep === null && e.sol > config.live.todaySol)).toBe(true);
    expect(m.stats.sepEvents).toBe(3);
  });

  it('does not change campaign chapters: archived storms still raise the archived card', () => {
    const base = classifySepEvents(donkiArchive);
    const ctx = { weatherIndex: buildWeatherIndex(remsArchive), seps: base };
    const config = missionById('solar-storm');
    let m = createMission({ config, loadout: config.recommended, difficulty: 'cadet', code: 'SOL001' }, ctx);
    const ids = new Set();
    for (let i = 0; i < 30 && m.status === 'active'; i += 1) {
      m = beginSol(m, ctx);
      if (m.phase === 'event') { ids.add(m.pendingEvent.id); m = resolveEvent(m, 0, ctx); }
      m = runSol(m, ctx);
    }
    expect(ids.has('sep_alert')).toBe(true);
    expect([...ids].some((id) => id.startsWith('sun_'))).toBe(false);
  });
});

describe('OSDR findings and sources', () => {
  it('bundles real, linked study records', () => {
    expect(osdr.findings.length).toBeGreaterThanOrEqual(6);
    expect(osdr.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const f of osdr.findings) {
      expect(f.id).toMatch(/^OSD-\d+$/);
      expect(f.url).toBe(`https://osdr.nasa.gov/bio/repo/data/studies/${f.id}`);
      expect(f.title.length).toBeGreaterThan(10);
      expect(f.summary.length).toBeGreaterThan(60);
      expect(f.kid.length).toBeGreaterThan(40);
      expect(f.kid.length).toBeLessThan(220);
    }
  });

  it('cites the live sources in the bibliography', () => {
    for (const id of ['donki-live', 'rems-live', 'osdr']) expect(SOURCES[id]?.url).toMatch(/^https:\/\//);
    for (const id of ['sun_live_sep', 'sun_live_flare', 'sun_forecast']) expect(eventById(id)?.weight).toBe(0);
  });
});
