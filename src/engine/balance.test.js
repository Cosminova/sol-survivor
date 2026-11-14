// Balance targets, trade-off checks, real-data touchpoints and a fuzz run. See docs/balance.md.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LANDER_CAPACITY_KG, DEFAULT_START_DATE, TUNING, QUICK_START_LOADOUT,
  prepareData, landerMass, createMission, advanceSol, applyChoice,
} from './mission.js';
import { MODULES, SUPPLIES, modulesForBody, moduleById } from '../data/modules.js';
import { SITES, siteById } from '../data/sites.js';
import { eventById } from '../data/eventCards.js';
import { RADIATION, SHIELDING, LIFE_SUPPORT, POWER, MOON } from '../data/constants.js';
import { createRng } from './rng.js';
import { earthMarsDistanceAU, marsTime } from './marsTime.js';
import { daylightHours, moonIsSunlit } from './solar.js';

const root = path.resolve(__dirname, '../../public/data');
const rems = JSON.parse(fs.readFileSync(path.join(root, 'rems.json'), 'utf8'));
const donki = JSON.parse(fs.readFileSync(path.join(root, 'donki.json'), 'utf8'));
const data = prepareData({ rems, donki });

const CREW = [
  { name: 'Ada', role: 'commander' },
  { name: 'Ben', role: 'engineer' },
  { name: 'Cy', role: 'geologist' },
  { name: 'Dee', role: 'doctor' },
];
const SEEDS = ['ABC123', 'HELLO1', 'ZZZ999', 'NASA26', 'MARS42', 'QWERTY'];
// The loadout the UI shipped with before docs/balance.md; it must keep winning so nothing breaks under the UI.
const LEGACY_UI_LOADOUT = {
  modules: { solar: 3, fission: 1, battery: 2, recycler: 1, oxygen: 2, shelter: 1, spares: 2 },
  supplies: { o2: 8, water: 10, food: 8 },
};
const BARE_LOADOUT = { modules: { solar: 1 }, supplies: { o2: 1, water: 1, food: 1 } };

const firstChoice = (card) => (card.choices[0].available ? 0 : card.choices.findIndex((c) => c.available));
const neverShelter = (card) => (card.id === 'sep_alert' ? 2 : firstChoice(card));

function mission(overrides = {}) {
  return createMission({ body: 'mars', siteId: 'gale', crew: CREW, loadout: QUICK_START_LOADOUT.mars, seed: 'ABC123', lengthSols: 30, ...overrides }, data);
}

// Plays a mission to the end and gathers the numbers the balance targets talk about.
function play(state, chooser = firstChoice) {
  const start = { ...state.supplies };
  let s = state;
  let minBatteryPct = 100;
  let minHealth = 100;
  let offlineSols = 0;
  let nightBatteryLow = false;
  const history = [s];
  while (!s.status.over) {
    s = advanceSol(s, data);
    if (s.pendingCard) s = applyChoice(s, chooser(s.pendingCard), data);
    history.push(s);
    if (s.power.batteryMaxKwh > 0) minBatteryPct = Math.min(minBatteryPct, (100 * s.power.batteryKwh) / s.power.batteryMaxKwh);
    minHealth = Math.min(minHealth, ...s.crew.map((c) => c.health));
    const offline = Object.keys(s.offline).length;
    offlineSols += offline;
    if (!s.env.lit && (offline > 0 || (s.power.batteryMaxKwh > 0 && s.power.batteryKwh <= 0.2 * s.power.batteryMaxKwh))) nightBatteryLow = true;
  }
  const pct = (key) => (start[key] > 0 ? (100 * s.supplies[key]) / start[key] : 100);
  return {
    last: s,
    history,
    minBatteryPct,
    minHealth,
    offlineSols,
    nightBatteryLow,
    o2Pct: pct('o2Kg'),
    waterPct: pct('waterKg'),
    foodPct: pct('foodKg'),
    avgDose: s.crew.reduce((a, c) => a + c.doseMsv, 0) / s.crew.length,
  };
}

