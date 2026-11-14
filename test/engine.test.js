import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { marsTime, missionSol, MISSIONS, earthMarsDistanceAU, sunEarthMarsAngleDeg, lightDelaySeconds } from '../src/engine/marsTime.js';
import { atmosphericTransmission, marsSolarKwh, marsSunDistanceAU, moonIsSunlit, moonSolarKwh } from '../src/engine/solar.js';
import { classifySepEvents, flareStrength, severityFromFlare, monthlyActivity } from '../src/engine/spaceWeather.js';
import { buildWeatherIndex, marsWeather, baselineTau } from '../src/engine/environment.js';
import { createRng } from '../src/engine/rng.js';
import { createMission, beginSol, resolveEvent, runSol, advance, validateLoadout, loadoutMass, setTask, toggleModule, computePower } from '../src/engine/sim.js';
import { scoreMission, debrief } from '../src/engine/scoring.js';
import { forecast, advise } from '../src/engine/advisor.js';
import { CAMPAIGN, missionById } from '../src/data/missions.js';
import { siteById } from '../src/data/sites.js';

const rems = JSON.parse(fs.readFileSync(new URL('../public/data/rems.json', import.meta.url)));
const donki = JSON.parse(fs.readFileSync(new URL('../public/data/donki.json', import.meta.url)));
const ctx = { weatherIndex: buildWeatherIndex(rems), seps: classifySepEvents(donki) };

describe('Mars time (Mars24)', () => {
  it('matches the Allison & McEwen reference example', () => {
    const t = marsTime(new Date('2000-01-06T00:00:00Z'));
    expect(t.msd).toBeCloseTo(44795.9998, 3);
    expect(t.ls).toBeCloseTo(277.1876, 2);
  });

  it('agrees with the Curiosity sol number in the REMS archive', () => {
    const last = rems.rows[rems.rows.length - 1];
    const sol = missionSol(new Date(`${last[1]}T12:00:00Z`), MISSIONS.curiosity.landing, MISSIONS.curiosity.lon);
    expect(Math.abs(sol - last[0])).toBeLessThanOrEqual(1);
  });

  it('finds the 2003 close approach and the Nov 2023 solar conjunction', () => {
    expect(earthMarsDistanceAU(new Date('2003-08-27T10:00:00Z'))).toBeCloseTo(0.3727, 2);
    expect(sunEarthMarsAngleDeg(new Date('2023-11-18T00:00:00Z'))).toBeLessThan(2);
    const delay = lightDelaySeconds(new Date('2003-08-27T10:00:00Z'));
    expect(delay / 60).toBeCloseTo(3.1, 0);
  });
});

describe('Solar power', () => {
  it('Mars is closest to the Sun at Ls 251', () => {
    expect(marsSunDistanceAU(251)).toBeLessThan(marsSunDistanceAU(71));
  });

  it('dust storms cut solar output dramatically', () => {
    expect(atmosphericTransmission(0.5)).toBeGreaterThan(0.75);
    expect(atmosphericTransmission(10.8)).toBeLessThan(0.03);
    const base = { areaM2: 100, latDeg: -4.6, ls: 90, dust: 0 };
    expect(marsSolarKwh({ ...base, tau: 4 })).toBeLessThan(marsSolarKwh({ ...base, tau: 0.5 }) * 0.4);
  });

  it('equatorial Moon sites get no solar at night', () => {
    const site = siteById('tranquility');
    const lit = Array.from({ length: 30 }, (_, d) => moonIsSunlit(site, d));
    expect(lit.filter(Boolean).length).toBeGreaterThanOrEqual(14);
    expect(lit.filter((x) => !x).length).toBeGreaterThanOrEqual(14);
    const dark = lit.findIndex((x) => !x);
    expect(moonSolarKwh({ areaM2: 100, site, dayIndex: dark, dust: 0 })).toBe(0);
  });
});

describe('Weather from Curiosity REMS', () => {
  const index = buildWeatherIndex(rems);
  it('covers most of the Martian year', () => {
    expect(index.filter(Boolean).length).toBeGreaterThan(300);
  });
  it('gives Mars-like temperatures and colder values at icy northern sites', () => {
    const gale = marsWeather(index, 90, siteById('gale'));
    const utopia = marsWeather(index, 90, siteById('utopia'));
    expect(gale.minC).toBeLessThan(-40);
    expect(gale.maxC).toBeLessThan(30);
    expect(utopia.avgC).toBeLessThan(gale.avgC);
  });
  it('dust season is dustier', () => {
    expect(baselineTau(250)).toBeGreaterThan(baselineTau(60));
  });
});

describe('Space weather from DONKI', () => {
  it('ranks flare classes', () => {
    expect(flareStrength('X1.0')).toBeGreaterThan(flareStrength('M9.9'));
    expect(severityFromFlare('X2.2')).toBe('major');
    expect(severityFromFlare('M1.0')).toBe('moderate');
    expect(severityFromFlare(null)).toBe('minor');
  });
  it('finds the major solar storms of May 2024', () => {
    const may = ctx.seps.filter((s) => new Date(s.time).toISOString().startsWith('2024-05'));
    expect(may.some((s) => s.severity === 'major')).toBe(true);
  });
  it('builds monthly activity for charts', () => {
    const months = monthlyActivity(donki);
    expect(months.length).toBeGreaterThanOrEqual(24);
    expect(months[0]).toHaveProperty('X');
  });
});

