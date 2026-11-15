// The engine plays any world from its profile (src/data/worlds.js): air, ground, radiation, day length.
// Tests use the three contract worlds plus small synthetic worlds, because the data layer fills WORLDS in parallel.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createMission, advance, beginSol, resolveEvent, runSol, validateLoadout, isOnEva, isRemoteOnly, loadoutMass, budgetFor } from '../src/engine/sim.js';
import { scoreMission, debrief } from '../src/engine/scoring.js';
import { advise } from '../src/engine/advisor.js';
import { buildWeatherIndex } from '../src/engine/environment.js';
import { classifySepEvents } from '../src/engine/spaceWeather.js';
import {
  worldProfile, lightMode, daylightHoursAt, thermalKw, worldSolarKwh, insideDose, evaDose, defaultSite, worldForConfig, RULES,
} from '../src/engine/worldModel.js';
import { worldChallenge, worldEffects } from '../src/engine/worldGuide.js';
import { recommendedLoadout } from '../src/engine/worldLoadout.js';
import { freePlayConfig, missionById } from '../src/data/missions.js';
import { modulesForWorld, modulesForBody } from '../src/data/modules.js';
import { choiceAvailable } from '../src/engine/events.js';
import { EVENT_CARDS, WORLD_EVENT_CARDS, eventById } from '../src/data/eventCards.js';
import { WORLDS, worldById, real, derived, generated } from '../src/data/worlds.js';
import { SOURCES } from '../src/data/sources.js';
import { termById } from '../src/data/glossary.js';

const rems = JSON.parse(fs.readFileSync(new URL('../public/data/rems.json', import.meta.url)));
const donki = JSON.parse(fs.readFileSync(new URL('../public/data/donki.json', import.meta.url)));
const ctx = { weatherIndex: buildWeatherIndex(rems), seps: classifySepEvents(donki) };
const SEEDS = ['ABC123', 'HELLO1', 'ZZZ999', 'NASA26', 'MARS42', 'QWERTY'];
const SHORT_MISSION = 10;
const PLENTY = { o2: 300, water: 800, food: 400 };

// ---------- Synthetic worlds (shape of src/data/worlds.js) ----------
const world = (id, name, extra, facts) => ({
  id, name, kind: 'moon', parent: null, system: 'sol', analog: 'moon', sky: null, star: null,
  palette: { ground: '#888888', rock: '#555555', ice: null, sky: '#000000', haze: null, liquid: null },
  sites: [], blurb: `${name}, a test world.`,
  ...extra,
  facts: {
    radiusEarth: real(0.25, 't'), massEarth: real(0.01, 't'), densityGcc: real(3, 't'), yearDays: real(4000, 't'), orbitAu: real(5.2, 't'),
    magneticField: real('none', 't'), liquidWater: real('none', 't'), air: real([], 't'),
    ...facts,
  },
});

const ICY_MOON = world('test-icy-moon', 'Frostball', { parent: 'jupiter', sites: [{ id: 'frost-base', name: 'Frost Base', lat: 10, lon: 20, iceAccess: 1, science: 1.2, blurb: 'Ice plains.', origin: 'real' }] }, {
  gravityG: real(0.134, 't'), dayHours: real(85.2, 't'), sunlightWm2: real(50.3, 't'),
  tempDayC: real(-160, 't'), tempNightC: real(-220, 't'), pressurePa: real(0, 't'),
  radiationMsvPerDay: real(5400, 't'), waterIce: real(1, 't'), liquidWater: real('subsurface', 't'),
  ground: real('ice-shell', 't'), hazards: real(['tidal-quakes', 'cryovolcanism'], 't'),
});

const HOT_EXOPLANET = world('test-hot-rock', 'Cinder b', {
  kind: 'exoplanet', parent: 'Cinder', system: 'Cinder',
  star: { name: 'Cinder', teffK: real(3100, 't'), radiusSol: real(0.2, 't'), massSol: real(0.18, 't'), luminositySol: derived(0.003, 't'), spectralType: real('M4 V', 't'), distanceLy: derived(12.5, 't') },
  sites: [
    { id: 'cinder-noon', name: 'Noon Plain', lat: 0, lon: 0, iceAccess: 0, science: 1, blurb: 'Right under the star.', origin: 'generated' },
    { id: 'cinder-dusk', name: 'Dusk Ridge', lat: 0, lon: 90, iceAccess: 0.4, science: 1.3, blurb: 'On the day/night line.', origin: 'generated' },
    { id: 'cinder-midnight', name: 'Midnight Basin', lat: 0, lon: 180, iceAccess: 0.8, science: 1, blurb: 'The far side.', origin: 'generated' },
    { id: 'cinder-flagged', name: 'Flagged Site', lat: 0, lon: 0, light: 'night', iceAccess: 0.5, science: 1, blurb: 'A site that says it is dark.', origin: 'generated' },
  ],
}, {
  gravityG: derived(1.4, 't'), dayHours: derived(96, 'tidal-lock'), sunlightWm2: derived(4200, 't'),
  tempDayC: generated(250), tempNightC: generated(-120), pressurePa: generated(0),
  radiationMsvPerDay: generated(8), waterIce: generated(0.1), magneticField: generated('weak'),
  ground: generated('basalt'), hazards: generated(['flares', 'extreme-heat', 'tidal-lock']),
});