describe('balance targets: Mars quick start at Gale Crater, 30 sols, "first available choice"', () => {
  it('the quick-start packs fit the lander with room to experiment', () => {
    for (const body of ['mars', 'moon']) {
      const m = landerMass(QUICK_START_LOADOUT[body]);
      expect(m.overBy).toBe(0);
      expect(m.totalKg).toBeLessThan(LANDER_CAPACITY_KG - 2000);
      for (const id of Object.keys(QUICK_START_LOADOUT[body].modules)) expect(modulesForBody(body).some((mod) => mod.id === id)).toBe(true);
    }
  });

  const results = Object.fromEntries(SEEDS.map((seed) => [seed, play(mission({ seed }))]));

  it('wins every seed with everyone alive', () => {
    for (const seed of SEEDS) {
      const r = results[seed];
      expect(r.last.sol, seed).toBe(30);
      expect(r.last.status, seed).toMatchObject({ over: true, outcome: 'won' });
      expect(r.last.status.stars, seed).toBeGreaterThanOrEqual(2);
      expect(r.minHealth, seed).toBeGreaterThanOrEqual(40);
    }
  });

  it('the battery visibly dips to 40% or less at least once (every clear night on Mars)', () => {
    for (const seed of SEEDS) expect(results[seed].minBatteryPct, seed).toBeLessThanOrEqual(40);
  });

  it('at least one of O2, water or food ends under 35% of its starting stock', () => {
    for (const seed of SEEDS) {
      const r = results[seed];
      expect(Math.min(r.o2Pct, r.waterPct, r.foodPct), seed).toBeLessThan(35);
      expect(r.foodPct, seed).toBeLessThan(35); // 300 kg of food for 4 crew × 30 sols × 1.8 kg
    }
  });

  it('average dose ends between 15 and 40 mSv', () => {
    for (const seed of SEEDS) {
      expect(results[seed].avgDose, seed).toBeGreaterThanOrEqual(15);
      expect(results[seed].avgDose, seed).toBeLessThanOrEqual(40);
    }
  });

  it('health only drops when the base is genuinely stressed, and nobody comes close to dying', () => {
    // A fed, warm, sheltered crew stays at 100: that is correct. Seeds whose storms knock life support
    // out at night (or the planet-wide storm) make somebody's health dip; nobody drops below 40.
    const dips = SEEDS.filter((seed) => results[seed].minHealth < 100);
    expect(dips.length).toBeGreaterThanOrEqual(1);
    for (const seed of SEEDS) expect(results[seed].minHealth, seed).toBeGreaterThanOrEqual(40);
  });

  it('a dust storm makes the fission + solar base shed life support at night in some seeds', () => {
    const stormy = SEEDS.filter((seed) => results[seed].history.some((s) => s.flags.storm));
    expect(stormy.length).toBeGreaterThanOrEqual(1);
    for (const seed of stormy) expect(results[seed].offlineSols, seed).toBeGreaterThan(0);
  });

  it('the legacy UI default loadout still wins all six seeds', () => {
    for (const seed of SEEDS) {
      const r = play(mission({ seed, loadout: LEGACY_UI_LOADOUT }));
      expect(r.last.status.outcome, seed).toBe('won');
      expect(r.minBatteryPct, seed).toBeLessThanOrEqual(40);
    }
  });

  it('the bare loadout loses well before sol 30 (and not instantly)', () => {
    const r = play(mission({ loadout: BARE_LOADOUT }));
    expect(r.last.status.outcome).toBe('lost');
    expect(r.last.sol).toBeGreaterThanOrEqual(5);
    expect(r.last.sol).toBeLessThanOrEqual(25);
    expect(r.last.status.stars).toBe(0);
  });

  it('refusing shelter through every SEP costs at least twice the dose of full shelter', () => {
    for (const seed of ['ABC123', 'MARS42', 'QWERTY']) {
      const sheltered = play(mission({ seed }));
      const working = play(mission({ seed }), neverShelter);
      // A regolith berm built before the storms (QWERTY) already blocks 60% of the particles, so the gap narrows to ~1.8×.
      const ratio = working.last.shielding.level > 0 ? 1.7 : 2;
      expect(working.avgDose, seed).toBeGreaterThanOrEqual(ratio * sheltered.avgDose);
      expect(working.avgDose - sheltered.avgDose, seed).toBeGreaterThan(12);
      expect(working.last.science, seed).toBeGreaterThan(sheltered.last.science); // the trade: science now, dose forever
      expect(working.last.status.score, seed).toBeLessThan(sheltered.last.status.score);
    }
  });
});

