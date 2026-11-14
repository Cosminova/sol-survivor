import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { marsTime, missionSol, seasonName, MISSIONS, lightDelaySeconds, sunEarthMarsAngleDeg } from './marsTime.js';
import { marsSolarKwh, moonSolarKwh, moonIsSunlit, atmosphericTransmission } from './solar.js';
import { classifySepEvents, flareStrength, severityFromFlare } from './spaceWeather.js';
import { buildWeatherIndex, marsWeather, baselineTau, dustStormChance, moonConditions } from './environment.js';
import { createRng, hashSeed } from './rng.js';
import { siteById } from '../data/sites.js';

const root = path.resolve(__dirname, '../../public/data');
const donki = JSON.parse(fs.readFileSync(path.join(root, 'donki.json'), 'utf8'));
const rems = JSON.parse(fs.readFileSync(path.join(root, 'rems.json'), 'utf8'));

describe('marsTime (Mars24)', () => {
  const landing = MISSIONS.curiosity.landing;

  it('gives mission sol 0 and Ls ≈ 150.6 at Curiosity landing', () => {
    expect(landing.toISOString()).toBe('2012-08-06T05:17:57.000Z');
    expect(missionSol(landing, landing, MISSIONS.curiosity.lon)).toBe(0);
    expect(marsTime(landing).ls).toBeCloseTo(150.6, 0);
    expect(Math.abs(marsTime(landing).ls - 150.6)).toBeLessThan(1);
  });

  it('counts sols forward from landing', () => {
    const later = new Date(landing.getTime() + 10 * 1.0274912517 * 86400000);
    expect(missionSol(later, landing, MISSIONS.curiosity.lon)).toBe(10);
  });

  it('names the seasons for both hemispheres', () => {
    expect(seasonName(10)).toBe('Spring');
    expect(seasonName(100)).toBe('Summer');
    expect(seasonName(200)).toBe('Autumn');
    expect(seasonName(300)).toBe('Winter');
    expect(seasonName(10, false)).toBe('Autumn');
    expect(seasonName(300, false)).toBe('Summer');
    expect(seasonName(370)).toBe('Spring');
  });

  it('keeps the Earth-Mars light delay within 3 to 22.3 minutes across 2024-2026', () => {
    for (let m = 0; m < 36; m += 1) {
      const d = new Date(Date.UTC(2024, m, 15));
      const min = lightDelaySeconds(d) / 60;
      expect(min).toBeGreaterThan(2.9);
      expect(min).toBeLessThan(22.5);
      const angle = sunEarthMarsAngleDeg(d);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(180);
    }
  });
});

describe('solar', () => {
  const gale = siteById('gale');

  it('produces positive power at Ls 0 and far less at tau 8', () => {
    const clear = marsSolarKwh({ areaM2: 100, latDeg: gale.lat, ls: 0, tau: 0.5, dust: 0 });
    const storm = marsSolarKwh({ areaM2: 100, latDeg: gale.lat, ls: 0, tau: 8, dust: 0 });
    expect(clear).toBeGreaterThan(0);
    expect(storm).toBeGreaterThan(0);
    expect(storm).toBeLessThan(clear / 5);
    expect(atmosphericTransmission(0.5)).toBeCloseTo(0.8, 1);
  });

  it('loses output as dust covers the panels', () => {
    const clean = marsSolarKwh({ areaM2: 100, latDeg: gale.lat, ls: 90, tau: 0.5, dust: 0 });
    const dusty = marsSolarKwh({ areaM2: 100, latDeg: gale.lat, ls: 90, tau: 0.5, dust: 0.5 });
    expect(dusty).toBeCloseTo(clean / 2, 5);
  });

  it('is 0 during lunar night at Mare Tranquillitatis', () => {
    const site = siteById('tranquility');
    expect(moonIsSunlit(site, 3)).toBe(true);
    expect(moonIsSunlit(site, 16)).toBe(false);
    expect(moonSolarKwh({ areaM2: 100, site, dayIndex: 3, dust: 0 })).toBeGreaterThan(0);
    expect(moonSolarKwh({ areaM2: 100, site, dayIndex: 16, dust: 0 })).toBe(0);
    expect(moonConditions(site, 16).lit).toBe(false);
    expect(moonConditions(site, 16).avgC).toBe(site.tempNightC);
  });

  it('Shackleton rim stays lit most of the month', () => {
    const site = siteById('shackleton');
    const lit = Array.from({ length: 30 }, (_, d) => moonIsSunlit(site, d)).filter(Boolean).length;
    expect(lit).toBeGreaterThanOrEqual(25);
  });
});

describe('space weather', () => {
  it('ranks flares X > M > C', () => {
    expect(flareStrength('X1.0')).toBeGreaterThan(flareStrength('M9.9'));
    expect(flareStrength('M1.0')).toBeGreaterThan(flareStrength('C9.9'));
    expect(flareStrength('C2.0')).toBeGreaterThan(flareStrength('B5.0'));
    expect(flareStrength(null)).toBe(0);
    expect(severityFromFlare('X2.2')).toBe('major');
    expect(severityFromFlare('M5')).toBe('moderate');
    expect(severityFromFlare('C1')).toBe('minor');
  });

  it('classifies the real DONKI archive with a major event in May 2024', () => {
    const events = classifySepEvents(donki);
    expect(events.length).toBeGreaterThan(10);
    const severities = new Set(events.map((e) => e.severity));
    expect(severities.has('major')).toBe(true);
    const may2024 = events.filter((e) => e.time >= Date.UTC(2024, 4, 1) && e.time < Date.UTC(2024, 5, 1));
    expect(may2024.some((e) => e.severity === 'major')).toBe(true);
    expect(may2024.some((e) => e.flareClass?.startsWith('X'))).toBe(true);
    for (let i = 1; i < events.length; i += 1) expect(events[i].time).toBeGreaterThan(events[i - 1].time);
  });
});

describe('environment', () => {
  it('indexes REMS by Ls and returns Gale-like temperatures', () => {
    const index = buildWeatherIndex(rems);
    expect(index).toHaveLength(360);
    const w = marsWeather(index, 246, siteById('gale'), 0);
    expect(w.minC).toBeLessThan(w.maxC);
    expect(w.minC).toBeGreaterThan(-110);
    expect(w.maxC).toBeLessThan(30);
    expect(w.pressurePa).toBeGreaterThan(600);
    expect(w.reference).toMatchObject({ sol: expect.any(Number), earthDate: expect.any(String) });
    const cold = marsWeather(index, 246, siteById('utopia'), 0);
    expect(cold.minC).toBe(w.minC - 22);
  });

  it('falls back when no index is given', () => {
    const w = marsWeather(null, 100, siteById('gale'), 0);
    expect(w).toMatchObject({ minC: -75, maxC: -5, pressurePa: 750, reference: null });
  });

  it('is dustier and stormier from Ls 180 to 330', () => {
    expect(baselineTau(90)).toBe(0.5);
    expect(baselineTau(255)).toBeGreaterThan(0.9);
    expect(dustStormChance(250)).toBeGreaterThan(dustStormChance(90));
  });
});

describe('rng', () => {
  it('replays identically from the same seed', () => {
    const a = createRng('ABC123');
    const b = createRng('ABC123');
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(hashSeed('ABC123')).not.toBe(hashSeed('ABC124'));
    expect(a.state()).toBe(b.state());
  });
});
