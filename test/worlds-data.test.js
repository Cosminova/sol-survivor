// World profiles: provenance labels, NASA snapshot fidelity, scope rules and the deterministic game model.
import { describe, expect, it } from 'vitest';
import { MARS, MOON, RADIATION } from '../src/data/constants.js';
import { EXO_SNAPSHOT } from '../src/data/exoWorlds.generated.js';
import { LIGHT_YEARS_PER_PARSEC, worldIdFor } from '../src/data/exoWorlds.js';
import { SITES, siteById, sitesForBody, sitesForWorld } from '../src/data/sites.js';
import { SOURCES } from '../src/data/sources.js';
import { MODEL_RULES, airTier, dayNightC, groundType, guessWorld, iceScore, isTidallyLocked, radiationMsvPerDay } from '../src/data/worldModel.js';
import { paletteFor } from '../src/data/worldPalette.js';
import { WORLDS, factLabel, worldById, worldsInSystem } from '../src/data/worlds.js';
import { isRocky, massKind, refName } from '../scripts/fetch-worlds.mjs';

const FACT_KEYS = ['radiusEarth', 'massEarth', 'densityGcc', 'gravityG', 'dayHours', 'yearDays', 'orbitAu', 'sunlightWm2', 'tempDayC',
  'tempNightC', 'pressurePa', 'air', 'magneticField', 'radiationMsvPerDay', 'waterIce', 'liquidWater', 'ground', 'hazards'];
const STAR_KEYS = ['teffK', 'radiusSol', 'massSol', 'luminositySol', 'spectralType', 'distanceLy'];
const ORIGINS = ['real', 'derived', 'generated'];
const SOL_IDS = ['mercury', 'venus', 'moon', 'mars', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'enceladus'];
const HEX = /^#[0-9a-f]{6}$/;
const MAX_LIGHT_YEARS = 50;
const MAX_ROCKY_RADIUS = 1.6;
const MAX_ROCKY_MASS = 5;

const exoWorlds = WORLDS.filter((w) => w.kind === 'exoplanet');
const solWorlds = WORLDS.filter((w) => w.system === 'sol');
const snapshotPlanets = EXO_SNAPSHOT.systems.flatMap((system) => system.planets.map((planet) => ({ planet, system })));
const snapshotOf = (name) => snapshotPlanets.find((entry) => entry.planet.name === name);
const allFacts = (world) => [
  ...FACT_KEYS.map((key) => [key, world.facts[key]]),
  ...(world.star ? STAR_KEYS.map((key) => [`star.${key}`, world.star[key]]) : []),
];

describe('world list', () => {
  it('has the ten solar-system worlds and every rocky exoplanet of the snapshot', () => {
    expect(solWorlds.map((w) => w.id).sort()).toEqual([...SOL_IDS].sort());
    expect(exoWorlds.length).toBe(snapshotPlanets.length);
    expect(exoWorlds.length).toBeGreaterThanOrEqual(60);
  });
  it('gives every world a unique id that worldById resolves', () => {
    expect(new Set(WORLDS.map((w) => w.id)).size).toBe(WORLDS.length);
    for (const world of WORLDS) expect(worldById(world.id)).toBe(world);
    expect(worldById('nowhere')).toBeNull();
    expect(worldsInSystem('TRAPPIST-1').length).toBe(7);
  });
  it('has no gas giants', () => {
    for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) expect(worldById(id)).toBeNull();
    for (const world of exoWorlds) {
      const { radiusEarth, massEarth } = world.facts;
      expect(radiusEarth.v, world.id).toBeLessThanOrEqual(MAX_ROCKY_RADIUS);
      if (radiusEarth.origin !== 'real') expect(massEarth.v, world.id).toBeLessThanOrEqual(MAX_ROCKY_MASS);
    }
    for (const world of solWorlds) expect(world.facts.radiusEarth.v, world.id).toBeLessThan(1);
  });
  it('keeps every exoplanet within 50 light-years, with a sky position and a host star', () => {
    for (const world of exoWorlds) {
      expect(world.star.distanceLy.v, world.id).toBeLessThanOrEqual(MAX_LIGHT_YEARS);
      expect(world.sky.ra, world.id).toBeGreaterThanOrEqual(0);
      expect(world.sky.ra, world.id).toBeLessThan(360);
      expect(Math.abs(world.sky.dec), world.id).toBeLessThanOrEqual(90);
      expect(world.system).toBe(world.parent);
    }
    for (const world of solWorlds) expect(world.star).toBeNull();
  });
});