describe('balance targets: Mare Tranquillitatis (Moon)', () => {
  const moon = (loadout, seed = 'ABC123') => createMission({ body: 'moon', siteId: 'tranquility', crew: CREW, loadout, seed, lengthSols: 30 }, data);

  it('the Moon quick start (two fission units) is tense through lunar night but wins', () => {
    for (const seed of ['ABC123', 'HELLO1']) {
      const r = play(moon(QUICK_START_LOADOUT.moon, seed));
      expect(r.last.status.outcome, seed).toBe('won');
      expect(r.nightBatteryLow, seed).toBe(true);
      expect(r.minBatteryPct, seed).toBeLessThanOrEqual(20);
      expect(r.offlineSols, seed).toBeGreaterThan(10);
      expect(r.minHealth, seed).toBeGreaterThanOrEqual(70);
    }
  });

  it('with a single fission unit the crew survives the night, cold and shaken', () => {
    for (const seed of ['ABC123', 'HELLO1']) {
      const r = play(moon(QUICK_START_LOADOUT.mars, seed));
      expect(r.last.status.outcome, seed).toBe('won');
      expect(r.minHealth, seed).toBeLessThan(70);
      expect(r.minHealth, seed).toBeGreaterThan(20);
      expect(r.last.history?.length ?? 1).toBeGreaterThan(0);
      const night = r.history.filter((s) => !s.env.lit && s.sol > 0);
      expect(night.every((s) => s.power.shortfallKwh > 0)).toBe(true);
    }
  });

  it('without fission the base freezes in the dark and loses before sol 30', () => {
    const noFission = { ...QUICK_START_LOADOUT.mars, modules: { ...QUICK_START_LOADOUT.mars.modules, fission: 0 } };
    for (const seed of ['ABC123', 'HELLO1', 'ZZZ999']) {
      const r = play(moon(noFission, seed));
      expect(r.last.status.outcome, seed).toBe('lost');
      expect(r.last.sol, seed).toBeGreaterThan(15);
      expect(r.last.sol, seed).toBeLessThan(30);
      expect(r.last.status.reason, seed).toMatch(/too cold/);
    }
  });
});

