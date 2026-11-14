import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LANDER_CAPACITY_KG, MISSION_LENGTHS, DEFAULT_START_DATE, TUNING,
  prepareData, landerMass, createMission, advanceSol, applyChoice, describeEffects, missionStatus,
} from './mission.js';
import { moduleById } from '../data/modules.js';

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
const GOOD_LOADOUT = {
  modules: { solar: 3, fission: 1, battery: 2, recycler: 1, oxygen: 2, shelter: 1, spares: 2 },
  supplies: { o2: 8, water: 10, food: 8 },
};
const BARE_LOADOUT = { modules: { solar: 1 }, supplies: { o2: 1, water: 1, food: 1 } };

const mars = (overrides = {}) => ({ body: 'mars', siteId: 'gale', crew: CREW, loadout: GOOD_LOADOUT, seed: 'ABC123', lengthSols: 30, ...overrides });
const moon = (overrides = {}) => ({ body: 'moon', siteId: 'tranquility', crew: CREW, loadout: GOOD_LOADOUT, seed: 'ABC123', lengthSols: 30, ...overrides });

// Index 0 if available, else the first available choice.
const firstChoice = (card) => (card.choices[0].available ? 0 : card.choices.findIndex((c) => c.available));
// First available choice that does not switch machines off (keeps the greenhouse running in tests).
const keepRunning = (card) => {
  const i = card.choices.findIndex((c) => c.available && !('disable' in c.effects) && !('disableSols' in c.effects));
  return i >= 0 ? i : firstChoice(card);
};

function step(state, chooser = firstChoice, d = data) {
  let s = advanceSol(state, d);
  if (s.pendingCard) s = applyChoice(s, chooser(s.pendingCard), d);
  return s;
}

function run(state, sols, chooser = firstChoice, d = data) {
  const history = [state];
  let s = state;
  for (let i = 0; i < sols && !s.status.over; i += 1) {
    s = step(s, chooser, d);
    history.push(s);
  }
  return history;
}

describe('constants and data', () => {
  it('exports the contract constants', () => {
    expect(LANDER_CAPACITY_KG).toBe(12000);
    expect(MISSION_LENGTHS).toEqual([30, 60]);
    expect(DEFAULT_START_DATE).toBe('2024-05-01');
  });

  it('prepareData builds the weather index, SEP list and REMS extras', () => {
    expect(data.weatherIndex).toHaveLength(360);
    expect(data.sepEvents.length).toBeGreaterThan(10);
    expect(data.remsBySol[1234]).toEqual({ opacity: 'Sunny', uv: 'Moderate', sunrise: '05:50', sunset: '17:33' });
  });
});

describe('landerMass', () => {
  it('sums module and crate mass and reports overBy only when too heavy', () => {
    const m = landerMass(GOOD_LOADOUT);
    expect(m.modulesKg).toBe(6600);
    expect(m.suppliesKg).toBe(3340);
    expect(m.totalKg).toBe(9940);
    expect(m.overBy).toBe(0);
    expect(m.totalKg).toBeLessThanOrEqual(LANDER_CAPACITY_KG);
  });

  it('flags an overweight lander', () => {
    const heavy = landerMass({ modules: { fission: 3, greenhouse: 3, rover: 1, battery: 6 }, supplies: { o2: 10, water: 10, food: 10 } });
    expect(heavy.totalKg).toBeGreaterThan(LANDER_CAPACITY_KG);
    expect(heavy.overBy).toBe(heavy.totalKg - LANDER_CAPACITY_KG);
  });

  it('handles an empty loadout', () => {
    expect(landerMass({})).toEqual({ modulesKg: 0, suppliesKg: 0, totalKg: 0, overBy: 0 });
  });
});

