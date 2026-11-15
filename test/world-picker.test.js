import { describe, it, expect } from 'vitest';
import {
  julianDay, planetRaDec, moonRaDec, sunRaDec, raDecToVector, toHorizontal, horizontalToVector, solveKepler, bvToRgb, gmstDeg,
} from '../src/ui/worldPicker/ephemeris.js';
import {
  GAS_GIANTS, SOLAR_TARGETS, OBSERVERS, isLandableWorld, isAllowedTarget, skyTargets, starTargets, worldsForTarget, catalogueMatch, whereInSky,
} from '../src/ui/worldPicker/targets.js';
import { factRows, provenanceLine, formatDay, formatPressure } from '../src/ui/worldPicker/worldFacts.js';
import { eveningInstant, resolveSites } from '../src/ui/worldPicker/worldSites.js';
import { WORLDS, worldById, real, generated } from '../src/data/worlds.js';
import { siteById } from '../src/data/sites.js';
import { SOURCES } from '../src/data/sources.js';
import SKY from '../src/data/skyStars.json';

// Reference values: JPL Horizons, observer table, geocentric (500@399), astrometric RA/Dec J2000, 2026-Nov-14 00:00 UT.
const DATE = new Date(Date.UTC(2026, 10, 14, 0, 0));
const HORIZONS = { mars: { ra: 147.43879, dec: 15.13533 }, venus: { ra: 200.17239, dec: -10.29398 }, moon: { ra: 284.70757, dec: -26.10939 } };
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

const exo = (over = {}) => ({
  id: 'test-b', name: 'Test b', kind: 'exoplanet', parent: 'Test', system: 'Test', analog: 'moon', sky: { ra: 10, dec: 20 },
  star: { name: 'Test Star', distanceLy: real(12, 'exo-archive') }, facts: { radiusEarth: real(1.1, 'exo-archive'), gravityG: real(1, 'exo-archive') },
  sites: [], blurb: '', ...over,
});

describe('ephemeris', () => {
  it('computes the Julian Day of J2000', () => {
    expect(julianDay(new Date(Date.UTC(2000, 0, 1, 12)))).toBeCloseTo(2451545.0, 6);
  });

  it('solves Kepler\'s equation', () => {
    const E = solveKepler(1.0, 0.2);
    expect(E - 0.2 * Math.sin(E)).toBeCloseTo(1.0, 9);
  });

  it('places Mars within 0.05 degrees of JPL Horizons', () => {
    const p = planetRaDec('mars', DATE);
    expect(angleDiff(p.ra, HORIZONS.mars.ra)).toBeLessThan(0.05);
    expect(Math.abs(p.dec - HORIZONS.mars.dec)).toBeLessThan(0.05);
  });

  it('places Venus within 0.05 degrees of JPL Horizons', () => {
    const p = planetRaDec('venus', DATE);
    expect(angleDiff(p.ra, HORIZONS.venus.ra)).toBeLessThan(0.05);
    expect(Math.abs(p.dec - HORIZONS.venus.dec)).toBeLessThan(0.05);
  });

  it('places the geocentric Moon within 0.1 degrees of JPL Horizons', () => {
    const m = moonRaDec(DATE);
    expect(angleDiff(m.ra, HORIZONS.moon.ra)).toBeLessThan(0.1);
    expect(Math.abs(m.dec - HORIZONS.moon.dec)).toBeLessThan(0.1);
    expect(m.dist).toBeGreaterThan(356000);
    expect(m.dist).toBeLessThan(407000);
  });

  it('shifts the Moon by parallax for an observer on the ground (under 1.1 degrees)', () => {
    const geo = moonRaDec(DATE);
    const topo = moonRaDec(DATE, OBSERVERS[0]);
    const shift = Math.hypot(angleDiff(geo.ra, topo.ra) * Math.cos(geo.dec * Math.PI / 180), geo.dec - topo.dec);
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeLessThan(1.1);
  });

  it('puts the Sun near the June solstice point in late June', () => {
    const s = sunRaDec(new Date(Date.UTC(2026, 5, 21, 12)));
    expect(angleDiff(s.ra, 90)).toBeLessThan(1.5);
    expect(s.dec).toBeCloseTo(23.44, 0);
  });

  it('turns RA/Dec into unit vectors', () => {
    expect(raDecToVector(0, 0).map((v) => Math.round(v * 1e9) / 1e9)).toEqual([1, 0, 0]);
    expect(raDecToVector(90, 0)[1]).toBeCloseTo(1, 9);
    expect(raDecToVector(123, 90)[2]).toBeCloseTo(1, 9);
    expect(Math.hypot(...raDecToVector(217.4, -62.7))).toBeCloseTo(1, 9);
  });

  it('puts the north celestial pole at an altitude equal to the latitude', () => {
    const { alt, az } = toHorizontal({ ra: 37, dec: 90 }, { lat: 29.56, lon: -95.09 }, DATE);
    expect(alt).toBeCloseTo(29.56, 6);
    expect(Math.min(az, 360 - az)).toBeLessThan(1e-6);
  });

  it('puts a star on the local meridian due south when its RA equals local sidereal time', () => {
    const observer = { lat: 30, lon: 0 };
    const lst = gmstDeg(julianDay(DATE));
    const { alt, az } = toHorizontal({ ra: lst, dec: 0 }, observer, DATE);
    expect(alt).toBeCloseTo(60, 6);
    expect(az).toBeCloseTo(180, 6);
  });

  it('maps altitude/azimuth to y-up vectors with north at -z and east at +x', () => {
    const up = horizontalToVector(90, 0);
    expect(up[1]).toBeCloseTo(1, 9);
    expect(horizontalToVector(0, 0)[2]).toBeCloseTo(-1, 9);
    expect(horizontalToVector(0, 90)[0]).toBeCloseTo(1, 9);
  });

  it('colours hot stars blue-white and cool stars orange-red from B-V', () => {
    const [rHot, , bHot] = bvToRgb(-0.2);
    const [rCool, , bCool] = bvToRgb(1.6);
    expect(bHot).toBeGreaterThan(rHot * 0.9);
    expect(rCool).toBeGreaterThan(bCool);
    for (const c of bvToRgb(Number.NaN)) expect(c).toBeGreaterThanOrEqual(0);
  });
});

