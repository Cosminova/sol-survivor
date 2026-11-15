import { describe, it, expect } from 'vitest';
import { dayKey, dayWord, daysText, plainify } from '../src/ui/kid/words.js';

// "Sol" is a Mars-only word. Venus and Titan borrow the Mars code path (config.body === 'mars'),
// so the unit must follow the real world in config.worldId.
describe('day unit per world', () => {
  it('uses the real world id, falling back to body for older saves', () => {
    expect(dayKey({ body: 'mars', worldId: 'venus' })).toBe('venus');
    expect(dayKey({ body: 'mars' })).toBe('mars');
    expect(dayKey({ body: 'moon', worldId: 'moon' })).toBe('moon');
    expect(dayKey(undefined)).toBeUndefined();
  });

  it('says sol only on Mars', () => {
    expect(dayWord(dayKey({ body: 'mars', worldId: 'mars' }), { cap: true })).toBe('Sol');
    expect(dayWord(dayKey({ body: 'moon', worldId: 'moon' }), { cap: true })).toBe('Day');
    expect(dayWord(dayKey({ body: 'mars', worldId: 'venus' }), { cap: true })).toBe('Day');
    expect(dayWord(dayKey({ body: 'mars', worldId: 'titan' }), { plural: true })).toBe('days');
    expect(dayWord(dayKey({ body: 'moon', worldId: 'europa' }))).toBe('day');
    expect(dayWord('mars', { plural: true })).toBe('sols');
  });

  it('turns Mars-written engine text into days off Mars and leaves Mars text alone', () => {
    const text = 'Give everyone an extra rest sol. Lasts 6 sols. Sol 3 report.';
    expect(daysText(text, 'mars')).toBe(text);
    expect(daysText(text, 'moon')).toBe('Give everyone an extra rest day. Lasts 6 days. Day 3 report.');
    expect(daysText(text, 'titan')).toBe('Give everyone an extra rest day. Lasts 6 days. Day 3 report.');
    expect(daysText('every 6 crew-sols', 'venus')).toBe('every 6 crew-days');
  });

  it('does not touch words that only contain "sol"', () => {
    expect(daysText('solar panels and a solid console', 'moon')).toBe('solar panels and a solid console');
  });

  it('plainify follows the real world too', () => {
    expect(plainify('Runs out in 2 sols!', 'venus')).toBe('Runs out in 2 days!');
    expect(plainify('Runs out in 2 sols!', 'mars')).toBe('Runs out in 2 sols!');
  });
});
