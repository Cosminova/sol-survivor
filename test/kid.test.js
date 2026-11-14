// Plain-language layer for Cadet view: wording helpers only (no game state).
import { describe, it, expect } from 'vitest';
import { KID_HINTS, KID_TASKS, lastsText, lastsLevel, worstLevel, plainify, lossMessage, niceDate, speakable, skyWord, delayWords } from '../src/ui/kid/words.js';
import { termById } from '../src/data/glossary.js';
import { TASKS } from '../src/engine/sim.js';
import { DEFAULT_SETTINGS } from '../src/state/store.js';

describe('kid words', () => {
  it('Cadet view is the default', () => {
    expect(DEFAULT_SETTINGS.expertView).toBe(false);
  });

  it('every plain hint belongs to a real glossary term and has no unit symbols a reader would trip on', () => {
    for (const [id, hint] of Object.entries(KID_HINTS)) {
      expect(termById(id), id).toBeTruthy();
      expect(hint.length, id).toBeLessThan(190);
      expect(hint, id).not.toMatch(/[°τ≈×]/);
    }
  });

  it('explains the jargon the challenge calls out', () => {
    for (const id of ['sol', 'solar-longitude', 'tau', 'atmospheric-pressure', 'sievert', 'kwh', 'capcom', 'eva', 'regolith', 'light-delay']) {
      expect(KID_HINTS[id], id).toBeTruthy();
    }
  });

  it('has a plain label and a why line for every crew job in the engine', () => {
    for (const id of Object.keys(TASKS)) {
      expect(KID_TASKS[id]?.label, id).toBeTruthy();
      expect(KID_TASKS[id]?.why, id).toBeTruthy();
    }
  });

  it('describes how long a supply lasts with the advisor thresholds', () => {
    expect(lastsText(null, 10, 'moon')).toMatch(/after the first day/);
    expect(lastsText({ rate: 1, sols: Infinity }, 10, 'moon')).toMatch(/Growing/);
    expect(lastsText({ rate: -1, sols: 30 }, 10, 'moon')).toBe('Enough for the rest of the mission (30 days left).');
    expect(lastsText({ rate: -1, sols: 6 }, 10, 'mars')).toBe('Lasts 6 sols, but the mission has 10 to go.');
    expect(lastsText({ rate: -1, sols: 1 }, 10, 'moon')).toBe('Runs out in 1 day!');
    expect(lastsText({ rate: -1, sols: 0 }, 10, 'moon')).toMatch(/Empty/);
    expect(lastsLevel({ rate: -1, sols: 30 }, 10)).toBe('good');
    expect(lastsLevel({ rate: -1, sols: 6 }, 10)).toBe('watch');
    expect(lastsLevel({ rate: -1, sols: 3 }, 10)).toBe('danger');
    expect(worstLevel('good', 'watch', 'good')).toBe('watch');
    expect(worstLevel('good', 'danger', 'watch')).toBe('danger');
  });

  it('swaps jargon in advisor tips for plain words without changing the numbers', () => {
    expect(plainify('All systems nominal. Great work, Commander!')).toBe('Everything is working well. Great work, Commander!');
    expect(plainify('Dust storm: tau 3, 8 sols left. Solar power is way down.')).toBe('Dust storm: dust level 3, 8 sols left. Solar power is way down.');
    expect(plainify('At this rate, water lasts 6 more sols, but the mission has 9 to go.', 'moon')).toBe('At this rate, water lasts 6 more days, but the mission has 9 to go.');
    expect(plainify('Fewer EVAs and more shielding!')).toBe('Fewer trips outside and more shielding!');
  });

  it('gives a kind, specific next step for every way a mission can end early', () => {
    expect(lossMessage({ lostReason: 'oxygen', modules: {} })).toBe('Your crew ran low on air. Try packing an oxygen generator next time.');
    expect(lossMessage({ lostReason: 'oxygen', modules: { oxygen: 1 } })).toMatch(/one more oxygen generator/);
    for (const reason of ['water', 'food', 'cold', 'health', undefined]) {
      const msg = lossMessage({ lostReason: reason, modules: {} });
      expect(msg).toMatch(/next time|Next time/);
      expect(msg).not.toMatch(/abort|fail|died|dead/i);
    }
  });

  it('formats dates and sky words', () => {
    expect(niceDate('2024-05-10T16:00Z')).toBe('10 May 2024');
    expect(niceDate('2019-03-12')).toBe('12 Mar 2019');
    expect(skyWord({ tau: 0.6 })).toBe('Clear sky');
    expect(skyWord({ tau: 4, storm: { solsLeft: 3 } })).toBe('Dust storm');
    expect(delayWords(1.3)).toBe('1.3 seconds');
    expect(delayWords(900)).toBe('15 minutes');
  });

  it('turns unit symbols into words for read-aloud', () => {
    expect(speakable('Temperatures drop below −130 °C.')).toBe('Temperatures drop below minus 130 degrees Celsius.');
    expect(speakable('NASA sets it at 600 mSv.')).toBe('NASA sets it at 600 millisieverts.');
    expect(speakable('Dust storm season is roughly Ls 180°–330°.')).toBe('Dust storm season is roughly L S 180 degrees to 330 degrees.');
    expect(speakable('REMS measures 700–900 Pa and uses 1.5 kW, or 30 kWh.')).toBe('REMS measures 700 to 900 pascals and uses 1.5 kilowatts, or 30 kilowatt hours.');
  });
});