const THICK_AIR_MOON = world('test-thick-air', 'Hazeworld', { parent: 'saturn', analog: 'mars' }, {
  gravityG: real(0.138, 't'), dayHours: real(382.7, 't'), sunlightWm2: real(15, 't'),
  tempDayC: real(-179, 't'), tempNightC: real(-180, 't'), pressurePa: real(146700, 't'),
  air: real([{ gas: 'N2', pct: 95 }, { gas: 'CH4', pct: 5 }], 't'),
  radiationMsvPerDay: real(0.05, 't'), waterIce: real(0.7, 't'),
  ground: real('organic-dunes', 't'), hazards: real(['methane-rain'], 't'),
});

const OVEN_PLANET = world('test-oven', 'Ovenworld', { kind: 'planet', analog: 'mars' }, {
  gravityG: real(0.9, 't'), dayHours: real(2802, 't'), sunlightWm2: real(2601, 't'),
  tempDayC: real(464, 't'), tempNightC: real(464, 't'), pressurePa: real(9.2e6, 't'),
  air: real([{ gas: 'CO2', pct: 96.5 }, { gas: 'N2', pct: 3.5 }], 't'),
  radiationMsvPerDay: real(0.01, 't'), waterIce: real(0, 't'),
  ground: real('basalt', 't'), hazards: real(['extreme-heat', 'acid-clouds', 'volcanism'], 't'),
});

const VOLCANO_MOON = world('test-volcano', 'Brimstone', { parent: 'jupiter' }, {
  gravityG: real(0.183, 't'), dayHours: real(42.5, 't'), sunlightWm2: real(50.3, 't'),
  tempDayC: real(-130, 't'), tempNightC: real(-160, 't'), pressurePa: real(0, 't'),
  radiationMsvPerDay: real(36000, 't'), waterIce: real(0, 't'),
  ground: real('sulfur', 't'), hazards: real(['volcanism', 'tidal-quakes'], 't'),
});

const SYNTHETIC = [ICY_MOON, HOT_EXOPLANET, THICK_AIR_MOON, OVEN_PLANET, VOLCANO_MOON];
const proxima = worldById('proxima-cen-b');

const configFor = (w, { siteId, targetSols = SHORT_MISSION } = {}) => freePlayConfig({ world: w, siteId, targetSols, difficulty: 'cadet', startDate: '2024-05-08' });

function play(w, { siteId, targetSols, code = 'ABC123', difficulty = 'cadet', loadout, chooser = () => 0, tasks } = {}) {
  const config = configFor(w, { siteId, targetSols });
  let m = createMission({ config, loadout: loadout ?? config.recommended, difficulty, code, world: w }, ctx);
  if (tasks) m = { ...m, crew: m.crew.map((c) => ({ ...c, task: tasks })) };
  while (m.status === 'active' && m.sol < 400) m = advance(m, ctx, chooser);
  return m;
}
// Finishes a turn that beginSol has already started (picks the first choice the crew can take).
function finishSol(m) {
  if (m.phase !== 'event') return runSol(m);
  const card = eventById(m.pendingEvent.id);
  return runSol(resolveEvent(m, card.choices.findIndex((c) => choiceAvailable(m, c))));
}
const minHealth = (m) => Math.min(100, ...m.history.map((h) => h.health));
const avgSurfaceDose = (m) => m.crew.reduce((s, c) => s + c.doseMsv - c.transitDoseMsv, 0) / m.crew.length;

describe('The Moon and Mars are untouched', () => {
  it('Moon and Mars missions carry no world profile and run the original paths', () => {
    for (const id of ['artemis-dawn', 'red-dust']) {
      const config = missionById(id);
      const m = createMission({ config, loadout: config.recommended, code: 'ABC123' }, ctx);
      expect(m.profile).toBeUndefined();
      expect(isRemoteOnly(m)).toBe(false);
    }
    expect(worldForConfig({ worldId: 'moon' })).toBeNull();
    expect(worldForConfig({ worldId: 'mars' })).toBeNull();
    expect(worldForConfig({ body: 'mars' })).toBeNull();
  });

  it('a config with worldId moon or mars plays exactly like one without', () => {
    const base = missionById('red-dust');
    const run = (config) => {
      let m = createMission({ config, loadout: base.recommended, code: 'NASA26', difficulty: 'specialist' }, ctx);
      while (m.status === 'active') m = advance(m, ctx);
      return JSON.stringify(m.history);
    };
    expect(run({ ...base, worldId: 'mars' })).toBe(run(base));
  });

  it('free play for the Moon and Mars keeps its original config, with or without a worldId', () => {
    const args = { body: 'mars', siteId: 'jezero', targetSols: 30, difficulty: 'cadet', startDate: '2024-05-08', includeTransitDose: false };
    expect(freePlayConfig({ ...args, worldId: 'mars' })).toEqual(freePlayConfig(args));
    expect(freePlayConfig(args).budgetKg).toBe(5750);
    expect(freePlayConfig(args).recommended).toBeNull();
  });

  it('the Moon/Mars random deck is the same set of cards as before', () => {
    expect(EVENT_CARDS.some((c) => WORLD_EVENT_CARDS.includes(c))).toBe(false);
    expect(EVENT_CARDS.filter((c) => c.bodies.includes('moon') || c.bodies.includes('mars'))).toHaveLength(EVENT_CARDS.length);
  });
});