describe('createMission', () => {
  it('builds the contract state shape', () => {
    const s = createMission(mars(), data);
    expect(s.code).toBe('ABC123');
    expect(s.sol).toBe(0);
    expect(s.date).toBe('2024-05-01');
    expect(s.site.id).toBe('gale');
    expect(s.ls).toBeCloseTo(246.4, 0);
    expect(s.season).toBe('Spring');
    expect(s.crew).toHaveLength(4);
    expect(s.crew[0]).toEqual({ name: 'Ada', role: 'commander', health: 100, morale: 100, doseMsv: 0 });
    expect(s.supplies).toEqual({ o2Kg: 800, waterKg: 1000, foodKg: 800, spares: 2 });
    expect(s.power.batteryMaxKwh).toBe(200);
    expect(s.power.batteryKwh).toBe(200);
    expect(s.env).toMatchObject({ lit: true, dust: 0, stormSols: 0, blackoutSols: 0 });
    expect(typeof s.env.minC).toBe('number');
    expect(s.env.uv).toBeTruthy();
    expect(s.env.sunrise).toMatch(/^\d\d:\d\d$/);
    expect(s.env.sunset).toMatch(/^\d\d:\d\d$/);
    expect(s.shielding).toEqual({ level: 0, bermWork: 0, shelterMode: null });
    expect(s.flags.drawn).toEqual([]);
    expect(s.pendingCard).toBeNull();
    expect(s.status).toMatchObject({ over: false, outcome: null });
    expect(missionStatus(s)).toBe(s.status);
    expect(s.lastSol.log.some((l) => l.source === 'rems')).toBe(true);
  });

  it('works with data = null (fallback weather, no SEP events)', () => {
    const s0 = createMission(mars(), null);
    expect(s0.env.minC).toBe(-75);
    expect(s0.env.uv).toBeNull();
    const hist = run(s0, 30, firstChoice, null);
    const last = hist[hist.length - 1];
    expect(last.status.outcome).toBe('won');
    expect(hist.some((s) => s.flags.drawn.includes('sep_alert') || s.lastSol.log.some((l) => l.source === 'donki' && /storm alert/.test(l.text)))).toBe(false);
  });

  it('is null for Mars-only fields on the Moon', () => {
    const s = createMission(moon(), data);
    expect(s.ls).toBeNull();
    expect(s.season).toBeNull();
    expect(s.env.lit).toBe(true);
    expect(s.env.pressurePa).toBe(0);
  });

  it('never mutates its inputs', () => {
    const input = mars();
    const before = JSON.stringify(input);
    const s0 = createMission(input, data);
    const s1 = advanceSol(s0, data);
    expect(JSON.stringify(input)).toBe(before);
    expect(s0.sol).toBe(0);
    expect(s1.sol).toBe(1);
    expect(s1).not.toBe(s0);
  });
});

describe('determinism', () => {
  it('same inputs and choices give JSON-identical states', () => {
    const a = run(createMission(mars({ seed: 'HELLO1' }), data), 30);
    const b = run(createMission(mars({ seed: 'HELLO1' }), data), 30);
    expect(a.length).toBe(b.length);
    a.forEach((s, i) => expect(JSON.stringify(s)).toBe(JSON.stringify(b[i])));
  });

  it('different seeds diverge', () => {
    const a = run(createMission(mars({ seed: 'HELLO1' }), data), 30).map((s) => s.rng);
    const b = run(createMission(mars({ seed: 'ZZZ999' }), data), 30).map((s) => s.rng);
    expect(a).not.toEqual(b);
  });
});

describe('turn guards', () => {
  const toFirstCard = () => {
    let s = createMission(mars(), data);
    while (!s.pendingCard && s.sol < 30) s = advanceSol(s, data);
    return s;
  };

  it('advanceSol refuses while a card is pending', () => {
    const s = toFirstCard();
    expect(s.pendingCard).not.toBeNull();
    expect(advanceSol(s, data)).toBe(s);
  });

  it('advanceSol refuses once the mission is over', () => {
    const hist = run(createMission(mars(), data), 30);
    const last = hist[hist.length - 1];
    expect(last.status.over).toBe(true);
    expect(advanceSol(last, data)).toBe(last);
  });

  it('applyChoice refuses unavailable or missing choices', () => {
    const s = toFirstCard();
    expect(applyChoice(s, 99, data)).toBe(s);
    const unavailable = {
      ...s,
      pendingCard: { ...s.pendingCard, choices: [{ ...s.pendingCard.choices[0], available: false, why: 'Needs a Storm Shelter' }] },
    };
    expect(applyChoice(unavailable, 0, data)).toBe(unavailable);
    expect(applyChoice(createMission(mars(), data), 0, data).pendingCard).toBeNull();
  });
});

describe('scenarios', () => {
  it('a sensible Gale Crater loadout survives 30 sols with everyone alive', () => {
    for (const seed of ['ABC123', 'HELLO1', 'ZZZ999', 'NASA26']) {
      const hist = run(createMission(mars({ seed }), data), 30);
      const last = hist[hist.length - 1];
      expect(last.sol).toBe(30);
      expect(last.status).toMatchObject({ over: true, outcome: 'won', stars: 3 });
      expect(last.crew.every((c) => c.health > 0)).toBe(true);
      expect(last.status.score).toBeGreaterThan(0);
      expect(Math.min(...hist.map((s) => s.supplies.o2Kg))).toBeGreaterThan(0);
    }
  });

  it('a bare loadout loses before sol 30', () => {
    const hist = run(createMission(mars({ loadout: BARE_LOADOUT }), data), 30);
    const last = hist[hist.length - 1];
    expect(last.status.over).toBe(true);
    expect(last.status.outcome).toBe('lost');
    expect(last.sol).toBeLessThan(30);
    expect(last.status.stars).toBe(0);
    expect(last.status.reason).toMatch(/ran out of|too/);
    expect(last.crew.some((c) => c.health === 0)).toBe(true);
  });
});

