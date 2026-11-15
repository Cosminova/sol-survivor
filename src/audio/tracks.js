// Background music: the six tracks, which screen plays which, and their credits.
// Pure data + functions so the mapping can be unit-tested without audio.

export const TRACKS = Object.freeze({
  'pale-blue': { file: 'pale-blue.mp3', title: 'Pale Blue', seconds: 85 },
  'near-earth': { file: 'near-earth.mp3', title: 'Near Earth', seconds: 62 },
  'deep-space': { file: 'deep-space.mp3', title: 'Deep Space', seconds: 62 },
  'alien-world': { file: 'alien-world.mp3', title: 'Alien World', seconds: 62 },
  'far-shore': { file: 'far-shore.mp3', title: 'Far Shore', seconds: 95 },
  'lantern-moss': { file: 'lantern-moss.mp3', title: 'Lantern Moss', seconds: 81 },
});

// Shown in Data Lab › Sources & methodology and in the README. Fill these in once confirmed.
export const MUSIC_CREDIT = Object.freeze({
  source: null,
  license: null,
  note: 'Provided to the Sol Survivor team. Source and license to be confirmed before publishing.',
});

// Event cards that switch the music to the storm track while they are open.
export const STORM_EVENTS = new Set([
  'sep_alert', 'dust_storm', 'global_storm',
  'sun_live_sep', 'sun_live_flare', 'sun_forecast', // live-data storm cards, if present
]);

const MENU_TRACK = 'pale-blue';
const ROUTE_TRACKS = { loadout: 'near-earth', debrief: 'lantern-moss' };
const BODY_TRACKS = { moon: 'deep-space', mars: 'alien-world' };

/** True while a solar-storm or dust-storm event card is waiting for the player's choice. */
export function stormCardOpen(mission) {
  return mission?.phase === 'event' && STORM_EVENTS.has(mission?.pendingEvent?.id);
}

/**
 * Which track belongs on this screen.
 * @param {string} routeName router screen name (home, campaign, loadout, play, debrief, ...)
 * @param {object|null} mission the saved mission (only read on the play screen)
 * @returns {keyof typeof TRACKS}
 */
export function trackFor(routeName, mission = null) {
  if (routeName === 'play') {
    if (stormCardOpen(mission)) return 'far-shore';
    return BODY_TRACKS[mission?.config?.body] ?? MENU_TRACK;
  }
  return ROUTE_TRACKS[routeName] ?? MENU_TRACK;
}

/** Volume an element should play at, 0..1. Ducking multiplies (0.3 while read-aloud speaks). */
export function effectiveVolume({ volume = 0, muted = false, duck = 1 } = {}) {
  if (muted) return 0;
  const v = Number.isFinite(volume) ? volume : 0;
  return Math.min(1, Math.max(0, v)) * Math.min(1, Math.max(0, duck));
}