describe('Day length (dayHours)', () => {
  it('a world with a roughly Earth-length day plays one local day per turn, half of it lit', () => {
    const w = world('t-daily', 'Daily', {}, { ...ICY_MOON.facts, dayHours: real(30, 't') });
    const p = worldProfile(w);
    expect(p.turnHours).toBe(30);
    expect(daylightHoursAt(p, 1)).toBeCloseTo(15, 5);
    expect(daylightHoursAt(p, 7)).toBeCloseTo(15, 5);
  });

  it('a slow spinner is played in Earth days: sunlit turns, then dark turns', () => {
    const p = worldProfile(THICK_AIR_MOON); // 382.7 h day: about 8 Earth days of light, then 8 of dark
    expect(p.turnHours).toBe(24);
    expect(daylightHoursAt(p, 1)).toBe(24);
    expect(daylightHoursAt(p, 7)).toBe(24);
    expect(daylightHoursAt(p, 8)).toBeCloseTo(191.35 - 168, 2);
    expect(daylightHoursAt(p, 10)).toBe(0);
    expect(daylightHoursAt(p, 17)).toBeGreaterThan(0);
  });

  it('daylight over one full day-night cycle adds up to half the cycle', () => {
    const p = worldProfile(ICY_MOON); // 85.2 h
    const total = Array.from({ length: 71 }, (_, i) => daylightHoursAt(p, i + 1)).reduce((s, h) => s + h, 0);
    expect(total).toBeCloseTo((71 * 24) / 2, 0);
  });

  it('mission dates advance by the turn length', () => {
    const w = world('t-daily2', 'Daily', {}, { ...ICY_MOON.facts, dayHours: real(30, 't') });
    const config = configFor(w);
    const m0 = createMission({ config, loadout: config.recommended, world: w }, ctx);
    const m1 = beginSol(m0, ctx);
    expect(m1.env.dateMs - m0.env.dateMs).toBe(30 * 3600 * 1000);
  });
});

describe('Tidally locked worlds: the landing site decides the light', () => {
  const site = (id) => HOT_EXOPLANET.sites.find((s) => s.id === id);

  it('under the star is permanent day, the far side permanent night, the edge permanent twilight', () => {
    expect(lightMode(HOT_EXOPLANET, site('cinder-noon'))).toBe('day');
    expect(lightMode(HOT_EXOPLANET, site('cinder-dusk'))).toBe('twilight');
    expect(lightMode(HOT_EXOPLANET, site('cinder-midnight'))).toBe('night');
    expect(lightMode(HOT_EXOPLANET, { lat: 0, lon: 75 })).toBe('day');
    expect(lightMode(HOT_EXOPLANET, { lat: 85, lon: 0 })).toBe('twilight');
    expect(lightMode(HOT_EXOPLANET, { lat: 0, lon: -120 })).toBe('night');
  });

  it('a site flag wins over latitude and longitude', () => {
    expect(lightMode(HOT_EXOPLANET, site('cinder-flagged'))).toBe('night');
  });

  it('worlds that are not locked to their star have an ordinary day and night', () => {
    expect(lightMode(ICY_MOON, { lat: 0, lon: 180 })).toBe('cycle');
    expect(lightMode(proxima, defaultSite(proxima))).toBe('day');
  });

  it('light and temperature never change through a mission on a locked world', () => {
    const day = worldProfile(HOT_EXOPLANET, site('cinder-noon'));
    const dusk = worldProfile(HOT_EXOPLANET, site('cinder-dusk'));
    const night = worldProfile(HOT_EXOPLANET, site('cinder-midnight'));
    for (const sol of [1, 5, 40]) {
      expect(daylightHoursAt(day, sol)).toBe(24);
      expect(daylightHoursAt(dusk, sol)).toBe(24);
      expect(daylightHoursAt(night, sol)).toBe(0);
    }
    expect([day.tempLitC, dusk.tempLitC, night.tempDarkC]).toEqual([250, 65, -120]);
    const area = { areaM2: 100, daylightHours: 24 };
    expect(worldSolarKwh(day, area)).toBeGreaterThan(3 * worldSolarKwh(dusk, area));
    expect(worldSolarKwh(dusk, area)).toBeGreaterThan(0);
    expect(worldSolarKwh(night, { areaM2: 100, daylightHours: 0 })).toBe(0);
  });
});

describe('Sunlight and air (sunlightWm2, pressurePa)', () => {
  it('solar power scales with the starlight a world gets', () => {
    const near = worldProfile(world('t-near', 'Near', {}, { ...ICY_MOON.facts, sunlightWm2: real(1000, 't') }));
    const far = worldProfile(ICY_MOON);
    const args = { areaM2: 100, daylightHours: 24 };
    expect(worldSolarKwh(near, args) / worldSolarKwh(far, args)).toBeCloseTo(1000 / 50.3, 3);
  });

  it('thick air dims the light at the ground; no air passes all of it', () => {
    expect(worldProfile(ICY_MOON).transmission).toBe(1);
    expect(worldProfile(THICK_AIR_MOON).transmission).toBeLessThan(0.5);
    expect(worldProfile(OVEN_PLANET).transmission).toBeLessThan(0.1);
  });

  it('no breathable air anywhere: the crew uses stored oxygen every turn on every world', () => {
    for (const w of [...SYNTHETIC, proxima]) {
      const config = configFor(w);
      const m0 = createMission({ config, loadout: config.recommended, world: w }, ctx);
      const m1 = advance(m0, ctx);
      expect(m1.lastReport.life.o2Need, w.id).toBeGreaterThan(3.2);
    }
  });

  it('thick air allows a lighter suit (less oxygen per walk); strong gravity costs more', () => {
    const titanLike = worldProfile(THICK_AIR_MOON);
    const airless = worldProfile(world('t-airless', 'Airless', {}, { ...THICK_AIR_MOON.facts, pressurePa: real(0, 't'), air: real([], 't') }));
    expect(titanLike.lightSuit).toBe(true);
    expect(titanLike.evaO2Multiplier).toBeLessThan(airless.evaO2Multiplier);
    expect(worldProfile(HOT_EXOPLANET).evaO2Multiplier).toBeGreaterThan(airless.evaO2Multiplier);
    expect(worldProfile(OVEN_PLANET).lightSuit).toBe(false);
  });

  it('airless worlds get micrometeoroid strikes; worlds with air do not', () => {
    expect(worldProfile(ICY_MOON).hazards).toContain('micrometeoroids');
    expect(worldProfile(THICK_AIR_MOON).hazards).not.toContain('micrometeoroids');
  });
});

