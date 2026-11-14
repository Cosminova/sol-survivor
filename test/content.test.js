import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { remsHighlights, remsSeasonalCycle, donkiHighlights, xFlaresInMonth, compareDose } from '../src/engine/dataLab.js';
import { QUIZ, questionById } from '../src/data/quiz.js';
import { DID_YOU_KNOW } from '../src/data/facts.js';
import { TIMELINE } from '../src/data/timeline.js';
import { DOSE_LADDER, DOSE_CHART } from '../src/data/doses.js';

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url)));
const rems = read('../public/data/rems.json');
const donki = read('../public/data/donki.json');
const milestones = read('../public/data/milestones.json');
const imageExists = (file) => fs.existsSync(new URL(`../public/images/${file}`, import.meta.url));
const correctText = (id) => {
  const q = questionById(id);
  return q.choices[q.answer];
};

describe('Data Lab: Curiosity REMS', () => {
  const h = remsHighlights(rems);

  it('summarizes thousands of sols of real weather', () => {
    expect(h.sols).toBeGreaterThan(4000);
    expect(h.firstDate).toBe('2012-08-07');
    expect(h.warmest.maxC).toBeGreaterThan(h.coldest.minC);
  });

  it('backs the coldest-night quiz answer and fact', () => {
    expect(h.coldest).toMatchObject({ minC: -100, sol: 2803, earthDate: '2020-06-25' });
    expect(correctText('sci-08')).toBe('−100 °C');
    expect(DID_YOU_KNOW.some((f) => f.text.includes('−100 °C') && f.text.includes('25 June 2020'))).toBe(true);
  });

  it('backs the pressure-range and day–night quiz text', () => {
    expect(Math.round(h.lowestPressure.pressurePa / 10) * 10).toBe(680);
    expect(h.highestPressure.pressurePa).toBe(925);
    expect(questionById('weather-07').question).toContain('680 to 925 pascals');
    expect(h.avgMaxC).toBeGreaterThan(-20);
    expect(h.avgMaxC).toBeLessThan(0);
    expect(h.avgMinC).toBeGreaterThan(-80);
    expect(h.avgMinC).toBeLessThan(-70);
  });

  it('shows the seasonal CO₂ pressure cycle across a Mars year', () => {
    const cycle = remsSeasonalCycle(rems);
    expect(cycle).toHaveLength(12);
    const pressures = cycle.map((b) => b.pressurePa).filter((p) => p != null);
    expect(Math.max(...pressures) - Math.min(...pressures)).toBeGreaterThan(100);
    expect(cycle.every((b) => b.sols > 0)).toBe(true);
  });

  it('handles missing data', () => {
    expect(remsHighlights(null)).toMatchObject({ sols: 0, coldest: null, avgMinC: null });
    expect(remsSeasonalCycle({ rows: [] }).every((b) => b.minC === null)).toBe(true);
  });
});

describe('Data Lab: DONKI space weather', () => {
  const h = donkiHighlights(donki);

  it('backs the strongest-flare quiz answer and fact', () => {
    expect(h.strongestFlare).toEqual({ time: '2024-10-03T12:18Z', classType: 'X9.0' });
    expect(correctText('rad-09')).toContain('X9.0 in October 2024');
  });

  it('backs the May 2024 and solar-maximum questions', () => {
    expect(xFlaresInMonth(donki, '2024-05')).toBe(21);
    expect(correctText('sci-09')).toBe('About 20');
    expect(DID_YOU_KNOW.some((f) => f.text.includes('21 X-class'))).toBe(true);
    expect(h.byYear['2024'].x).toBeGreaterThan(h.byYear['2025'].x * 2);
    expect(correctText('sci-10')).toBe('2024');
  });

  it('counts the whole catalogue', () => {
    expect(h.flares).toBe(donki.flares.length);
    expect(h.xFlares).toBeGreaterThan(50);
    expect(h.fastestCme.speedKmS).toBeGreaterThan(3000);
    expect(donkiHighlights({})).toMatchObject({ flares: 0, strongestFlare: null, fastestCme: null });
  });

  it('every Data Lab question is checked here', () => {
    const checked = ['sci-08', 'weather-07', 'weather-08', 'rad-09', 'sci-09', 'sci-10'];
    expect(QUIZ.filter((q) => q.dataLab).map((q) => q.id).sort()).toEqual([...checked].sort());
  });
});

describe('Radiation dose comparisons', () => {
  it('is an ascending ladder that matches the RAD measurements', () => {
    expect(DOSE_LADDER.map((d) => d.msv)).toEqual([...DOSE_LADDER.map((d) => d.msv)].sort((a, b) => a - b));
    const by = Object.fromEntries(DOSE_LADDER.map((d) => [d.id, d.msv]));
    expect(by['mars-transit']).toBeCloseTo(by['cruise-day'] * 180, -1);
    expect(by['mars-500']).toBeCloseTo(by['mars-sol'] * 500, -1);
    expect(imageExists(DOSE_CHART.file)).toBe(true);
  });

  it('puts a dose in everyday terms', () => {
    const sol = compareDose(0.64);
    expect(sol).toMatchObject({ chestXrays: 6, careerPct: 0 });
    expect(sol.below.id).toBe('mars-sol');
    expect(sol.above.id).toBe('moon-day');
    expect(compareDose(1000).above).toBeNull();
    expect(compareDose(-5)).toMatchObject({ msv: 0, below: null });
    expect(compareDose(300).careerPct).toBe(50);
  });
});

describe('Exploration timeline', () => {
  it('is in date order with valid dates', () => {
    const dates = TIMELINE.map((t) => t.date);
    expect(dates).toEqual([...dates].sort());
    for (const t of TIMELINE) expect(Number.isNaN(Date.parse(t.date)), t.title).toBe(false);
  });

  it('uses bundled NASA images that were really downloaded', () => {
    const files = new Set(milestones.items.map((i) => i.file));
    for (const t of TIMELINE.filter((x) => x.image)) {
      expect(imageExists(t.image), t.image).toBe(true);
      expect(files.has(t.image), t.image).toBe(true);
    }
    expect(TIMELINE.filter((t) => t.image).length).toBeGreaterThanOrEqual(8);
  });
});