describe('star catalogue', () => {
  it('holds a few thousand naked-eye stars as [ra, dec, mag, bv] rows', () => {
    expect(SKY.stars.length).toBeGreaterThan(2000);
    expect(SKY.stars.length).toBeLessThan(4000);
    for (const [ra, dec, mag, bv] of SKY.stars) {
      expect(ra).toBeGreaterThanOrEqual(0);
      expect(ra).toBeLessThan(360);
      expect(Math.abs(dec)).toBeLessThanOrEqual(90);
      expect(mag).toBeLessThanOrEqual(SKY.magLimit);
      expect(Number.isFinite(bv)).toBe(true);
    }
  });

  it('names Sirius as the brightest star', () => {
    expect(SKY.names['0']).toBe('Sirius');
  });

  it('is credited in the sources list', () => {
    expect(SOURCES['sky-stars']).toBeDefined();
    expect(SOURCES['meeus-moon']).toBeDefined();
    expect(SOURCES['jpl-elements']).toBeDefined();
  });
});

describe('sky targets', () => {
  const targets = skyTargets(WORLDS, DATE, OBSERVERS[1], SKY.stars);

  it('only offers stars and Solar System bodies: no galaxies, nebulae or deep-sky objects', () => {
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(['star', 'body']).toContain(t.kind);
    expect(isAllowedTarget({ kind: 'galaxy' })).toBe(false);
    expect(isAllowedTarget({ kind: 'nebula' })).toBe(false);
  });

  it('includes the Moon, the rocky planets and the gas-giant gateways', () => {
    const ids = targets.map((t) => t.id);
    for (const id of ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) expect(ids).toContain(id);
    expect(targets.find((t) => t.id === 'jupiter').gateway).toBe(true);
    expect(targets.find((t) => t.id === 'mars').gateway).toBe(false);
  });

  it('never makes a gas giant landable', () => {
    for (const id of GAS_GIANTS) expect(isLandableWorld({ id, kind: 'planet', facts: {} })).toBe(false);
    expect(isLandableWorld(exo({ facts: { radiusEarth: real(11, 'exo-archive') } }))).toBe(false);
    expect(isLandableWorld(exo())).toBe(true);
  });

  it('only opens moons from Jupiter and Saturn, never the planet itself', () => {
    const jupiter = { ...SOLAR_TARGETS.find((t) => t.id === 'jupiter'), kind: 'body' };
    const worlds = [...WORLDS, { id: 'jupiter', kind: 'planet', facts: {} }, { id: 'europa', kind: 'moon', parent: 'jupiter', facts: {} }];
    const { worlds: found, missing } = worldsForTarget(jupiter, worlds);
    expect(found.map((w) => w.id)).toEqual(['europa']);
    expect(missing).toEqual(['io', 'ganymede', 'callisto']);
  });

  it('makes one ringed host-star target per exoplanet system, flagged too faint when not in the catalogue', () => {
    const stars = starTargets([...WORLDS, exo({ id: 'test-c', name: 'Test c' }), exo()], SKY.stars);
    const proxima = stars.find((t) => t.system === 'Proxima Cen');
    expect(proxima.name).toBe('Proxima Centauri');
    expect(proxima.nakedEye).toBe(false);
    expect(stars.find((t) => t.system === 'Test').worldIds).toEqual(['test-c', 'test-b']);
  });

  it('matches a host star to a bright catalogue star when one sits at its position', () => {
    const [ra, dec, mag] = SKY.stars[0];
    expect(catalogueMatch({ ra, dec }, SKY.stars).mag).toBe(mag);
    expect(catalogueMatch({ ra: 0, dec: -89.99 }, [])).toBeNull();
  });

  it('lists Proxima Centauri b behind its host star', () => {
    const proxima = targets.find((t) => t.system === 'Proxima Cen');
    expect(worldsForTarget(proxima, WORLDS).worlds.map((w) => w.id)).toEqual(['proxima-cen-b']);
  });

  it('sees Proxima Centauri above the horizon from Canberra in the evening', () => {
    const night = eveningInstant('2026-11-14', OBSERVERS[1]);
    const proxima = skyTargets(WORLDS, night, OBSERVERS[1], SKY.stars).find((t) => t.system === 'Proxima Cen');
    expect(proxima.aboveHorizon).toBe(true);
  });

  it('describes where a target is in plain words', () => {
    expect(whereInSky({ aboveHorizon: false })).toBe('Below the horizon right now.');
    expect(whereInSky({ aboveHorizon: true, alt: 70, az: 182 })).toBe('High up in the south.');
    expect(whereInSky({ aboveHorizon: true, alt: 10, az: 88 })).toBe('Low in the east.');
  });
});