describe('Temperature (tempDayC, tempNightC)', () => {
  it('cold worlds need heat, hot worlds need cooling, mild ones need neither', () => {
    const icy = worldProfile(ICY_MOON);
    expect(thermalKw(icy, -220)).toBeGreaterThan(15);
    expect(thermalKw(icy, 25)).toBe(0);
    expect(thermalKw(worldProfile(OVEN_PLANET), 464)).toBeGreaterThan(15);
  });

  it('matches the lunar-night heat leak the Moon chapters use at −130 °C in a vacuum', () => {
    expect(thermalKw(worldProfile(ICY_MOON), -130)).toBeCloseTo(0.11 * 151, 5);
  });

  it('in a vacuum, −220 °C costs only a little more than −130 °C; thick cold air costs extra', () => {
    const icy = worldProfile(ICY_MOON);
    expect(thermalKw(icy, -220) / thermalKw(icy, -130)).toBeLessThan(1.1);
    expect(thermalKw(worldProfile(THICK_AIR_MOON), -180)).toBeGreaterThan(thermalKw(icy, -180) + 1);
  });

  it('the power report says whether the bill is for heaters or chillers', () => {
    const hot = advance(createMission({ config: configFor(OVEN_PLANET), loadout: configFor(OVEN_PLANET).recommended, world: OVEN_PLANET }, ctx), ctx);
    const cold = advance(createMission({ config: configFor(ICY_MOON), loadout: configFor(ICY_MOON).recommended, world: ICY_MOON }, ctx), ctx);
    expect(hot.lastReport.power.hot).toBe(true);
    expect(cold.lastReport.power.hot).toBe(false);
    expect(hot.lastReport.power.heatKwh).toBeGreaterThan(300);
  });

  it('running out of power on a hot world ends the mission by heat, not cold', () => {
    const config = configFor(OVEN_PLANET);
    const m = play(OVEN_PLANET, { targetSols: 30, loadout: { modules: { fission: 1 }, supplies: PLENTY } });
    expect(m.status).toBe('lost');
    expect(m.lostReason).toBe('heat');
    expect(debrief(m).improve[0]).toMatch(/chillers/);
  });
});

describe('Radiation (radiationMsvPerDay, magneticField, flares)', () => {
  it('daily dose follows the world’s surface radiation', () => {
    const quiet = play(THICK_AIR_MOON);
    const harsh = play(world('t-ganymede', 'Beltmoon', { parent: 'jupiter' }, { ...ICY_MOON.facts, radiationMsvPerDay: real(80, 't') }));
    expect(avgSurfaceDose(quiet)).toBeLessThan(1);
    expect(avgSurfaceDose(harsh)).toBeGreaterThan(20 * avgSurfaceDose(quiet));
  });

  it('a walk outside costs more dose than staying in, and shielding cuts the indoor dose', () => {
    const p = worldProfile(world('t-ganymede', 'Beltmoon', { parent: 'jupiter' }, { ...ICY_MOON.facts, radiationMsvPerDay: real(80, 't') }));
    expect(evaDose(p, 0)).toBeGreaterThan(5 * insideDose(p, 0));
    expect(insideDose(p, 3)).toBeLessThan(insideDose(p, 0));
  });

  it('where a walk outside would be deadly the crew drives robots: nobody is on EVA, science is halved', () => {
    const config = configFor(ICY_MOON);
    const m = beginSol(createMission({ config, loadout: config.recommended, world: ICY_MOON }, ctx), ctx);
    expect(isRemoteOnly(m)).toBe(true);
    expect(m.crew.some((c) => isOnEva(m, c))).toBe(false);
    const done = play(ICY_MOON);
    expect(done.stats.evaCrewSols).toBe(0);
    expect(done.science).toBeGreaterThan(0);
    expect(advise(m).some((t) => /robots/.test(t.text))).toBe(true);
  });

  it('real NASA solar storms reach sunward worlds, but not worlds far from the Sun or under thick air', () => {
    const mercuryLike = worldProfile(world('t-mercury', 'Sunward', { kind: 'planet' }, { ...ICY_MOON.facts, sunlightWm2: real(9000, 't'), radiationMsvPerDay: real(2, 't') }));
    expect(mercuryLike.solarStorms).toBe(true);
    expect(mercuryLike.flareDoseFactor).toBe(RULES.flareMaxDistanceBoost);
    expect(worldProfile(ICY_MOON).solarStorms).toBe(false);
    expect(worldProfile(OVEN_PLANET).solarStorms).toBe(false);
    expect(worldProfile(THICK_AIR_MOON).flareDoseFactor).toBeLessThan(0.01);
  });

  it('a magnetic field weakens storm dose', () => {
    const bare = worldProfile(world('t-bare', 'Bare', { kind: 'planet' }, { ...ICY_MOON.facts, sunlightWm2: real(1361, 't') }));
    const field = worldProfile(world('t-field', 'Field', { kind: 'planet' }, { ...ICY_MOON.facts, sunlightWm2: real(1361, 't'), magneticField: real('strong', 't') }));
    expect(field.flareDoseFactor).toBeLessThan(0.5 * bare.flareDoseFactor);
  });

  it('flare-star worlds get stellar flares far more often than real solar storms, never from the Sun’s record', () => {
    const runs = SEEDS.map((code) => play(proxima, { code, targetSols: 30 }));
    const flares = runs.reduce((s, m) => s + m.stats.sepEvents, 0);
    expect(flares / runs.length).toBeGreaterThan(1.5);
    expect(runs.some((m) => m.log.some((l) => /Flare from Proxima Centauri/.test(l.text)))).toBe(true);
    expect(runs.every((m) => !m.log.some((l) => /Solar Radiation Storm Alert/.test(l.text)))).toBe(true);
    const quietStar = world('t-quiet', 'Quiet b', { kind: 'exoplanet', system: 'Quiet', star: HOT_EXOPLANET.star }, { ...ICY_MOON.facts, radiationMsvPerDay: real(1, 't'), hazards: generated([]) });
    expect(worldProfile(quietStar).flareChance).toBe(0);
    expect(worldProfile(quietStar).solarStorms).toBe(false);
  });

  it('sheltering from a stellar flare costs less dose than working through it', () => {
    const safe = SEEDS.map((code) => avgSurfaceDose(play(proxima, { code, targetSols: 30, chooser: () => 0 })));
    const bold = SEEDS.map((code) => avgSurfaceDose(play(proxima, { code, targetSols: 30, chooser: (_m, card) => card.choices.length - 1 })));
    const total = (list) => list.reduce((s, v) => s + v, 0);
    expect(total(bold)).toBeGreaterThan(1.2 * total(safe));
  });

  it('scoring measures dose saved against that world’s own open-ground dose', () => {
    const m = play(ICY_MOON);
    const score = scoreMission(m);
    expect(Number.isFinite(score.points)).toBe(true);
    expect(score.breakdown.radiation).toBeGreaterThan(100);
  });
});