describe('solar particle events (DONKI replay)', () => {
  const toSep = (loadout = GOOD_LOADOUT) => {
    let s = createMission(mars({ loadout, seed: 'MARS42' }), data);
    for (let i = 0; i < 8; i += 1) s = step(s);
    return s;
  };

  it('queues sep_alert on the sol holding the 9 May 2024 X2.2 event', () => {
    let s = createMission(mars({ seed: 'MARS42' }), data);
    for (let i = 0; i < 7; i += 1) s = step(s);
    s = advanceSol(s, data);
    expect(s.sol).toBe(8);
    expect(s.date).toBe('2024-05-09');
    expect(s.pendingCard.id).toBe('sep_alert');
    expect(s.pendingCard.body).toContain('X2.2');
    expect(s.pendingCard.body).not.toContain('{');
    expect(s.pendingCard.science).toContain('9 May 2024');
    expect(s.pendingCard.source).toBe('donki');
    expect(s.flags.activeSep).toMatchObject({ severity: 'major', flareClass: 'X2.2' });
    expect(s.lastSol.log.some((l) => l.source === 'donki')).toBe(true);
  });

  it('shelter gives a far lower dose than keeping working', () => {
    let s = createMission(mars({ seed: 'MARS42' }), data);
    for (let i = 0; i < 7; i += 1) s = step(s);
    s = advanceSol(s, data);
    expect(s.pendingCard.id).toBe('sep_alert');
    expect(s.pendingCard.choices[0].available).toBe(true);
    const before = s.crew[0].doseMsv;
    const sheltered = advanceSol(applyChoice(s, 0, data), data);
    const partial = advanceSol(applyChoice(s, 1, data), data);
    const working = advanceSol(applyChoice(s, 2, data), data);
    const gain = (st) => st.crew[1].doseMsv - before; // crew[1] is not on EVA on sol 9 (9 % 4 = 1)... use a crew member either way
    const inside = (st) => Math.min(...st.crew.map((c) => c.doseMsv)) - before;
    expect(inside(sheltered)).toBeLessThan(inside(partial));
    expect(inside(partial)).toBeLessThan(inside(working));
    expect(inside(working) - inside(sheltered)).toBeGreaterThan(10); // 15 mSv × (1 − 0.05) minus rounding
    expect(gain(working)).toBeGreaterThan(gain(sheltered));
    expect(sheltered.shielding.shelterMode).toBeNull();
    // Sol 9 carries the next real event (10 May 2024, X3.9), so a fresh alert is armed.
    expect(sheltered.flags.activeSep).toMatchObject({ flareClass: 'X3.9', severity: 'major' });
    expect(sheltered.pendingCard?.id).toBe('sep_alert');
    expect(sheltered.lastSol.log.some((l) => l.source === 'donki' && /mSv/.test(l.text))).toBe(true);
  });

  it('marks the shelter choice unavailable with a reason when no shelter is packed', () => {
    const loadout = { ...GOOD_LOADOUT, modules: { ...GOOD_LOADOUT.modules, shelter: 0 } };
    let s = createMission(mars({ loadout, seed: 'MARS42' }), data);
    for (let i = 0; i < 7; i += 1) s = step(s);
    s = advanceSol(s, data);
    expect(s.pendingCard.id).toBe('sep_alert');
    expect(s.pendingCard.choices[0]).toMatchObject({ available: false, why: 'Needs a Storm Shelter' });
    expect(applyChoice(s, 0, data)).toBe(s);
    expect(applyChoice(s, 1, data).pendingCard).toBeNull();
  });

  it('a never-answered alert counts as no shelter', () => {
    let s = createMission(mars({ seed: 'MARS42' }), data);
    for (let i = 0; i < 7; i += 1) s = step(s);
    s = advanceSol(s, data);
    const forced = { ...s, pendingCard: null };
    const next = advanceSol(forced, data);
    expect(Math.min(...next.crew.map((c) => c.doseMsv)) - s.crew[0].doseMsv).toBeGreaterThan(10);
  });
});

