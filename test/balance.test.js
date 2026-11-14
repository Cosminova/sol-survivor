// Balance targets for the day/night power model (ported from the feature/playable-game engine).
// These pin the trade-offs judges and teachers will poke at: power has to be planned, shelter matters,
// and every campaign "Recommended" pack actually wins. See docs/balance.md.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createMission, advance, validateLoadout, computePower, beginSol } from '../src/engine/sim.js';
import { daylightHours } from '../src/engine/solar.js';
import { buildWeatherIndex } from '../src/engine/environment.js';
import { classifySepEvents } from '../src/engine/spaceWeather.js';
import { CAMPAIGN, missionById, freePlayConfig } from '../src/data/missions.js';
import { LIFE_SUPPORT, RADIATION } from '../src/data/constants.js';
import { MODULES, SUPPLIES } from '../src/data/modules.js';
import { createRng } from '../src/engine/rng.js';

const rems = JSON.parse(fs.readFileSync(new URL('../public/data/rems.json', import.meta.url)));
const donki = JSON.parse(fs.readFileSync(new URL('../public/data/donki.json', import.meta.url)));
const ctx = { weatherIndex: buildWeatherIndex(rems), seps: classifySepEvents(donki) };
const SEEDS = ['ABC123', 'HELLO1', 'ZZZ999', 'NASA26', 'MARS42', 'QWERTY'];

function play(config, loadout, code, { difficulty = 'specialist', chooser = () => 0 } = {}) {
  let m = createMission({ config, loadout, difficulty, code }, ctx);
  while (m.status === 'active' && m.sol < 400) m = advance(m, ctx, chooser);
  return m;
}
const avgDose = (m) => m.crew.reduce((s, c) => s + c.doseMsv - c.transitDoseMsv, 0) / m.crew.length;
const minHealth = (m) => Math.min(100, ...m.history.map((h) => h.health));

describe('Campaign packs are winnable but not free', () => {
  for (const config of CAMPAIGN) {
    it(`${config.title}: the Recommended pack fits the budget and wins on every seed`, () => {
      expect(validateLoadout(config, config.recommended, 'specialist').ok).toBe(true);
      for (const seed of SEEDS) {
        const m = play(config, config.recommended, seed);
        expect(m.status, `${config.id} ${seed} lost: ${m.lostReason}`).toBe('won');
        expect(minHealth(m)).toBeGreaterThanOrEqual(80);
      }
    });
  }

  it('Mars packs feel the night: the battery runs low on at least one seed', () => {
    for (const id of ['red-dust', 'solar-storm', 'long-haul']) {
      const config = missionById(id);
      const lows = SEEDS.map((s) => play(config, config.recommended, s).stats.minBatteryPct);
      expect(Math.min(...lows), id).toBeLessThan(40);
    }
  });
});

describe('Power trade-offs (day/night budget)', () => {
  it('daylight hours from geometry match Curiosity sunrise/sunset at Gale (~12.3 h)', () => {
    const h = daylightHours(-4.6, 246);
    expect(h).toBeGreaterThan(11.8);
    expect(h).toBeLessThan(13.2);
  });

  it('solar charges the battery by day and the night drains it', () => {
    const config = missionById('red-dust');
    const m = beginSol(createMission({ config, loadout: config.recommended, code: 'ABC123' }, ctx), ctx);
    const p = computePower(m);
    expect(p.daylightHours).toBeGreaterThan(10);
    expect(p.nightKwh).toBeGreaterThan(100);
    expect(p.batteryAtDuskKwh).toBeGreaterThan(p.batteryAfter);
  });

  it('the lunar night needs nuclear power: solar + batteries freeze, one fission unit is cold, three are safe', () => {
    const config = missionById('long-night');
    const rec = config.recommended;
    const noFission = play(config, { modules: { ...rec.modules, fission: 0, battery: 2 }, supplies: rec.supplies }, 'ABC123');
    expect(noFission.status).toBe('lost');
    expect(noFission.lostReason).toBe('cold');
    const oneUnit = play(config, { modules: { ...rec.modules, fission: 1, battery: 2 }, supplies: rec.supplies }, 'ABC123');
    expect(oneUnit.stats.coldSols).toBeGreaterThan(5);
    const safe = play(config, rec, 'ABC123');
    expect(safe.status).toBe('won');
    expect(safe.stats.coldSols).toBe(0);
  });

  it('too little power on Mars loses the mission', () => {
    const config = missionById('red-dust');
    const rec = config.recommended;
    const m = play(config, { modules: { ...rec.modules, fission: 0, solar: 2, battery: 0 }, supplies: rec.supplies }, 'ABC123');
    expect(m.status).toBe('lost');
  });
});

describe('Radiation trade-off (real DONKI storms of May 2024)', () => {
  it('never sheltering earns more science but costs at least twice the dose', () => {
    const config = missionById('solar-storm');
    for (const seed of SEEDS.slice(0, 3)) {
      const safe = play(config, config.recommended, seed, { chooser: () => 0 });
      const bold = play(config, config.recommended, seed, { chooser: (_m, card) => card.choices.length - 1 });
      expect(avgDose(bold)).toBeGreaterThan(2 * avgDose(safe));
      expect(bold.science).toBeGreaterThan(safe.science);
    }
  });
});

describe('Robustness', () => {
  it('sourced physical constants are unchanged', () => {
    expect(LIFE_SUPPORT.o2KgPerCrewDay).toBe(0.82);
    expect(LIFE_SUPPORT.foodKgPerCrewDay).toBe(1.8);
    expect(RADIATION.marsSurfaceGcrMsvPerSol).toBe(0.64);
    expect(RADIATION.careerLimitMsv).toBe(600);
  });

  it('200 random missions: no NaN, no negative stock, deterministic replay', () => {
    const rng = createRng(20261114);
    const pick = (list) => list[Math.floor(rng.next() * list.length)];
    for (let i = 0; i < 200; i += 1) {
      const body = rng.next() < 0.5 ? 'mars' : 'moon';
      const siteId = pick(CAMPAIGN.filter((c) => c.body === body)).siteId;
      const config = freePlayConfig({ body, siteId, targetSols: 30, difficulty: 'specialist', startDate: pick(['2024-02-01', '2024-05-08', '2025-01-15']) });
      const modules = Object.fromEntries(MODULES
        .filter((mod) => !mod.body || mod.body === body)
        .map((mod) => [mod.id, Math.floor(rng.next() * (Math.min(mod.max, 3) + 1))]));
      const supplies = Object.fromEntries(SUPPLIES.map((s) => [s.id, Math.round(rng.next() * 600)]));
      const loadout = { modules, supplies };
      const code = `FZ${i}`;
      const chooser = (_m, card) => Math.floor((i * 7 + card.choices.length) % card.choices.length);
      const a = play(config, loadout, code, { chooser });
      const b = play(config, loadout, code, { chooser });
      expect(JSON.stringify(a.history)).toBe(JSON.stringify(b.history));
      for (const [k, v] of Object.entries(a.resources)) {
        expect(Number.isFinite(v), `${code} ${k}`).toBe(true);
        expect(v, `${code} ${k}`).toBeGreaterThanOrEqual(0);
      }
      expect(['won', 'lost']).toContain(a.status);
    }
  });
});