describe('Water and ground (waterIce, liquidWater, ground, site iceAccess)', () => {
  const mined = (w, siteId) => {
    const config = configFor(w, { siteId });
    const loadout = { modules: { ...config.recommended.modules, iceDrill: 1, fission: 3 }, supplies: config.recommended.supplies };
    return advance(createMission({ config, loadout, world: w }, ctx), ctx).lastReport.life.mined;
  };

  it('ice mining follows the site’s ice and the world’s ice together', () => {
    expect(mined(ICY_MOON, 'frost-base')).toBeCloseTo(15, 5); // 10 kg × iceAccess 1 × (0.5 + waterIce 1)
    expect(mined(HOT_EXOPLANET, 'cinder-noon')).toBe(0);
    expect(mined(HOT_EXOPLANET, 'cinder-midnight')).toBeCloseTo(10 * 0.8 * 0.6, 5);
  });

  it('liquid water on the surface fills the tanks without ice; methane lakes do not count as water', () => {
    const wet = world('t-wet', 'Wetworld', {}, { ...ICY_MOON.facts, waterIce: real(0, 't'), liquidWater: generated('surface'), radiationMsvPerDay: real(1, 't') });
    expect(worldProfile(wet).iceAccess).toBe(RULES.surfaceWaterAccess);
    const methaneOnly = world('t-methane', 'Methane', {}, { ...THICK_AIR_MOON.facts, waterIce: real(0, 't') });
    expect(worldProfile(methaneOnly).iceAccess).toBe(0);
  });

  it('machines follow the air and the ground', () => {
    const ids = (w, site) => modulesForWorld(w, site).map((mod) => mod.id);
    expect(ids(OVEN_PLANET)).toContain('moxie'); // carbon dioxide air
    expect(ids(THICK_AIR_MOON)).not.toContain('moxie'); // nitrogen and methane: nothing for MOXIE to split
    expect(ids(ICY_MOON)).not.toContain('regolithO2'); // ice, not oxide rock
    expect(ids(HOT_EXOPLANET)).toContain('regolithO2'); // basalt
    expect(ids(HOT_EXOPLANET, HOT_EXOPLANET.sites[2])).not.toContain('solar'); // permanent night
    expect(ids(HOT_EXOPLANET, HOT_EXOPLANET.sites[0])).toContain('solar');
    expect(ids(worldById('moon'))).toEqual(modulesForBody('moon').map((mod) => mod.id));
    expect(ids(worldById('mars'))).toEqual(modulesForBody('mars').map((mod) => mod.id));
  });

  it('the loadout check rejects machines that cannot work on that world', () => {
    const config = configFor(THICK_AIR_MOON);
    const bad = { modules: { ...config.recommended.modules, moxie: 1 }, supplies: config.recommended.supplies };
    const result = validateLoadout(config, bad, 'cadet', THICK_AIR_MOON);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/MOXIE.*does not work on Hazeworld/);
  });

  it('gravity and ground change how fast shielding is piled up', () => {
    expect(worldProfile(THICK_AIR_MOON).buildSpeed).toBeGreaterThan(worldProfile(HOT_EXOPLANET).buildSpeed);
    expect(worldProfile(ICY_MOON).buildSpeed).toBeLessThan(worldProfile(THICK_AIR_MOON).buildSpeed);
    const light = play(THICK_AIR_MOON, { tasks: 'shield' });
    const heavy = play(HOT_EXOPLANET, { siteId: 'cinder-dusk', tasks: 'shield' });
    expect(light.shield.level).toBeGreaterThan(heavy.shield.level);
  });
});

