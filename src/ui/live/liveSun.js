// "The real Sun right now" card. Owned by the live-data work; the game UI mounts it.
import { h } from '../dom.js';

/** @param {import('../../live/liveData.js').LiveNow} live @param {{ compact?: boolean }} [opts] @returns {HTMLElement} */
export function liveSunCard(live, opts = {}) {
  const sun = live?.sun;
  return h('section', { class: ['live-sun', opts.compact && 'compact'], 'aria-label': 'The real Sun right now' },
    h('strong', null, sun?.kidHeadline ?? 'Checking the Sun…'),
    h('p', null, sun?.kidLine ?? ''));
}