describe('Moon', () => {
  const loadout = { modules: { solar: 2, battery: 2, recycler: 1, oxygen: 2, spares: 2 }, supplies: { o2: 6, water: 8, food: 6 } };

  it('lunar night falls at Mare Tranquillitatis and solar output drops to 0', () => {
    let s = createMission(moon({ loadout }), data);
    for (let i = 0; i < 14; i += 1) s = step(s);
    expect(s.env.lit).toBe(true);
    expect(s.power.producedKwh).toBeGreaterThan(0);
    expect(s.power.batteryKwh).toBe(200); // two weeks of 24 h sunshine keep the battery full
    s = advanceSol(s, data);
    expect(s.sol).toBe(15);
    expect(s.env.lit).toBe(false);
    expect(s.power.producedKwh).toBe(0);
    expect(s.power.daylightHours).toBe(0);
    // A −130 °C night needs ~590 kWh of habitat power; a 200 kWh battery cannot cover it without fission.
    expect(s.power.nightKwh).toBeGreaterThan(500);
    expect(s.power.batteryKwh).toBe(0);
    expect(s.power.shortfallKwh).toBeGreaterThan(0);
    expect(s.offline.oxygen).toEqual({ reason: 'off', sols: 1 });
    expect(s.offline.recycler).toEqual({ reason: 'off', sols: 1 });
    expect(s.pendingCard?.id).toBe('lunar_night');
    expect(s.env.minC).toBeLessThan(-100);
    s = applyChoice(s, 0, data);
    expect(Object.values(s.offline).every((o) => o.reason === 'off' && o.sols === 1)).toBe(true);
    expect(s.supplies.o2Kg).toBeGreaterThan(0);
  });

  it('power shortfall takes modules offline by priority, life support last', () => {
    // Three fission units (720 kWh/day) cover the −130 °C night habitat (~590 kWh) plus life support (60 kWh)
    // but not the greenhouse and rover on top (84 kWh more).
    const night = { modules: { solar: 1, fission: 3, recycler: 1, oxygen: 1, greenhouse: 1, rover: 1, spares: 2 }, supplies: { o2: 6, water: 7, food: 5 } };
    expect(landerMass(night).overBy).toBe(0);
    let s = createMission(moon({ loadout: night, seed: 'ZZZ999' }), data);
    // Keep everything running, and decline the regolith berm (it would insulate the habitat enough to avoid any cut).
    const keepEverything = (card) => (card.id === 'lunar_night' || card.id === 'berm' ? 1 : keepRunning(card));
    for (let i = 0; i < 16; i += 1) s = step(s, keepEverything);
    expect(s.env.lit).toBe(false);
    expect(s.shielding.level).toBe(0);
    expect(s.power.batteryMaxKwh).toBe(0);
    expect(s.power.producedKwh).toBe(720);
    expect(s.power.usedKwh).toBeLessThanOrEqual(720);
    expect(s.offline.rover).toEqual({ reason: 'off', sols: 1 });
    expect(s.offline.greenhouse).toEqual({ reason: 'off', sols: 1 });
    expect(s.offline.oxygen).toBeUndefined();
    expect(s.offline.recycler).toBeUndefined();
    expect(s.power.shortfallKwh).toBe(0);
    expect(s.power.cut).toEqual(['rover', 'greenhouse']);
    expect(s.lastSol.log.some((l) => /Not enough power/.test(l.text))).toBe(true);
    // Highest priority number is always cut before a lower one.
    const cutPriorities = Object.keys(s.offline).filter((id) => s.offline[id].reason === 'off').map((id) => moduleById(id).priority);
    const onlinePriorities = Object.keys(s.modules).filter((id) => !s.offline[id] && moduleById(id).priority).map((id) => moduleById(id).priority);
    expect(Math.min(...cutPriorities)).toBeGreaterThanOrEqual(Math.max(...onlinePriorities));
  });

  it('with zero power the habitat goes cold and life support is also cut', () => {
    const dark = { modules: { solar: 1, recycler: 1, oxygen: 1 }, supplies: { o2: 6, water: 8, food: 6 } };
    let s = createMission(moon({ loadout: dark }), data);
    for (let i = 0; i < 16; i += 1) s = step(s);
    expect(s.power.producedKwh).toBe(0);
    expect(s.power.shortfallKwh).toBeGreaterThan(0);
    expect(s.offline.oxygen?.reason).toBe('off');
    expect(s.crew[0].health).toBeLessThan(100);
  });
});