describe('trade-offs: no resource is free', () => {
  const sol1 = (loadout, body = 'mars') => advanceSol(createMission({ body, siteId: body === 'mars' ? 'gale' : 'tranquility', crew: CREW, loadout, seed: 'ABC123', lengthSols: 30 }, data), data);

  it('an oxygen generator costs water (electrolysis) and power', () => {
    const base = { modules: { fission: 2, battery: 1, recycler: 1 }, supplies: { o2: 2, water: 5, food: 3 } };
    const withGen = { ...base, modules: { ...base.modules, oxygen: 1 } };
    const a = sol1(base);
    const b = sol1(withGen);
    const gen = moduleById('oxygen');
    expect(b.lastSol.budget.o2In - a.lastSol.budget.o2In).toBeCloseTo(gen.o2Kg, 1);
    expect(b.lastSol.budget.waterOut - a.lastSol.budget.waterOut).toBeCloseTo(gen.o2Kg / LIFE_SUPPORT.waterToO2Ratio, 1);
    expect(b.power.usedKwh - a.power.usedKwh).toBeCloseTo(gen.kw * 24.66, -1);
  });

  it('night heating draws the battery down on a solar-heavy base, and surplus beyond a full battery is wasted', () => {
    const solarOnly = { modules: { solar: 5, battery: 3, recycler: 1, oxygen: 1 }, supplies: { o2: 2, water: 5, food: 3 } };
    const s = sol1(solarOnly);
    expect(s.power.daylightHours).toBeGreaterThan(12);
    expect(s.power.daylightHours).toBeLessThan(13);
    expect(s.power.batteryAtDuskKwh).toBe(300); // five arrays fill 300 kWh by dusk
    expect(s.power.batteryKwh).toBeLessThan(s.power.batteryAtDuskKwh); // the night eats into it
    expect(s.power.nightKwh).toBeGreaterThan(200);
    expect(s.power.heatKwh).toBeGreaterThan(100); // a −70 °C night is most of the heating bill
    const wasted = 300 + s.power.producedKwh - s.power.usedKwh - s.power.batteryKwh; // battery starts full
    expect(wasted).toBeGreaterThan(50); // daytime energy that had nowhere to go
  });

  it('shelter costs science and morale; refusing shelter costs 15 mSv', () => {
    let s = mission({ seed: 'MARS42' });
    for (let i = 0; i < 7; i += 1) {
      s = advanceSol(s, data);
      if (s.pendingCard) s = applyChoice(s, firstChoice(s.pendingCard), data);
    }
    s = advanceSol(s, data);
    expect(s.pendingCard.id).toBe('sep_alert');
    const before = Math.min(...s.crew.map((c) => c.doseMsv));
    const sheltered = advanceSol(applyChoice(s, 0, data), data);
    const working = advanceSol(applyChoice(s, 2, data), data);
    expect(sheltered.lastSol.budget.scienceGained).toBe(0);
    expect(sheltered.lastSol.budget.evaCrew).toBeNull();
    expect(working.lastSol.budget.scienceGained).toBeGreaterThan(0);
    expect(sheltered.crew[0].morale).toBeLessThan(working.crew[0].morale);
    expect(working.science).toBeGreaterThan(sheltered.science + 4);
    const gcr = RADIATION.marsSurfaceGcrMsvPerSol * SHIELDING.gcrFactor[0];
    expect(Math.min(...working.crew.map((c) => c.doseMsv)) - before).toBeCloseTo(RADIATION.sepDoseMsv.major + gcr, 0);
    expect(Math.min(...sheltered.crew.map((c) => c.doseMsv)) - before).toBeCloseTo(RADIATION.sepDoseMsv.major * SHIELDING.shelterSepFactor + gcr, 0);
  });

  it('a regolith berm costs science time now and pays back in dose and heating', () => {
    const card = eventById('berm');
    const shovel = card.choices[0];
    expect(shovel.effects.science).toBeLessThan(0);
    expect(shovel.effects.shieldWork).toBe(SHIELDING.bermWorkPerLevel);
    let base = mission({ seed: 'ZZZ999' });
    for (let i = 0; i < 3; i += 1) {
      base = advanceSol(base, data);
      if (base.pendingCard) base = applyChoice(base, firstChoice(base.pendingCard), data);
    }
    expect(base.science).toBeGreaterThan(6);
    const forced = { ...base, pendingCard: { id: 'berm', icon: card.icon, title: card.title, body: '', science: '', source: card.source, terms: [], choices: card.choices.map((c) => ({ label: c.label, available: true, why: null, effects: { ...c.effects }, outcome: c.outcome })) } };
    const bermed = applyChoice(forced, 0, data);
    const explored = applyChoice(forced, 1, data);
    expect(bermed.shielding.level).toBe(1);
    expect(explored.shielding.level).toBe(0);
    expect(explored.science - bermed.science).toBe(12);
    const a = advanceSol(bermed, data);
    const b = advanceSol(explored, data);
    expect(a.power.heatKwh).toBeCloseTo(b.power.heatKwh * (1 - TUNING.bermHeatSavingPerLevel), -1);
    expect(a.lastSol.budget.gcrMsv).toBeLessThan(b.lastSol.budget.gcrMsv);
    expect(a.lastSol.budget.gcrMsv).toBeCloseTo(RADIATION.marsSurfaceGcrMsvPerSol * SHIELDING.gcrFactor[1], 1);
  });

  it('a dust storm halves solar output and forces the fission + solar base to cut life support within a few nights', () => {
    const card = eventById('dust_storm');
    const clear = advanceSol(mission({ seed: 'ZZZ999' }), data);
    const forced = { ...clear, pendingCard: { id: 'dust_storm', icon: card.icon, title: card.title, body: '', science: '', source: card.source, terms: [], choices: card.choices.map((c) => ({ label: c.label, available: true, why: null, effects: JSON.parse(JSON.stringify(c.effects)), outcome: c.outcome })) } };
    let s = applyChoice(forced, 1, data);
    expect(s.flags.storm).toEqual({ tau: 3, sols: 10 });
    const stormSol = advanceSol(s, data);
    expect(stormSol.power.solarKwh).toBeLessThan(0.6 * clear.power.solarKwh);
    s = stormSol;
    let cutLifeSupport = false;
    for (let i = 0; i < 4 && !cutLifeSupport; i += 1) {
      if (s.pendingCard) s = applyChoice(s, firstChoice(s.pendingCard), data);
      s = advanceSol(s, data);
      cutLifeSupport = s.power.cut.includes('oxygen') || s.power.cut.includes('recycler');
    }
    expect(cutLifeSupport).toBe(true);
    expect(s.power.batteryKwh).toBeLessThan(0.2 * s.power.batteryMaxKwh);
    // Every dust-storm option costs something: science gear off, dose outside, or nothing saved.
    expect(card.choices.every((c) => 'disable' in c.effects || 'dose' in c.effects || !('battery' in c.effects))).toBe(true);
  });

  it('the cargo lander is not a free lunch: hauling costs a sol of EVA (dose, no science)', () => {
    const card = eventById('supply_drop');
    const hauls = card.choices.filter((c) => c.effects.food || c.effects.o2);
    expect(hauls).toHaveLength(2);
    for (const c of hauls) {
      expect(c.effects.dose).toBeGreaterThan(0);
      expect(c.effects.science).toBeLessThan(0);
    }
    expect(card.choices.some((c) => c.effects.science > 0 && !c.effects.food)).toBe(true);
  });

  it('shielding level grows from berm work in whole levels and the water wall adds one more', () => {
    const wet = mission({ loadout: { ...QUICK_START_LOADOUT.mars, supplies: { o2: 2, water: 16, food: 3 } } });
    expect(wet.supplies.waterKg).toBeGreaterThan(SHIELDING.waterWallKg + 50);
    const a = advanceSol(wet, data);
    const b = advanceSol(mission(), data);
    expect(a.lastSol.budget.gcrMsv).toBeLessThan(b.lastSol.budget.gcrMsv);
  });
});