describe('Hazards add events', () => {
  const cardsSeen = (w, opts = {}) => {
    const seen = new Set();
    for (const code of [...SEEDS, 'EV1', 'EV2', 'EV3', 'EV4', 'EV5', 'EV6']) {
      let m = createMission({ config: configFor(w, { targetSols: 60, ...opts }), loadout: configFor(w, { targetSols: 60, ...opts }).recommended, world: w, code }, ctx);
      while (m.status === 'active' && m.sol < 60) {
        m = beginSol(m, ctx);
        if (m.pendingEvent) seen.add(m.pendingEvent.id);
        m = finishSol(m);
      }
    }
    return seen;
  };

  it('each world draws the cards for its own hazards and never another world’s', () => {
    const icy = cardsSeen(ICY_MOON);
    expect(icy.has('tidal_quake')).toBe(true);
    expect(icy.has('ice_plume')).toBe(true);
    expect(icy.has('belt_surge')).toBe(true);
    const hazy = cardsSeen(THICK_AIR_MOON);
    expect(hazy.has('methane_rain')).toBe(true);
    const oven = cardsSeen(OVEN_PLANET);
    expect(oven.has('heat_wave') || oven.has('acid_haze') || oven.has('volcano_plume')).toBe(true);
    for (const id of ['methane_rain', 'heat_wave', 'acid_haze', 'volcano_plume', 'micrometeoroid']) expect(hazy.has(id) && id !== 'methane_rain', id).toBe(false);
    for (const seen of [icy, hazy, oven]) {
      for (const id of ['dust_storm', 'global_storm', 'lunar_night', 'blue_sunset', 'earthrise', 'phobos', 'aurora', 'conjunction', 'perchlorate', 'moonquake', 'frost', 'meteorite', 'homesick']) {
        expect(seen.has(id), id).toBe(false);
      }
    }
  });

  it('a long night gets a nightfall card with the real length of the night', () => {
    const config = configFor(THICK_AIR_MOON, { targetSols: 20 });
    let m = createMission({ config, loadout: config.recommended, world: THICK_AIR_MOON }, ctx);
    let card = null;
    while (m.status === 'active' && !card) {
      m = beginSol(m, ctx);
      if (m.pendingEvent?.id === 'long_night') card = m.pendingEvent;
      m = finishSol(m);
    }
    expect(card).not.toBeNull();
    expect(card.vars.nightDays).toBe(8);
    expect(card.vars.bodyName).toBe('Hazeworld');
  });

  it('dust-storm worlds get storms that dim solar power', () => {
    const dusty = world('t-dusty', 'Dustball', { kind: 'planet', analog: 'mars' }, {
      ...ICY_MOON.facts, dayHours: real(25, 't'), sunlightWm2: real(700, 't'), tempDayC: real(0, 't'), tempNightC: real(-60, 't'),
      pressurePa: real(800, 't'), air: real([{ gas: 'CO2', pct: 95 }], 't'), radiationMsvPerDay: real(0.7, 't'), waterIce: real(0.5, 't'),
      ground: real('iron-oxide', 't'), hazards: real(['dust-storms'], 't'),
    });
    const p = worldProfile(dusty);
    expect(p.stormChance).toBeGreaterThan(0);
    expect(worldSolarKwh(p, { areaM2: 100, daylightHours: 12, tau: 3 })).toBeLessThan(0.4 * worldSolarKwh(p, { areaM2: 100, daylightHours: 12, tau: 0 }));
    const storms = SEEDS.reduce((s, code) => s + play(dusty, { code, targetSols: 60 }).stats.storms, 0);
    expect(storms).toBeGreaterThan(0);
  });

  it('new cards are kid-readable, honest about what is real, and cite real glossary terms and sources', () => {
    const linksIn = (text) => [...text.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)].map((x) => x[1]);
    for (const card of WORLD_EVENT_CARDS) {
      expect(eventById(card.id), card.id).toBe(card);
      expect(SOURCES[card.source], card.id).toBeDefined();
      for (const id of [...linksIn(card.body), ...linksIn(card.science), ...card.terms]) expect(termById(id), `${card.id} -> ${id}`).not.toBeNull();
      expect(card.science, card.id).toMatch(/^Real: /);
      expect(card.choices.length, card.id).toBeGreaterThan(0);
      expect(card.hazard != null || card.worlds === true, card.id).toBe(true);
    }
    expect(eventById('methane_rain').science).toMatch(/not water/);
    expect(new Set(WORLD_EVENT_CARDS.map((c) => c.id)).size).toBe(WORLD_EVENT_CARDS.length);
  });

  it('hazard spellings from the data layer are folded onto the card ids', () => {
    const w = world('t-alias', 'Alias', {}, { ...ICY_MOON.facts, hazards: real(['Cryovolcanism plumes', 'tidal quakes', 'volcanic'], 't') });
    expect(worldProfile(w).hazards).toEqual(expect.arrayContaining(['cryovolcanism', 'tidal-quakes', 'volcanism']));
  });
});