describe('world cards', () => {
  it('gives every fact row a provenance badge from factLabel()', () => {
    const rows = factRows(worldById('proxima-cen-b'));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const r of rows) expect(['Real · NASA', 'Generated · game model']).toContain(r.badge);
    expect(rows.find((r) => r.key === 'gravity').badge).toBe('Real · NASA');
    expect(rows.find((r) => r.key === 'tempDay').badge).toBe('Generated · game model');
    expect(rows.find((r) => r.key === 'distance').value).toMatch(/4.24 light-years/);
  });

  it('says plainly when some details are generated', () => {
    expect(provenanceLine(worldById('proxima-cen-b'))).toMatch(/Real planet.*Some details below are generated because nobody has measured them yet\./);
    expect(provenanceLine(exo({ discovered: 2016 }))).toMatch(/discovered in 2016/);
    expect(provenanceLine(worldById('mars'))).toMatch(/Every detail below is measured/);
    expect(provenanceLine(exo({ facts: { gravityG: generated(1) } }))).toMatch(/generated/);
  });

  it('formats days and air for kids', () => {
    expect(formatDay(24.6597)).toBe('24.7 hours');
    expect(formatDay(268.4)).toBe('11.2 Earth days');
    expect(formatPressure(0)).toBe('No air to breathe');
    expect(formatPressure(610)).toMatch(/Very thin air/);
  });
});

describe('landing sites', () => {
  it('uses the Moon and Mars site lists for those worlds', () => {
    expect(resolveSites(worldById('mars')).sites.map((s) => s.id)).toContain('jezero');
    expect(resolveSites(worldById('moon')).practice).toBe(false);
  });

  it('prefers sitesForWorld() once the data module provides it', () => {
    const data = { sitesForWorld: (id) => (id === 'test-b' ? [{ id: 'test-site' }] : []), sitesForBody: () => [] };
    expect(resolveSites(exo(), data)).toEqual({ sites: [{ id: 'test-site' }], practice: false });
  });

  it('falls back to a practice zone the engine can resolve when a world has no mapped sites', () => {
    const { sites, practice } = resolveSites(exo());
    expect(practice).toBe(true);
    expect(siteById(sites[0].id)).not.toBeNull();
  });

  it('shows the sky at 9 pm local solar time', () => {
    const t = eveningInstant('2026-11-14', { lon: 150 });
    expect(t.toISOString()).toBe('2026-11-14T11:00:00.000Z');
    expect(eveningInstant('nonsense', { lon: 0 })).toBeInstanceOf(Date);
  });
});