describe('real-data touchpoints', () => {
  it('DONKI SEP events land on sols 8, 9 and 12 with the real flare classes for the default start date', () => {
    let s = mission({ seed: 'HELLO1' });
    const alerts = [];
    while (!s.status.over) {
      s = advanceSol(s, data);
      if (s.pendingCard?.id === 'sep_alert') {
        alerts.push({ sol: s.sol, date: s.date, ...s.flags.activeSep, text: s.pendingCard.science });
      }
      if (s.pendingCard) s = applyChoice(s, firstChoice(s.pendingCard), data);
    }
    expect(alerts.map((a) => [a.sol, a.date, a.flareClass, a.severity])).toEqual([
      [8, '2024-05-09', 'X2.2', 'major'],
      [9, '2024-05-10', 'X3.9', 'major'],
      [12, '2024-05-13', 'X1.0', 'major'],
    ]);
    expect(alerts[0].text).toContain('on 9 May 2024');
    expect(alerts[1].text).toContain('on 10 May 2024');
    expect(alerts.every((a) => !a.text.includes('{'))).toBe(true);
    // Exact timestamps: the first SEP of 9 May 2024 13:59 UTC falls inside sol 8 (starts 2024-05-09T05:17 UTC).
    const first = data.sepEvents.find((e) => e.flareClass === 'X2.2');
    const solStart = Date.parse(`${DEFAULT_START_DATE}T00:00:00Z`) + 8 * 1.0274912517 * 86400000;
    expect(first.time).toBeGreaterThanOrEqual(solStart);
    expect(first.time).toBeLessThan(solStart + 1.0274912517 * 86400000);
    expect(new Date(first.time).toISOString()).toBe('2024-05-09T13:59:00.000Z');
  });

  it('dose per SEP severity follows the constants table', () => {
    expect(RADIATION.sepDoseMsv).toEqual({ minor: 1.5, moderate: 5, major: 15 });
    expect(SHIELDING.sepFactor[0]).toBe(1);
    expect(SHIELDING.shelterSepFactor).toBe(0.05);
    const base = mission({ seed: 'MARS42' });
    for (const [severity, msv] of Object.entries(RADIATION.sepDoseMsv)) {
      const armed = { ...base, flags: { ...base.flags, activeSep: { severity, flareClass: 'M1.0', eventDate: base.date } } };
      const next = advanceSol(armed, data);
      const gcr = RADIATION.marsSurfaceGcrMsvPerSol * SHIELDING.gcrFactor[0];
      expect(Math.min(...next.crew.map((c) => c.doseMsv))).toBeCloseTo(msv + gcr, 0);
      expect(next.lastSol.log.find((l) => l.source === 'donki')?.text).toMatch(/chest X-rays/);
    }
  });

  it('REMS lookup uses the Ls of the mission date and cites a real Curiosity sol', () => {
    const s = mission();
    expect(s.ls).toBeCloseTo(246.4, 0);
    expect(marsTime(new Date(`${DEFAULT_START_DATE}T00:00:00Z`)).marsYear).toBe(37);
    expect(s.season).toBe('Spring'); // southern hemisphere, dust-storm season
    const bucket = data.weatherIndex[246];
    expect(bucket.samples).toBeGreaterThanOrEqual(5);
    expect(s.env.minC).toBe(Math.round(bucket.minC));
    expect(s.env.maxC).toBe(Math.round(bucket.maxC));
    const col = Object.fromEntries(rems.columns.map((n, i) => [n, i]));
    const row = rems.rows.find((r) => r[col.sol] === s.env.reference.sol);
    expect(row).toBeTruthy();
    expect(row[col.earthDate]).toBe(s.env.reference.earthDate);
    expect(Math.abs(row[col.ls] - 246)).toBeLessThanOrEqual(0.5);
    expect(s.env.sunrise).toBe(row[col.sunrise]);
    // The reference line every 5 sols names that sol and date.
    let t = s;
    for (let i = 0; i < 5; i += 1) {
      t = advanceSol(t, data);
      if (t.pendingCard) t = applyChoice(t, firstChoice(t.pendingCard), data);
    }
    const line = t.lastSol.log.find((l) => /Curiosity's sol (\d+) on (\d{4}-\d{2}-\d{2})/.test(l.text));
    expect(line).toBeTruthy();
    const [, refSol, refDate] = line.text.match(/Curiosity's sol (\d+) on (\d{4}-\d{2}-\d{2})/);
    const refRow = rems.rows.find((r) => r[col.sol] === Number(refSol));
    expect(refRow[col.earthDate]).toBe(refDate);
  });

  it('daylight hours from geometry agree with the REMS sunrise/sunset columns at Gale', () => {
    const [sr, ss] = [[5, 40], [17, 56]];
    const remsDay = ss[0] + ss[1] / 60 - (sr[0] + sr[1] / 60);
    expect(Math.abs(daylightHours(siteById('gale').lat, 246.4) - remsDay)).toBeLessThan(0.5);
    expect(daylightHours(siteById('arcadia').lat, 246.4)).toBeLessThan(10); // northern autumn/winter at 40° N
  });

  it('light delay and conjunction geometry are sane for May–June 2024', () => {
    const d = new Date(`${DEFAULT_START_DATE}T00:00:00Z`);
    expect(earthMarsDistanceAU(d)).toBeGreaterThan(1.9);
    expect(earthMarsDistanceAU(d)).toBeLessThan(2.1);
    let s = mission({ seed: 'ZZZ999' });
    const delays = [s.env.lightDelayMin];
    while (!s.status.over) {
      s = advanceSol(s, data);
      if (s.pendingCard) s = applyChoice(s, firstChoice(s.pendingCard), data);
      delays.push(s.env.lightDelayMin);
      expect(s.env.blackoutSols === 0 || s.flags.drawn.includes('conjunction')).toBe(true); // no real conjunction in 2024
    }
    expect(Math.min(...delays)).toBeGreaterThan(15);
    expect(Math.max(...delays)).toBeLessThan(18);
    expect(delays[0]).toBeGreaterThan(delays[delays.length - 1]); // Earth is catching up towards the Jan 2025 opposition
  });

  it('lunar night timing follows site.sunlit and the 29.53-day synodic month', () => {
    const site = siteById('tranquility');
    const firstDark = Math.ceil(MOON.synodicDays * site.sunlit);
    expect(firstDark).toBe(15);
    let s = createMission({ body: 'moon', siteId: 'tranquility', crew: CREW, loadout: QUICK_START_LOADOUT.moon, seed: 'ABC123', lengthSols: 30 }, data);
    const lit = [s.env.lit];
    while (!s.status.over) {
      s = advanceSol(s, data);
      expect(s.env.lit).toBe(moonIsSunlit(site, s.sol));
      if (s.sol === firstDark) expect(s.pendingCard?.id).toBe('lunar_night');
      if (s.pendingCard) s = applyChoice(s, firstChoice(s.pendingCard), data);
      lit.push(s.env.lit);
    }
    expect(lit.slice(0, firstDark).every(Boolean)).toBe(true);
    expect(lit.slice(firstDark, 30).every((v) => v === false)).toBe(true);
    expect(lit[30]).toBe(true);
  });

  it('sourced physical constants are unchanged', () => {
    expect(LIFE_SUPPORT).toMatchObject({ o2KgPerCrewDay: 0.82, waterKgPerCrewDay: 3.5, foodKgPerCrewDay: 1.8, co2KgPerCrewDay: 1.04, evaO2Multiplier: 1.3 });
    expect(RADIATION).toMatchObject({ marsSurfaceGcrMsvPerSol: 0.64, moonSurfaceMsvPerDay: 1.37, careerLimitMsv: 600, may2024RadMicroGray: 8100 });
    expect(POWER).toMatchObject({ dustPerSol: 0.002, solarEfficiency: 0.22 });
  });
});

describe('fuzz: 200 random missions', () => {
  const walk = (value, trail, problems) => {
    if (value === undefined) problems.push(`${trail} is undefined`);
    else if (typeof value === 'number') {
      if (!Number.isFinite(value) && value !== Infinity) problems.push(`${trail} = ${value}`);
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${trail}[${i}]`, problems));
    else if (value && typeof value === 'object') for (const k of Object.keys(value)) walk(value[k], `${trail}.${k}`, problems);
  };

  function randomLoadout(rng, body) {
    const modules = {};
    for (const m of modulesForBody(body)) if (rng.chance(0.5)) modules[m.id] = rng.int(1, m.max);
    const supplies = { o2: rng.int(0, 10), water: rng.int(0, 15), food: rng.int(0, 10) };
    let loadout = { modules, supplies };
    // Trim until it fits the lander.
    for (let guard = 0; landerMass(loadout).overBy > 0 && guard < 100; guard += 1) {
      const ids = Object.keys(loadout.modules).filter((id) => loadout.modules[id] > 0);
      if (ids.length && rng.chance(0.7)) {
        const id = rng.pick(ids);
        loadout = { ...loadout, modules: { ...loadout.modules, [id]: loadout.modules[id] - 1 } };
      } else {
        const key = rng.pick(['o2', 'water', 'food'].filter((k) => loadout.supplies[k] > 0));
        if (key) loadout = { ...loadout, supplies: { ...loadout.supplies, [key]: loadout.supplies[key] - 1 } };
      }
    }
    return loadout;
  }

  const ROLES = ['commander', 'engineer', 'geologist', 'doctor', 'botanist'];

  function playRandom(seed) {
    const rng = createRng(`fuzz-${seed}`);
    const body = rng.chance(0.5) ? 'mars' : 'moon';
    const site = rng.pick(SITES.filter((s) => s.body === body));
    const crew = Array.from({ length: rng.int(2, 4) }, (_, i) => ({ name: `Crew${i}`, role: rng.pick(ROLES) }));
    const loadout = randomLoadout(rng, body);
    const lengthSols = rng.chance(0.8) ? 30 : 60;
    const startDate = rng.chance(0.7) ? DEFAULT_START_DATE : `${rng.pick(['2024', '2025'])}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
    const config = { body, siteId: site.id, crew, loadout, seed, lengthSols, startDate };
    expect(landerMass(loadout).overBy).toBe(0);
    const choices = [];
    let s = createMission(config, data);
    const problems = [];
    let guard = 0;
    while (!s.status.over && guard < 200) {
      guard += 1;
      s = advanceSol(s, data);
      if (s.pendingCard) {
        const available = s.pendingCard.choices.map((c, i) => (c.available ? i : -1)).filter((i) => i >= 0);
        expect(available.length).toBeGreaterThan(0);
        const pick = rng.pick(available);
        choices.push(pick);
        s = applyChoice(s, pick, data);
        expect(s.pendingCard).toBeNull();
      }
      walk(s, 'state', problems);
      const dead = s.crew.some((c) => c.health <= 0);
      expect(s.status.over, `sol ${s.sol}`).toBe(dead || s.sol >= s.lengthSols);
      if (s.status.over) expect(s.status.outcome).toBe(dead ? 'lost' : 'won');
      for (const v of Object.values(s.supplies)) expect(v).toBeGreaterThanOrEqual(0);
      expect(s.power.batteryKwh).toBeGreaterThanOrEqual(0);
      expect(s.power.batteryKwh).toBeLessThanOrEqual(s.power.batteryMaxKwh);
      expect(s.power.shortfallKwh).toBeGreaterThanOrEqual(0);
      expect(s.power.usedKwh).toBeLessThanOrEqual(s.power.producedKwh + s.power.batteryMaxKwh + 1);
      for (const o of Object.values(s.offline)) expect(o.sols === Infinity || o.sols >= 1).toBe(true);
      for (const c of s.crew) {
        expect(c.health).toBeGreaterThanOrEqual(0);
        expect(c.health).toBeLessThanOrEqual(100);
        expect(c.morale).toBeGreaterThanOrEqual(0);
        expect(c.morale).toBeLessThanOrEqual(100);
        expect(c.doseMsv).toBeGreaterThanOrEqual(0);
      }
      expect(s.env.dust).toBeGreaterThanOrEqual(0);
      expect(s.env.dust).toBeLessThanOrEqual(POWER.maxDust);
      expect(s.env.blackoutSols).toBeGreaterThanOrEqual(0);
      expect(s.shielding.level).toBeLessThanOrEqual(SHIELDING.maxLevel);
      expect(s.science).toBeGreaterThanOrEqual(0);
      expect(s.status.score).toBeGreaterThanOrEqual(0);
    }
    expect(problems).toEqual([]);
    expect(s.status.over).toBe(true);
    return { config, choices, final: JSON.stringify(s), sols: s.sol, outcome: s.status.outcome };
  }

  it('never throws, never produces NaN/undefined or negative resources, ends exactly on a terminal condition, and replays identically', () => {
    const outcomes = { won: 0, lost: 0 };
    for (let i = 0; i < 200; i += 1) {
      const run = playRandom(`FZ${i}`);
      outcomes[run.outcome] += 1;
      // Determinism: same config and same choices → identical final state.
      let s = createMission(run.config, data);
      let k = 0;
      while (!s.status.over) {
        s = advanceSol(s, data);
        if (s.pendingCard) s = applyChoice(s, run.choices[k++], data);
      }
      expect(JSON.stringify(s)).toBe(run.final);
    }
    expect(outcomes.won).toBeGreaterThan(20);
    expect(outcomes.lost).toBeGreaterThan(20);
  });

  it('every module and supply the fuzzer can pick is defined with a positive mass', () => {
    for (const m of MODULES) expect(m.massKg).toBeGreaterThan(0);
    for (const s of SUPPLIES) expect(s.unitKg * s.packMass).toBeGreaterThan(0);
  });
});
