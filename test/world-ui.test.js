// The UI layer for worlds beyond the Moon and Mars: kid-friendly event text and the loss message for heat.
import { describe, it, expect } from 'vitest';
import { WORLD_EVENT_CARDS } from '../src/data/eventCards.js';
import { KID_EVENTS, KID_EVENT_ICONS } from '../src/data/kidText.js';
import { lossMessage } from '../src/ui/kid/words.js';

describe('world event cards in Cadet view', () => {
  it.each(WORLD_EVENT_CARDS.map((c) => [c.id, c]))('%s has plain text, one choice line per choice, and an icon', (id, card) => {
    const kid = KID_EVENTS[id];
    expect(kid, id).toBeTruthy();
    expect(kid.choices).toHaveLength(card.choices === undefined ? 0 : card.choices.length);
    expect(KID_EVENT_ICONS[id], id).toBeTruthy();
  });
});

describe('loss messages', () => {
  it('explains a base that overheated', () => {
    expect(lossMessage({ lostReason: 'heat', modules: {} })).toMatch(/too hot/);
  });
});

import { walkCues } from '../src/ui/kid/walkCues.js';

describe('Walk 3D cues', () => {
  const base = { status: 'active', broken: {} };

  it('invites the player outside until they have been there today', () => {
    expect(walkCues(base, { visitedToday: false }).show).toBe(true);
    expect(walkCues(base, { visitedToday: true }).show).toBe(false);
  });

  it('keeps showing an urgent repair even after a visit, naming the machine', () => {
    const cues = walkCues({ ...base, broken: { recycler: 1 } }, { visitedToday: true });
    expect(cues.show).toBe(true);
    expect(cues.urgent[0]).toMatch(/broken.*hold E/);
  });

  it('stays quiet once the mission is over', () => {
    expect(walkCues({ ...base, status: 'won' }, { visitedToday: false }).show).toBe(false);
  });
});

import { skyWord } from '../src/ui/kid/words.js';

describe('sky words', () => {
  const clear = { storm: null, tau: 0.5 };
  it('says hazy on Titan, cloudy on Venus, and keeps Mars dust words', () => {
    expect(skyWord(clear, { config: { worldId: 'titan' } })).toBe('Hazy sky');
    expect(skyWord(clear, { config: { worldId: 'venus' } })).toBe('Thick clouds');
    expect(skyWord(clear, { config: { worldId: 'mars' } })).toBe('Clear sky');
    expect(skyWord({ storm: { solsLeft: 2 }, tau: 3 }, { config: { worldId: 'mars' } })).toBe('Dust storm');
  });
});
