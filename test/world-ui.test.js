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
