// Profile helpers for the learning screens. The learning engine owns the profile shape; these readers
// accept every shape we have seen (arrays of ids, id->value maps, nested {viewed}/{known} records)
// and the fallbacks write a minimal, immutable record when the engine is not available yet.
import { getState, setProfile } from '../../../state/store.js';
import { call, ACHIEVEMENTS } from '../../../state/learn.js';
import { badgeToast } from '../../components/common.js';

export const currentProfile = () => getState().profile ?? {};

function entryIn(collection, id) {
  if (!collection) return undefined;
  if (collection instanceof Set) return collection.has(id) || undefined;
  if (Array.isArray(collection)) {
    return collection.find((x) => x === id || x?.id === id);
  }
  if (typeof collection === 'object') return collection[id];
  return undefined;
}

const truthyRecord = (value, flag) => {
  if (value == null || value === false || value === 0) return false;
  if (typeof value === 'object' && flag in value) return Boolean(value[flag]);
  return true;
};

export function isViewed(profile, id) {
  const p = profile ?? {};
  return [p.viewedTerms, p.termsViewed, p.viewed, p.terms]
    .some((c) => truthyRecord(entryIn(c, id), 'viewed'));
}

export function isKnown(profile, id) {
  const p = profile ?? {};
  const rec = entryIn(p.flashcardsKnown, id) ?? entryIn(p.flashcards, id) ?? entryIn(p.knownTerms, id);
  if (rec === 'known') return true;
  if (rec && typeof rec === 'object') return 'known' in rec ? Boolean(rec.known) : rec.box > 0;
  return rec === true;
}

function toDate(value) {
  const raw = typeof value === 'object' && value
    ? value.at ?? value.date ?? value.earnedAt ?? value.earned ?? value.time
    : value;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
}

// Returns null when not earned, otherwise { date: Date|null }.
export function earnedInfo(profile, badgeId) {
  const p = profile ?? {};
  for (const c of [p.badges, p.achievements, p.earned, p.earnedBadges]) {
    const rec = entryIn(c, badgeId);
    if (rec == null || rec === false) continue;
    if (typeof rec === 'object' && 'earned' in rec && !rec.earned) continue;
    return { date: toDate(rec) };
  }
  return null;
}

// Engine functions may return a profile or { profile, ... }; both are handled.
function unwrapProfile(result, fallback) {
  if (result && typeof result === 'object' && result.profile && typeof result.profile === 'object') return result.profile;
  if (result && typeof result === 'object' && !Array.isArray(result)) return result;
  return fallback;
}

function commit(next) {
  if (next && next !== getState().profile) setProfile(next);
  return next;
}

const stamp = () => new Date().toISOString();

function fallbackViewed(p, id) {
  const terms = p.terms && !Array.isArray(p.terms) ? p.terms : {};
  const prev = typeof terms[id] === 'object' && terms[id] ? terms[id] : {};
  return { ...p, terms: { ...terms, [id]: { ...prev, viewed: true, at: prev.at ?? stamp() } } };
}

function fallbackFlashcard(p, id, known) {
  const cards = p.flashcards && !Array.isArray(p.flashcards) ? p.flashcards : {};
  const prev = typeof cards[id] === 'object' && cards[id] ? cards[id] : {};
  const seen = (prev.seen ?? 0) + 1;
  return { ...p, flashcards: { ...cards, [id]: { ...prev, known, seen, at: stamp() } } };
}

export function markViewed(id) {
  const profile = currentProfile();
  if (isViewed(profile, id)) return profile;
  const result = call('markTermViewed', [profile, id], () => fallbackViewed(profile, id));
  commit(unwrapProfile(result, profile));
  awardNewBadges();
  return currentProfile();
}

export function markFlashcard(id, known) {
  const profile = currentProfile();
  const result = call('markFlashcard', [profile, id, known], () => fallbackFlashcard(profile, id, known));
  commit(unwrapProfile(result, profile));
  if (known) awardNewBadges();
  return currentProfile();
}

// Records a quiz answer in the fallback shape used when the engine (or the question) is local.
export function recordLocalAnswer(profile, q, choice) {
  const correct = choice === q.answer;
  const quiz = profile.quiz && !Array.isArray(profile.quiz) ? profile.quiz : {};
  const prev = quiz[q.id] ?? {};
  const entry = {
    ...prev,
    term: q.term,
    category: q.category,
    attempts: (prev.attempts ?? 0) + 1,
    correct: (prev.correct ?? 0) + (correct ? 1 : 0),
    last: correct,
  };
  return { correct, explain: q.explain, profile: { ...profile, quiz: { ...quiz, [q.id]: entry } } };
}

export function saveProfile(next) {
  return commit(next);
}

const badgeById = (b) => (b && typeof b === 'object' ? b : ACHIEVEMENTS.find((a) => a.id === b) ?? null);

// Runs the engine's badge checks on the latest profile and toasts anything newly earned.
export function awardNewBadges(extra = {}) {
  const profile = currentProfile();
  const ctx = { mission: null, debrief: null, profile, progress: getState().progress, ...extra };
  const result = call('evaluateAchievements', [profile, ctx], () => null);
  if (!result) return [];
  if (result.profile) commit(result.profile);
  const earned = (result.newlyEarned ?? []).map(badgeById).filter(Boolean);
  earned.forEach((b) => badgeToast(b));
  return earned;
}