describe('provenance', () => {
  it('gives every world every fact with a valid origin and a usable value', () => {
    for (const world of WORLDS) {
      for (const [key, fact] of allFacts(world)) {
        expect(fact, `${world.id} ${key}`).toBeDefined();
        expect(ORIGINS, `${world.id} ${key}`).toContain(fact.origin);
        expect(fact.v, `${world.id} ${key}`).not.toBeNull();
        expect(fact.v, `${world.id} ${key}`).not.toBeUndefined();
        if (typeof fact.v === 'number') expect(Number.isFinite(fact.v), `${world.id} ${key}`).toBe(true);
        expect(['Real · NASA', 'Generated · game model']).toContain(factLabel(fact));
      }
    }
  });
  it('cites a known source for every real fact and the game model for every generated one', () => {
    for (const world of WORLDS) {
      for (const [key, fact] of allFacts(world)) {
        if (fact.origin === 'real') expect(SOURCES[fact.src], `${world.id} ${key} -> ${fact.src}`).toBeDefined();
        if (fact.origin === 'generated') expect(fact.src, `${world.id} ${key}`).toBe('game-model');
        if (fact.origin === 'derived') expect(fact.src.length, `${world.id} ${key}`).toBeGreaterThan(0);
      }
    }
  });
  it('never calls a computed archive value real', () => {
    for (const { planet } of snapshotPlanets) {
      const facts = worldById(worldIdFor(planet.name)).facts;
      if (planet.radiusCalc) expect(facts.radiusEarth.origin, planet.name).toBe('derived');
      if (planet.densityCalc !== false) expect(facts.densityGcc.origin, planet.name).toBe('derived');
      if (planet.massKind === 'estimated' || planet.massKind === 'upper-limit') expect(facts.massEarth.origin, planet.name).toBe('derived');
      if (planet.massKind === 'minimum') expect(facts.massEarth.note, planet.name).toMatch(/minimum/);
      expect(facts.gravityG.origin).toBe('derived');
      expect(facts.sunlightWm2.origin).toBe('derived');
    }
    expect(worldById('proxima-cen-b').facts.radiusEarth.origin).toBe('derived'); // found by radial velocity: no measured size
    expect(worldById('trappist-1-e').facts.radiusEarth.origin).toBe('real'); // transits: size measured
  });
  it('labels the unmeasured exoplanet facts as generated', () => {
    const guessed = ['tempDayC', 'tempNightC', 'pressurePa', 'air', 'magneticField', 'radiationMsvPerDay', 'waterIce', 'liquidWater', 'ground', 'hazards'];
    for (const world of exoWorlds) for (const key of guessed) expect(world.facts[key].origin, `${world.id} ${key}`).toBe('generated');
  });
  it('labels solar-system doses without a NASA surface value as generated', () => {
    expect(worldById('europa').facts.radiationMsvPerDay.origin).toBe('generated');
    expect(worldById('moon').facts.radiationMsvPerDay.origin).toBe('real');
    expect(worldById('mars').facts.radiationMsvPerDay.origin).toBe('real');
  });
});

