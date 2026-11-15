// App state: one immutable object, replaced on every update and persisted to localStorage.
import { createProfile, normalizeProfile } from './learn.js';

const KEY = 'sol-survivor:v1';

export const DEFAULT_SETTINGS = Object.freeze({
  sound: false,
  readAloud: false,
  reducedMotion: false,
  textSize: 'normal', // normal | large | xl
  highContrast: false,
  unlockAll: false,
  expertView: false, // false = Cadet view (simple, ages 7-12); true = every number and chart
  musicOn: true,
  musicVolume: 0.35, // 0..1
});

function safeParse(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function load() {
  const saved = typeof localStorage !== 'undefined' ? safeParse(localStorage.getItem(KEY)) : null;
  const profile = saved?.profile && typeof saved.profile === 'object' ? normalizeProfile(saved.profile) : createProfile();
  return {
    profile,
    savedMission: saved?.savedMission ?? null,
    lastResult: saved?.lastResult ?? null,
    progress: saved?.progress ?? {},
    patch: saved?.patch ?? null,
    world3d: saved?.world3d ?? null,
    settings: { ...DEFAULT_SETTINGS, ...(saved?.settings ?? {}) },
    newBadges: [],
  };
}

let state = load();
const listeners = new Set();

function persist(next) {
  try {
    const { profile, savedMission, lastResult, progress, patch, settings, world3d } = next;
    localStorage.setItem(KEY, JSON.stringify({ profile, savedMission, lastResult, progress, patch, settings, world3d }));
  } catch (err) {
    console.warn('[store] could not save progress', err);
  }
}

export const getState = () => state;

export function update(fn) {
  const next = fn(state);
  if (next === state) return state;
  state = next;
  persist(state);
  listeners.forEach((l) => l(state));
  return state;
}

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const setMission = (mission) => update((st) => ({ ...st, savedMission: mission }));
export const setProfile = (profile) => update((st) => (profile && profile !== st.profile ? { ...st, profile } : st));
export const setSettings = (patch) => update((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
export const setPatch = (patch) => update((st) => ({ ...st, patch }));

export const setLastResult = (lastResult) => update((st) => ({ ...st, lastResult }));
export const clearNewBadges = () => update((st) => (st.newBadges.length ? { ...st, newBadges: [] } : st));

export function recordProgress(missionId, result) {
  return update((st) => {
    const prev = st.progress[missionId] ?? { stars: 0, points: 0, plays: 0 };
    const entry = {
      stars: Math.max(prev.stars, result.stars),
      points: Math.max(prev.points, result.points),
      plays: prev.plays + 1,
      won: prev.won || result.won,
    };
    return { ...st, progress: { ...st.progress, [missionId]: entry } };
  });
}

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  state = load();
  listeners.forEach((l) => l(state));
}