describe('Seeded RNG', () => {
  it('replays identically for the same mission code', () => {
    const a = createRng('ABC123');
    const b = createRng('ABC123');
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
});

describe('Simulation', () => {
  const cfg = missionById('red-dust');
  const fresh = () => createMission({ config: cfg, loadout: cfg.recommended, difficulty: 'cadet', code: 'TEST01' }, ctx);

  it('validates mass budgets', () => {
    const v = validateLoadout(cfg, cfg.recommended, 'cadet');
    expect(v.ok).toBe(true);
    const heavy = validateLoadout(cfg, { modules: { fission: 3, greenhouse: 3, battery: 6 }, supplies: {} }, 'cadet');
    expect(heavy.ok).toBe(false);
    expect(loadoutMass({ modules: { solar: 2 }, supplies: { water: 100 } })).toBe(600 + 110);
  });

  it('never mutates the previous mission state', () => {
    const m0 = fresh();
    const snapshot = JSON.stringify(m0);
    const m1 = advance(m0, ctx);
    expect(JSON.stringify(m0)).toBe(snapshot);
    expect(m1.sol).toBe(1);
    expect(m1.history).toHaveLength(1);
  });

  it('is deterministic for the same code', () => {
    let a = fresh();
    let b = fresh();
    for (let i = 0; i < 15; i += 1) { a = advance(a, ctx); b = advance(b, ctx); }
    expect(a).toEqual(b);
  });

  it('runs the scripted dust storm and lowers solar output', () => {
    let m = fresh();
    while (m.sol < 6) m = advance(m, ctx);
    expect(m.flags.dust_storm).toBe(true);
    expect(m.env.storm).not.toBeNull();
  });

  it('pauses for events and resumes after a choice', () => {
    let m = fresh();
    while (m.sol < 5) m = advance(m, ctx);
    m = beginSol(m, ctx);
    expect(m.phase).toBe('event');
    expect(runSol(m)).toBe(m);
    m = runSol(resolveEvent(m, 0));
    expect(m.lastReport.sol).toBe(6);
  });

  it('runs out of oxygen without supplies or generators and ends the mission', () => {
    let m = createMission({ config: cfg, loadout: { modules: { solar: 3, battery: 1 }, supplies: { o2: 10, water: 500, food: 300 } }, code: 'NOAIR' }, ctx);
    while (m.status === 'active') m = advance(m, ctx);
    expect(m.status).toBe('lost');
    expect(m.lostReason).toBe('oxygen');
  });

  it('turning machines off saves power', () => {
    const m = advance(fresh(), ctx);
    const off = toggleModule(m, 'moxie');
    expect(computePower(off).demandKwh).toBeLessThan(computePower(m).demandKwh);
  });

  it('EVAs add radiation dose and science compared to resting indoors', () => {
    const base = { ...fresh(), shield: { level: 2, work: 0 } };
    const allEva = base.crew.reduce((m, c) => setTask(m, c.id, 'science'), base);
    const allRest = base.crew.reduce((m, c) => setTask(m, c.id, 'rest'), base);
    const eva = runSol({ ...allEva, sol: 1, phase: 'plan' });
    const rest = runSol({ ...allRest, sol: 1, phase: 'plan' });
    expect(eva.crew[0].doseMsv).toBeGreaterThan(rest.crew[0].doseMsv);
    expect(eva.science).toBeGreaterThan(rest.science);
  });

  it('every campaign mission is winnable with its recommended loadout on Cadet', () => {
    const keepOn = (_m, card) => Math.max(0, card.choices.findIndex((c) => !c.effects.disable));
    for (const config of CAMPAIGN) {
      let m = createMission({ config, loadout: config.recommended, difficulty: 'cadet', code: 'WIN' }, ctx);
      while (m.status === 'active') m = advance(m, ctx, keepOn);
      expect(m.status, config.id).toBe('won');
    }
  });
});

describe('Scoring, debrief and advisor', () => {
  const cfg = missionById('artemis-dawn');
  it('awards stars and explains the result', () => {
    let m = createMission({ config: cfg, loadout: cfg.recommended, code: 'STAR' }, ctx);
    while (m.status === 'active') m = advance(m, ctx);
    const s = scoreMission(m);
    expect(s.stars).toBeGreaterThanOrEqual(1);
    expect(s.points).toBeGreaterThan(0);
    const d = debrief(m);
    expect(d.radiation).toMatch(/chest X-rays/);
    expect(d.went.length).toBeGreaterThan(0);
  });
  it('forecasts water including what the greenhouse drinks', () => {
    const green = missionById('green-thumb');
    let m = createMission({ config: green, loadout: green.recommended, code: 'WATER' }, ctx);
    m = advance(advance(m, ctx), ctx);
    const prev = m.resources.water;
    m = advance(m, ctx);
    const { life } = m.lastReport;
    expect(life.greenhouseWater).toBeGreaterThan(0);
    expect(forecast(m).water.rate).toBeCloseTo(m.resources.water - prev, 0);
  });
  it('forecasts resources and gives tips', () => {
    const m = advance(createMission({ config: cfg, loadout: { modules: { solar: 1, battery: 1 }, supplies: { o2: 20, water: 100, food: 50 } }, code: 'TIPS' }, ctx), ctx);
    const f = forecast(m);
    expect(f.o2.sols).toBeLessThan(10);
    expect(advise(m).some((t) => t.level === 'danger' || t.level === 'warn')).toBe(true);
  });
});