describe('greenhouse', () => {
  it('yields food only after growSols sols online', () => {
    // A greenhouse draws 3 kW all night, so it needs a second fission unit to stay on through Martian nights.
    const loadout = { modules: { solar: 3, fission: 2, battery: 2, recycler: 1, oxygen: 2, greenhouse: 1, spares: 4 }, supplies: { o2: 6, water: 8, food: 6 } };
    expect(landerMass(loadout).overBy).toBe(0);
    const growSols = moduleById('greenhouse').growSols;
    let s = createMission(mars({ loadout, seed: 'QWERTY' }), data);
    const budgets = [];
    for (let i = 0; i < growSols + 2; i += 1) {
      s = step(s, keepRunning);
      budgets.push({ sol: s.sol, greenhouseSols: s.flags.greenhouseSols, foodIn: s.lastSol.budget.foodIn, harvested: s.flags.harvested });
    }
    expect(budgets.filter((b) => b.greenhouseSols < growSols).every((b) => b.foodIn === 0 && !b.harvested)).toBe(true);
    const first = budgets.find((b) => b.greenhouseSols >= growSols);
    expect(first).toBeTruthy();
    expect(first.foodIn).toBeCloseTo(1.4, 1);
    expect(first.harvested).toBe(true);
    expect(s.flags.drawn).toContain('harvest');
  });
});

describe('describeEffects', () => {
  it('writes one plain line per effect with signs and units', () => {
    const state = createMission(mars(), data);
    const lines = describeEffects({ morale: -2, battery: 40, water: -120, dose: 0.3, storm: { tau: 3, sols: 10 }, disable: 'greenhouse', shelter: true, spares: -1, dust: -0.2 }, state);
    expect(lines).toHaveLength(9);
    expect(lines[0]).toBe('Morale −2 for everyone');
    expect(lines[1]).toBe('Battery +40 kWh (holds 200 kWh)');
    expect(lines[2]).toBe('Water −120 kg');
    expect(lines[3]).toBe('Radiation +0.3 mSv for each astronaut');
    expect(lines[4]).toMatch(/tau 3 for 10 sols/);
    expect(lines[5]).toContain('Greenhouse');
    expect(lines[6]).toMatch(/protection/);
    expect(lines[7]).toBe('Spare parts −1 kit');
    expect(lines[8]).toBe('Panel dust −20%');
    expect(describeEffects({}, state)).toEqual([]);
  });
});

describe('effects and logs', () => {
  it('applies card effects and records the outcome', () => {
    let s = createMission(mars(), data);
    while (!s.pendingCard) s = advanceSol(s, data);
    const idx = firstChoice(s.pendingCard);
    const chosen = s.pendingCard.choices[idx];
    const after = applyChoice(s, idx, data);
    expect(after.pendingCard).toBeNull();
    expect(after.lastSol.log.some((l) => l.text === chosen.outcome)).toBe(true);
    if (typeof chosen.effects.science === 'number') expect(after.science).toBeCloseTo(s.science + chosen.effects.science, 5);
    if (typeof chosen.effects.morale === 'number') expect(after.crew[0].morale).toBe(Math.min(100, s.crew[0].morale + chosen.effects.morale));
    expect(after.flags.drawn).toEqual(s.flags.drawn);
  });

  it('logs a real Curiosity reference sol every 5 sols with source rems', () => {
    const hist = run(createMission(mars(), data), 10);
    const refLines = hist.filter((s) => s.sol % TUNING.remsReferenceEvery === 0 && s.sol > 0)
      .map((s) => s.lastSol.log.find((l) => /Curiosity's sol \d+ on \d{4}-\d{2}-\d{2}: .*°C to .*°C/.test(l.text)));
    expect(refLines).toHaveLength(2);
    expect(refLines.every((l) => l && l.source === 'rems')).toBe(true);
  });

  it('kid-friendly power line has numbers with units and a source', () => {
    const s = advanceSol(createMission(mars(), data), data);
    const line = s.lastSol.log.find((l) => /Solar panels made \d+ kWh/.test(l.text));
    expect(line).toBeTruthy();
    expect(line.text).toMatch(/The base used \d+ kWh, \d+ of it for heating\./);
    expect(line.source).toBeTruthy();
    expect(s.lastSol.log.find((l) => l.source === 'rad-2014')).toBeTruthy();
    expect(s.lastSol.log.find((l) => l.source === 'bvad')).toBeTruthy();
  });

  it('shows the day/night and dust bookkeeping in env', () => {
    const s = run(createMission(mars(), data), 5).pop();
    expect(s.env.dust).toBeCloseTo(5 * 0.002, 3);
    expect(s.env.tau).toBeGreaterThan(0);
    expect(s.env.lightDelayMin).toBeGreaterThan(3);
    expect(s.env.lightDelayMin).toBeLessThan(23);
  });
});