describe('NASA values', () => {
  it('keeps the Moon and Mars equal to constants.js', () => {
    const moon = worldById('moon').facts;
    expect(moon.gravityG.v).toBe(MOON.gravity);
    expect(moon.sunlightWm2.v).toBe(MOON.meanSolarFlux);
    expect(moon.dayHours.v).toBeCloseTo(MOON.synodicDays * 24, 0);
    expect(moon.radiationMsvPerDay.v).toBe(RADIATION.moonSurfaceMsvPerDay);
    const mars = worldById('mars').facts;
    expect(mars.gravityG.v).toBe(MARS.gravity);
    expect(mars.dayHours.v).toBe(MARS.dayHours);
    expect(mars.sunlightWm2.v).toBe(MARS.meanSolarFlux);
    expect(mars.orbitAu.v).toBe(MARS.semiMajorAU);
    expect(mars.pressurePa.v).toBe(MARS.surfacePressurePa);
    expect(mars.radiationMsvPerDay.v).toBe(RADIATION.marsSurfaceGcrMsvPerSol);
    expect(worldById('moon').analog).toBe('moon');
    expect(worldById('mars').analog).toBe('mars');
  });
  it('carries the fact-sheet numbers for the other solar-system worlds', () => {
    const venus = worldById('venus').facts;
    expect(venus.pressurePa.v).toBe(9.2e6);
    expect(venus.tempDayC.v).toBe(464);
    expect(venus.air.v[0]).toEqual({ gas: 'CO2', pct: 96.5 });
    const titan = worldById('titan').facts;
    expect(titan.air.v.map((part) => part.gas)).toEqual(['N2', 'CH4']);
    expect(titan.pressurePa.v).toBeGreaterThan(1.4e5);
    expect(titan.gravityG.v).toBeCloseTo(0.138, 2);
    expect(worldById('titan').palette.liquid).toMatch(HEX);
    expect(worldById('mercury').facts.sunlightWm2.v).toBe(9082.7);
    expect(worldById('io').facts.ground.v).toBe('sulfur');
    expect(worldById('io').facts.gravityG.v).toBeCloseTo(0.183, 2);
    for (const id of ['europa', 'ganymede', 'enceladus', 'titan']) expect(worldById(id).facts.liquidWater.v, id).toBe('subsurface');
    for (const id of ['io', 'europa', 'ganymede', 'callisto']) expect(worldById(id).parent).toBe('jupiter');
  });
  it.each(['Proxima Cen b', 'TRAPPIST-1 e', 'Ross 128 b'])('matches the archive snapshot exactly for %s', (name) => {
    const { planet, system } = snapshotOf(name);
    const world = worldById(worldIdFor(name));
    expect(world.facts.radiusEarth.v).toBe(planet.radiusEarth);
    expect(world.facts.massEarth.v).toBe(planet.massEarth);
    expect(world.facts.densityGcc.v).toBe(planet.densityGcc);
    expect(world.facts.yearDays.v).toBe(planet.periodDays);
    expect(world.facts.orbitAu.v).toBe(planet.aAu);
    expect(world.sky).toEqual({ ra: system.ra, dec: system.dec });
    expect(world.star.teffK.v).toBe(system.teffK);
    expect(world.star.radiusSol.v).toBe(system.radiusSol);
    expect(world.star.massSol.v).toBe(system.massSol);
    expect(world.star.spectralType.v).toBe(system.spectralType);
    expect(world.star.distanceLy.v).toBeCloseTo(system.distPc * LIGHT_YEARS_PER_PARSEC, 2);
    expect(world.facts.yearDays.src).toBe('exo-archive');
  });
  it('records when and where the snapshot came from', () => {
    expect(EXO_SNAPSHOT.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(EXO_SNAPSHOT.query).toContain('pscomppars');
    expect(SOURCES['exo-archive'].url).toMatch(/^https:\/\/exoplanetarchive/);
  });
});

describe('fetch-worlds row rules', () => {
  const row = { pl_rade: 1.2, pl_radelim: 0, pl_bmasse: 2, pl_bmasselim: 0, pl_bmassprov: 'Mass', pl_bmasse_reflink: '<a href=x>Agol et al. 2021</a>' };
  it('accepts small planets and falls back to mass when the radius is missing or only a limit', () => {
    expect(isRocky(row)).toBe(true);
    expect(isRocky({ ...row, pl_rade: 2.4 })).toBe(false);
    expect(isRocky({ ...row, pl_rade: null, pl_bmasse: 4.9 })).toBe(true);
    expect(isRocky({ ...row, pl_rade: null, pl_bmasse: 16 })).toBe(false);
    expect(isRocky({ ...row, pl_radelim: -1, pl_bmasse: 7.3 })).toBe(false);
    expect(isRocky({ ...row, pl_rade: null, pl_bmasse: null })).toBe(false);
  });
  it('tells measured masses from minimum, estimated and limit masses', () => {
    expect(massKind(row)).toBe('measured');
    expect(massKind({ ...row, pl_bmassprov: 'Msini' })).toBe('minimum');
    expect(massKind({ ...row, pl_bmassprov: 'M-R relationship' })).toBe('estimated');
    expect(massKind({ ...row, pl_bmasselim: 1 })).toBe('upper-limit');
    expect(refName('<a refstr=X href=y target=ref>Su&aacute;rez Mascare&ntilde;o et al. 2025</a>')).toBe('Suárez Mascareño et al. 2025');
    expect(refName(null)).toBeNull();
  });
});

describe('game model', () => {
  const known = { name: 'Test b', massEarth: 1.1, densityGcc: 5.4, gravityG: 1.0, eqK: 230, insol: 0.7, periodDays: 11, ecc: 0, starTeffK: 3000 };
  it('is deterministic', () => {
    expect(guessWorld(known)).toEqual(guessWorld({ ...known }));
    for (const { planet } of snapshotPlanets.slice(0, 10)) {
      const world = worldById(worldIdFor(planet.name));
      const look = {
        ground: world.facts.ground.v, waterIce: world.facts.waterIce.v, liquid: null, pressurePa: world.facts.pressurePa.v,
        air: world.facts.air.v, starTeffK: world.star.teffK.v, seed: planet.name,
      };
      expect(paletteFor(look)).toEqual(paletteFor(look));
    }
  });
  it('tags every guess as generated', () => {
    for (const fact of Object.values(guessWorld(known).facts)) expect(fact).toMatchObject({ origin: 'generated', src: 'game-model' });
  });
  it('locks close-in planets to their star', () => {
    expect(isTidallyLocked(MODEL_RULES.lockPeriodDays - 1)).toBe(true);
    expect(isTidallyLocked(MODEL_RULES.lockPeriodDays + 1)).toBe(false);
    expect(worldById('proxima-cen-b').facts.dayHours).toMatchObject({ origin: 'derived', src: 'tidal-lock' });
    expect(worldById('gj-667-c-e').facts.dayHours.origin).toBe('generated');
  });
  it('reads the ground from density and heat', () => {
    expect(groundType({ densityGcc: 7, dayC: 100, insol: 2 })).toBe('iron-rich');
    expect(groundType({ densityGcc: 5.5, dayC: 100, insol: 2 })).toBe('basalt');
    expect(groundType({ densityGcc: 3, dayC: 100, insol: 2 })).toBe('water-rich');
    expect(groundType({ densityGcc: 3, dayC: -100, insol: 0.2 })).toBe('ice-shell');
    expect(groundType({ densityGcc: 5.5, dayC: 1200, insol: 300 })).toBe('lava');
  });
  it('strips the air from small or scorched planets', () => {
    expect(airTier({ insol: 20, gravityG: 1.2 })).toBe('none');
    expect(airTier({ insol: 0.7, gravityG: 0.3 })).toBe('none');
    expect(airTier({ insol: 2.5, gravityG: 1.2 })).toBe('thin');
    expect(airTier({ insol: 0.7, gravityG: 1.0 })).toBe('mild');
  });
  it('makes airless locked worlds hot by day and cold by night', () => {
    const bare = dayNightC({ eqK: 300, insol: 1, locked: true, hasAir: false });
    const airy = dayNightC({ eqK: 300, insol: 1, locked: true, hasAir: true });
    expect(bare.dayC).toBeGreaterThan(airy.dayC);
    expect(bare.nightC).toBeLessThan(airy.nightC);
    expect(dayNightC({ eqK: null, insol: 1, locked: false, hasAir: true }).dayC).toBeGreaterThan(-20);
  });
  it('keeps more ice on dimmer worlds and none on hot spinning ones', () => {
    expect(iceScore({ insol: 0.2, locked: true, ground: 'basalt' })).toBeGreaterThan(iceScore({ insol: 3, locked: true, ground: 'basalt' }));
    expect(iceScore({ insol: 10, locked: true, ground: 'basalt' })).toBeGreaterThan(0);
    expect(iceScore({ insol: 10, locked: false, ground: 'basalt' })).toBe(0);
    expect(iceScore({ insol: 500, locked: true, ground: 'lava' })).toBe(0);
  });
  it('raises radiation near cool flaring stars and lowers it under air', () => {
    const base = { insol: 1, tier: 'none', field: 'none' };
    expect(radiationMsvPerDay({ ...base, teffK: 3000 })).toBeGreaterThan(radiationMsvPerDay({ ...base, teffK: 5500 }));
    expect(radiationMsvPerDay({ ...base, teffK: 3000, tier: 'mild' })).toBeLessThan(radiationMsvPerDay({ ...base, teffK: 3000 }));
    expect(radiationMsvPerDay({ ...base, teffK: 5500, insol: 0 })).toBeCloseTo(RADIATION.moonSurfaceMsvPerDay, 1);
  });
  it('borrows the Mars code path only for worlds with air', () => {
    for (const world of WORLDS) expect(world.analog, world.id).toBe(world.facts.pressurePa.v > 0 ? 'mars' : 'moon');
  });
});

describe('palettes, blurbs and sites', () => {
  it('paints every world with valid colours', () => {
    for (const world of WORLDS) {
      const { ground, rock, sky, ice, haze, liquid } = world.palette;
      for (const colour of [ground, rock, sky]) expect(colour, world.id).toMatch(HEX);
      for (const colour of [ice, haze, liquid]) if (colour !== null) expect(colour, world.id).toMatch(HEX);
      expect(haze === null, world.id).toBe(world.facts.pressurePa.v === 0);
    }
    expect(worldById('io').palette.ground).not.toBe(worldById('europa').palette.ground);
  });
  it('gives every world a short blurb', () => {
    for (const world of WORLDS) {
      expect(world.blurb.length, world.id).toBeGreaterThan(20);
      expect(world.blurb.length, world.id).toBeLessThan(200);
    }
  });
  it('gives every world two or more complete sites', () => {
    const ids = WORLDS.flatMap((world) => world.sites.map((site) => site.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const world of WORLDS) {
      expect(world.sites.length, world.id).toBeGreaterThanOrEqual(2);
      for (const site of world.sites) {
        expect(site.name.length, site.id).toBeGreaterThan(2);
        expect(Math.abs(site.lat), site.id).toBeLessThanOrEqual(90);
        expect(Math.abs(site.lon), site.id).toBeLessThanOrEqual(180);
        expect(site.iceAccess, site.id).toBeGreaterThanOrEqual(0);
        expect(site.iceAccess, site.id).toBeLessThanOrEqual(1);
        expect(site.science, site.id).toBeGreaterThan(0);
        expect(site.blurb.length, site.id).toBeGreaterThan(20);
        expect(site.blurb.length, site.id).toBeLessThan(160);
        expect(site.origin, site.id).toBe(world.kind === 'exoplanet' ? 'generated' : 'real');
        expect(site.worldId, site.id).toBe(world.id);
        if (site.source) expect(SOURCES[site.source], site.id).toBeDefined();
      }
    }
  });
  it('resolves sites of every world and keeps the Moon and Mars helpers working', () => {
    for (const world of WORLDS) {
      for (const site of world.sites) expect(siteById(site.id)?.name, site.id).toBe(site.name);
      expect(sitesForWorld(world.id).map((site) => site.id)).toEqual(world.sites.map((site) => site.id));
    }
    expect(siteById('jezero')).toBe(SITES.find((site) => site.id === 'jezero'));
    expect(sitesForBody('mars').length).toBe(4);
    expect(sitesForBody('moon').length).toBe(2);
    expect(sitesForBody('europa')).toEqual([]);
    expect(siteById('europa-conamara').name).toBe('Conamara Chaos');
    expect(siteById('proxima-cen-b-twilight').origin).toBe('generated');
    expect(siteById('nowhere')).toBeNull();
    expect(sitesForWorld('nowhere')).toEqual([]);
  });
});