describe('worldChallenge and worldEffects (for the planet card)', () => {
  it('rates the contract worlds and the synthetic worlds', () => {
    expect(worldChallenge(worldById('moon')).level).toBe('medium');
    expect(worldChallenge(worldById('mars')).level).toBe('medium');
    expect(['medium', 'hard']).toContain(worldChallenge(proxima).level);
    expect(worldChallenge(THICK_AIR_MOON).level).toBe('hard');
    expect(worldChallenge(ICY_MOON).level).toBe('extreme');
    expect(worldChallenge(OVEN_PLANET).level).toBe('extreme');
    expect(worldChallenge(VOLCANO_MOON).level).toBe('extreme');
  });

  it('a gentle world is easy', () => {
    const gentle = world('t-gentle', 'Gentle b', { kind: 'exoplanet', system: 'Calm', star: HOT_EXOPLANET.star }, {
      ...ICY_MOON.facts, gravityG: derived(0.9, 't'), dayHours: generated(26), sunlightWm2: derived(1100, 't'), tempDayC: generated(22), tempNightC: generated(5),
      pressurePa: generated(60000), air: generated([{ gas: 'N2', pct: 90 }, { gas: 'CO2', pct: 10 }]), radiationMsvPerDay: generated(0.3),
      waterIce: generated(0.6), ground: generated('basalt'), hazards: generated([]),
    });
    expect(worldChallenge(gentle)).toMatchObject({ level: 'easy', maxSols: null });
    expect(worldChallenge(gentle).reasons).toHaveLength(1);
  });

  it('gives short plain reasons, and a stay limit only where radiation forces one', () => {
    for (const w of [...SYNTHETIC, ...WORLDS]) {
      const c = worldChallenge(w);
      expect(c.reasons.length, w.id).toBeGreaterThan(0);
      expect(c.reasons.length, w.id).toBeLessThanOrEqual(4);
      for (const r of c.reasons) expect(r.split(/\s+/).length, r).toBeLessThanOrEqual(16);
    }
    expect(worldChallenge(VOLCANO_MOON).maxSols).toBeLessThan(SHORT_MISSION);
    expect(worldChallenge(VOLCANO_MOON).reasons[0]).toMatch(/can only stay \d+ days/);
    expect(worldChallenge(ICY_MOON).maxSols).toBe(20);
    expect(worldChallenge(THICK_AIR_MOON).maxSols).toBeNull();
    expect(worldChallenge(OVEN_PLANET).reasons.join(' ')).toMatch(/crush/);
  });

  it('says what each world does to the crew', () => {
    const text = (w) => worldEffects(w).join(' | ');
    expect(text(worldById('moon'))).toMatch(/No air: every walk outside needs a full spacesuit/);
    expect(text(ICY_MOON)).toMatch(/radiation from Jupiter’s radiation belts/);
    expect(text(ICY_MOON)).toMatch(/Lots of ice/);
    expect(text(THICK_AIR_MOON)).toMatch(/lighter suit/);
    expect(text(THICK_AIR_MOON)).toMatch(/Nobody can breathe this air/);
    expect(text(THICK_AIR_MOON)).toMatch(/methane.*not water/);
    expect(text(OVEN_PLANET)).toMatch(/Crushing air/);
    expect(text(OVEN_PLANET)).toMatch(/Scorching heat/);
    expect(text(HOT_EXOPLANET)).toMatch(/where you land decides/);
    expect(text(proxima)).toMatch(/Proxima Centauri flares often/);
    for (const w of [...SYNTHETIC, ...WORLDS]) {
      const lines = worldEffects(w);
      expect(lines.length, w.id).toBeGreaterThanOrEqual(4);
      for (const line of lines) expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(22);
    }
  });

  it('both are pure: same world in, same answer out, world untouched', () => {
    const before = JSON.stringify(ICY_MOON);
    expect(worldChallenge(ICY_MOON)).toEqual(worldChallenge(ICY_MOON));
    expect(worldEffects(ICY_MOON)).toEqual(worldEffects(ICY_MOON));
    expect(JSON.stringify(ICY_MOON)).toBe(before);
  });
});

