// Decides what the music should be doing: picks the track for the current screen,
// follows the Music settings, waits for the first click, pauses in hidden tabs,
// and lowers the music while Read aloud is speaking.
import { getState, subscribe } from '../state/store.js';
import { trackFor } from './tracks.js';
import { playTrack, setVolume, setMuted, setDuck, setHidden, unlock, musicState } from './music.js';

const SPEECH_DUCK = 0.3;
const GESTURES = ['pointerdown', 'keydown', 'touchstart'];

let route = 'home';
let started = false;

function sync(state = getState()) {
  const { settings, savedMission } = state;
  setVolume(settings.musicVolume);
  setMuted(!settings.musicOn);
  playTrack(trackFor(route, savedMission));
}

/** Call once at boot. Returns a function to call on every route change. */
export function startMusic() {
  if (!started && typeof window !== 'undefined') {
    started = true;
    const onFirstGesture = () => {
      GESTURES.forEach((t) => window.removeEventListener(t, onFirstGesture, true));
      unlock();
    };
    GESTURES.forEach((t) => window.addEventListener(t, onFirstGesture, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => setHidden(document.hidden));
    document.addEventListener('sol:speech', (e) => setDuck(e.detail?.speaking ? SPEECH_DUCK : 1));
    subscribe(sync);
    if (import.meta.env?.DEV) window.__music = musicState; // dev-only hook for browser tests
    setHidden(document.hidden);
    sync();
  }
  return (routeName) => {
    route = routeName;
    sync();
  };
}
