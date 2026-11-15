// Background music manager: two <audio> elements crossfade between looping tracks.
// Nothing loads until a track is first needed, and nothing plays until the player has
// interacted with the page (browsers block autoplay). Rejected play() calls are ignored.
import { TRACKS, effectiveVolume } from './tracks.js';

const FADE_MS = 1500;
const QUICK_MS = 250;
const base = (import.meta.env?.BASE_URL ?? './').replace(/\/?$/, '/');

const decks = [];          // up to two HTMLAudioElements, created on first use
let current = null;        // deck that is (or is becoming) audible
let wanted = null;         // track id the game wants right now
let volume = 0.35;
let muted = false;
let duck = 1;
let unlocked = false;      // set after the first click / key press
let hidden = false;        // tab hidden

const level = () => effectiveVolume({ volume, muted, duck });
const audible = () => unlocked && !hidden && !muted && wanted;

function makeDeck() {
  const el = new Audio();
  el.preload = 'none';
  el.loop = true;
  el.volume = 0;
  el.dataset.track = '';
  el.addEventListener('error', () => {}, { passive: true }); // missing file: stay silent
  decks.push(el);
  return el;
}

function safePlay(el) {
  try {
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* autoplay or decode refusal: ignore */ }
}

function fade(el, to, ms, after) {
  el._fadeToken = (el._fadeToken ?? 0) + 1;
  const token = el._fadeToken;
  const from = el.volume;
  const start = performance.now();
  const step = (now) => {
    if (token !== el._fadeToken) return;
    const t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
    el.volume = Math.min(1, Math.max(0, from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
    else after?.();
  };
  requestAnimationFrame(step);
}

function fadeOutAndPause(el, ms = FADE_MS) {
  fade(el, 0, ms, () => el.pause());
}

function deckFor(id) {
  const loaded = decks.find((d) => d.dataset.track === id);
  if (loaded) return loaded;
  const free = decks.find((d) => d !== current) ?? (decks.length < 2 ? makeDeck() : decks[0]);
  free.pause();
  free.dataset.track = id;
  free.src = `${base}audio/${TRACKS[id].file}`;
  return free;
}

// Bring the audio in line with `wanted` and the current volume, mute, duck and visibility.
function sync(ms = FADE_MS) {
  if (!audible()) {
    if (current && !current.paused) fadeOutAndPause(current, hidden ? QUICK_MS : ms);
    return;
  }
  const next = current?.dataset.track === wanted ? current : deckFor(wanted);
  if (next !== current && current) fadeOutAndPause(current, ms);
  current = next;
  if (current.paused) safePlay(current);
  fade(current, level(), ms);
}

/** Crossfade to a track. Does nothing if that track is already the one playing. */
export function playTrack(id) {
  if (!TRACKS[id]) return;
  if (id === wanted && current?.dataset.track === id && (!current.paused || !audible())) return;
  wanted = id;
  sync();
}

/** Fade the music out and forget the current track. */
export function stop() {
  wanted = null;
  sync();
}

/** 0..1, applied with a short ramp. */
export function setVolume(v) {
  const next = Math.min(1, Math.max(0, Number(v) || 0));
  if (next === volume) return;
  volume = next;
  if (current && !current.paused) fade(current, level(), QUICK_MS);
}

export function setMuted(on) {
  if (Boolean(on) === muted) return;
  muted = Boolean(on);
  sync(muted ? QUICK_MS * 2 : FADE_MS);
}

/** Lower the music while something else talks (1 = full, 0.3 = read-aloud). */
export function setDuck(factor) {
  const next = Math.min(1, Math.max(0, Number(factor) || 0));
  if (next === duck) return;
  duck = next;
  if (current && !current.paused) fade(current, level(), 400);
}

/** Pause while the tab is hidden; resume from the same spot when it is visible again. */
export function setHidden(on) {
  if (Boolean(on) === hidden) return;
  hidden = Boolean(on);
  sync(hidden ? QUICK_MS : FADE_MS);
}

/** Call from the first user gesture. Starts whatever the current screen wants. */
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  sync();
}

/** Read-only snapshot for debugging and browser tests. */
export function musicState() {
  return {
    wanted, volume, muted, duck, unlocked, hidden,
    playing: current && !current.paused ? current.dataset.track : null,
    decks: decks.map((d) => ({ track: d.dataset.track, paused: d.paused, volume: Math.round(d.volume * 100) / 100, time: Math.round(d.currentTime * 10) / 10 })),
  };
}