describe('Recommended packs and balance (Cadet, short mission)', () => {
  const sitesOf = (w) => (w.sites.length ? w.sites : [defaultSite(w)]);

  it('the recommended pack fits the Cadet and Specialist budgets and uses only machines that work there', () => {
    for (const w of [...SYNTHETIC, proxima]) {
      for (const site of sitesOf(w)) {
        const config = configFor(w, { siteId: site.id });
        for (const difficulty of ['cadet', 'specialist']) {
          const check = validateLoadout(config, config.recommended, difficulty, w);
          expect(check.errors, `${w.id} ${site.id} ${difficulty}`).toEqual([]);
        }
        expect(loadoutMass(config.recommended)).toBeLessThanOrEqual(budgetFor(config, 'specialist'));
      }
    }
  });

  it('never packs solar arrays for a permanent-night site or a dim world', () => {
    expect(recommendedLoadout(HOT_EXOPLANET, HOT_EXOPLANET.sites[2]).modules.solar).toBeUndefined();
    expect(recommendedLoadout(HOT_EXOPLANET, HOT_EXOPLANET.sites[2]).modules.fission).toBeGreaterThan(0);
    expect(recommendedLoadout(ICY_MOON).modules.solar).toBeUndefined();
    expect(recommendedLoadout(HOT_EXOPLANET, HOT_EXOPLANET.sites[0]).modules.solar).toBeGreaterThan(0);
    expect(recommendedLoadout(proxima).modules.shelter).toBe(1);
  });

  it('every world is survivable on every seed with the recommended pack', () => {
    for (const w of [...SYNTHETIC, proxima]) {
      for (const site of sitesOf(w)) {
        for (const code of SEEDS) {
          const m = play(w, { siteId: site.id, code });
          expect(m.status, `${w.id} ${site.id} ${code} lost: ${m.lostReason}`).toBe('won');
          expect(minHealth(m), `${w.id} ${site.id} ${code}`).toBeGreaterThanOrEqual(50);
          for (const [k, v] of Object.entries(m.resources)) expect(Number.isFinite(v) && v >= 0, `${w.id} ${k}`).toBe(true);
        }
      }
    }
  });

  it('every world and every landing site in WORLDS is survivable for a short mission on every seed', () => {
    const others = WORLDS.filter((x) => !['moon', 'mars'].includes(x.id));
    expect(others.length).toBeGreaterThan(0);
    for (const w of others) {
      for (const site of sitesOf(w)) {
        const config = configFor(w, { siteId: site.id });
        expect(validateLoadout(config, config.recommended, 'specialist', w).errors, `${w.id} ${site.id}`).toEqual([]);
        expect(config.targetSols, w.id).toBe(Math.min(SHORT_MISSION, worldChallenge(w).maxSols ?? SHORT_MISSION));
        for (const code of SEEDS) {
          const m = play(w, { siteId: site.id, code });
          expect(m.status, `${w.id} ${site.id} ${code} lost: ${m.lostReason}`).toBe('won');
          expect(minHealth(m), `${w.id} ${site.id} ${code}`).toBeGreaterThanOrEqual(70);
          expect(avgSurfaceDose(m), `${w.id} ${site.id} ${code}`).toBeLessThanOrEqual(600);
        }
      }
    }
  });

  it('long missions (60 turns, or the stay limit) are winnable on every world too', () => {
    for (const w of WORLDS.filter((x) => !['moon', 'mars'].includes(x.id))) {
      for (const site of sitesOf(w)) {
        for (const code of SEEDS.slice(0, 2)) {
          const m = play(w, { siteId: site.id, code, targetSols: 60 });
          expect(m.status, `${w.id} ${site.id} ${code} lost: ${m.lostReason}`).toBe('won');
        }
      }
    }
  });

  it('an extreme world caps the mission length instead of letting the crew die', () => {
    const config = configFor(VOLCANO_MOON, { targetSols: 30 });
    expect(config.targetSols).toBe(worldChallenge(VOLCANO_MOON).maxSols);
    const m = play(VOLCANO_MOON, { targetSols: 30 });
    expect(m.status).toBe('won');
    expect(avgSurfaceDose(m)).toBeLessThanOrEqual(600);
    expect(debrief(m).radiation).not.toMatch(/over the 600 mSv/);
  });

  it('worlds feel different: power source, heat bill and dose all vary', () => {
    const report = (w, siteId) => {
      const m = play(w, { siteId });
      return { fission: m.modules.fission ?? 0, solar: m.modules.solar ?? 0, heat: m.history.length ? m.lastReport.power.heatKwh : 0, dose: avgSurfaceDose(m) };
    };
    const icy = report(ICY_MOON);
    const hazy = report(THICK_AIR_MOON);
    const prox = report(proxima);
    expect(icy.fission).toBeGreaterThanOrEqual(2);
    expect(prox.solar).toBeGreaterThan(0);
    expect(prox.fission).toBe(0);
    expect(hazy.heat).toBeGreaterThan(icy.heat);
    expect(icy.dose).toBeGreaterThan(20 * hazy.dose);
  });

  it('a long mission on a world packs machines and still wins', () => {
    const wet = world('t-icy-mild', 'Snowball', {}, { ...ICY_MOON.facts, radiationMsvPerDay: real(1, 't'), sunlightWm2: real(900, 't'), dayHours: real(26, 't'), tempDayC: real(-20, 't'), tempNightC: real(-90, 't') });
    expect(configFor(wet, { targetSols: 60 }).recommended.modules).toMatchObject({ recycler: 1, oxygen: 1, iceDrill: 1 });
    for (const w of [wet, proxima, THICK_AIR_MOON]) {
      for (const code of SEEDS.slice(0, 3)) expect(play(w, { targetSols: 60, code }).status, `${w.id} ${code}`).toBe('won');
    }
  });

  it('leaves out machines the reactors cannot power and packs supplies instead', () => {
    const pack = configFor(THICK_AIR_MOON, { targetSols: 60 }).recommended; // heaters alone take almost all three reactors
    expect(pack.modules.fission).toBe(3);
    expect(pack.modules.iceDrill).toBeUndefined();
    expect(pack.modules.oxygen).toBeUndefined();
    expect(pack.supplies.o2).toBeGreaterThan(configFor(proxima, { targetSols: 60 }).recommended.supplies.o2);
  });

  it('too little power on a cold world loses to the cold', () => {
    const config = configFor(ICY_MOON);
    const m = play(ICY_MOON, { targetSols: 30, loadout: { modules: { fission: 1, spares: 2 }, supplies: PLENTY } });
    expect(m.status).toBe('lost');
    expect(m.lostReason).toBe('cold');
  });

  it('world missions replay identically from the same code and never produce NaN', () => {
    for (const w of [...SYNTHETIC, proxima]) {
      const a = play(w, { code: 'REPLAY', targetSols: 25 });
      const b = play(w, { code: 'REPLAY', targetSols: 25 });
      expect(JSON.stringify(a.history)).toBe(JSON.stringify(b.history));
      for (const day of a.history) for (const [k, v] of Object.entries(day)) if (k !== 'ls') expect(Number.isFinite(v), `${w.id} ${k}`).toBe(true);
    }
  });
});
