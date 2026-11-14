// Learning layer: learner profile, quiz, flashcards, word of the sol and badges.
// Every function is pure and returns a new profile; inputs are never mutated. Profiles loaded from storage
// (or from older versions) are repaired by normalizeProfile, which every function applies automatically.
import { QUIZ, questionById } from '../data/quiz.js';
import { GLOSSARY, CATEGORIES, termById } from '../data/glossary.js';
import { ACHIEVEMENTS, achievementById } from '../data/achievements.js';
import { eventById } from '../data/eventCards.js';
import { CAMPAIGN } from '../data/missions.js';
import { marsTime } from './marsTime.js';
import { createRng, hashSeed } from './rng.js';
import { scoreMission } from './scoring.js';
import { masteryByCategory } from './mastery.js';

export { masteryByCategory };

export const PROFILE_VERSION = 1;
// Quiz rounds shorter than this do not count toward best scores (so one lucky answer is not a "perfect round").
export const MIN_RECORDED_ROUND = 5;

const whole = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;
const uniqueStrings = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : []);
const addUnique = (list, id) => (list.includes(id) ? list : [...list, id]);
const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export function createProfile(name = '') {
  return {
    version: PROFILE_VERSION,
    completed: {},
    badges: [],
    quiz: { answered: 0, correct: 0, best: {}, missed: [] },
    termsViewed: [],
    flashcardsKnown: [],
    eventsSeen: [],
    name,
  };
}

function cleanCompleted(raw) {
  if (!isPlainObject(raw)) return {};
  return Object.fromEntries(Object.entries(raw)
    .filter(([, e]) => isPlainObject(e) && Number.isFinite(e.stars))
    .map(([id, e]) => [id, {
      stars: Math.min(3, whole(e.stars)),
      points: whole(e.points),
      sols: whole(e.sols),
      date: typeof e.date === 'string' ? e.date : '',
      ...(e.body === 'moon' || e.body === 'mars' ? { body: e.body } : {}),
    }]));
}

function cleanBest(raw) {
  if (!isPlainObject(raw)) return {};
  return Object.fromEntries(Object.entries(raw)
    .filter(([k, v]) => (k === 'all' || CATEGORIES[k]) && Number.isFinite(v))
    .map(([k, v]) => [k, Math.min(1, Math.max(0, v))]));
}

export function normalizeProfile(raw) {
  if (!isPlainObject(raw)) return createProfile();
  const quiz = isPlainObject(raw.quiz) ? raw.quiz : {};
  const answered = whole(quiz.answered);
  return {
    version: PROFILE_VERSION,
    completed: cleanCompleted(raw.completed),
    badges: uniqueStrings(raw.badges).filter((id) => achievementById(id)),
    quiz: {
      answered,
      correct: Math.min(answered, whole(quiz.correct)),
      best: cleanBest(quiz.best),
      missed: uniqueStrings(quiz.missed).filter((id) => questionById(id)),
    },
    termsViewed: uniqueStrings(raw.termsViewed).filter((id) => termById(id)),
    flashcardsKnown: uniqueStrings(raw.flashcardsKnown).filter((id) => termById(id)),
    eventsSeen: uniqueStrings(raw.eventsSeen).filter((id) => eventById(id)),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : '',
  };
}

const isProfile = (p) => isPlainObject(p) && p.version === PROFILE_VERSION && isPlainObject(p.completed)
  && Array.isArray(p.badges) && isPlainObject(p.quiz) && Array.isArray(p.quiz.missed) && isPlainObject(p.quiz.best)
  && Array.isArray(p.termsViewed) && Array.isArray(p.flashcardsKnown) && Array.isArray(p.eventsSeen);

const ensure = (p) => (isProfile(p) ? p : normalizeProfile(p));

// ---------- Quiz ----------

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// difficulty is a ceiling: 1 = Cadet questions only, 3 = everything. With missionId, that chapter's questions
// come first, topped up from the same categories. Previously missed questions are always picked first.
export function pickQuiz({ seed = 'quiz', category = 'all', count = 10, missionId, difficulty, profile } = {}) {
  const rng = createRng(seed);
  const missed = new Set(profile?.quiz?.missed ?? []);
  const pool = QUIZ.filter((q) => (category === 'all' || q.category === category) && (!difficulty || q.difficulty <= difficulty));
  const primary = missionId ? pool.filter((q) => q.missionId === missionId) : pool;
  const categories = new Set(primary.map((q) => q.category));
  const secondary = missionId ? pool.filter((q) => q.missionId !== missionId && categories.has(q.category)) : [];
  const tier = (list) => [
    ...shuffle(list.filter((q) => missed.has(q.id)), rng),
    ...shuffle(list.filter((q) => !missed.has(q.id)), rng),
  ];
  return shuffle([...tier(primary), ...tier(secondary)].slice(0, Math.max(0, count)), rng);
}

export function gradeAnswer(profile, questionId, choiceIndex) {
  const question = questionById(questionId);
  if (!question) throw new Error(`Unknown quiz question: ${questionId}`);
  const p = ensure(profile);
  const correct = choiceIndex === question.answer;
  const missed = correct ? p.quiz.missed.filter((id) => id !== questionId) : addUnique(p.quiz.missed, questionId);
  return {
    correct,
    answer: question.answer,
    explain: question.explain,
    term: question.term,
    profile: { ...p, quiz: { ...p.quiz, answered: p.quiz.answered + 1, correct: p.quiz.correct + (correct ? 1 : 0), missed } },
  };
}

export function recordQuizRound(profile, { category = 'all', correct = 0, total = 0 } = {}) {
  const p = ensure(profile);
  if (total < MIN_RECORDED_ROUND || (category !== 'all' && !CATEGORIES[category])) return p;
  const score = round2(Math.min(1, Math.max(0, correct / total)));
  if ((p.quiz.best[category] ?? 0) >= score) return p;
  return { ...p, quiz: { ...p.quiz, best: { ...p.quiz.best, [category]: score } } };
}

// ---------- Dictionary & flashcards ----------

export function wordOfTheSol(date = new Date()) {
  const sol = Math.floor(marsTime(date).msd);
  return GLOSSARY[hashSeed(`word-of-the-sol-${sol}`) % GLOSSARY.length];
}

export function flashcardDeck(profile, category = 'all') {
  const known = new Set(ensure(profile).flashcardsKnown);
  const terms = GLOSSARY.filter((t) => category === 'all' || t.category === category);
  return [...terms.filter((t) => !known.has(t.id)), ...terms.filter((t) => known.has(t.id))]
    .map((t) => ({ ...t, known: known.has(t.id) }));
}

export function markTermViewed(profile, id) {
  const p = ensure(profile);
  if (!termById(id) || p.termsViewed.includes(id)) return p;
  return { ...p, termsViewed: [...p.termsViewed, id] };
}

export function markFlashcard(profile, id, known) {
  const p = ensure(profile);
  if (!termById(id) || p.flashcardsKnown.includes(id) === Boolean(known)) return p;
  const flashcardsKnown = known ? [...p.flashcardsKnown, id] : p.flashcardsKnown.filter((x) => x !== id);
  return { ...p, flashcardsKnown };
}

// ---------- Missions, events & badges ----------

export function recordEventSeen(profile, eventId) {
  const p = ensure(profile);
  if (!eventById(eventId) || p.eventsSeen.includes(eventId)) return p;
  return { ...p, eventsSeen: [...p.eventsSeen, eventId] };
}

// Keeps the best result per mission (more stars, then more points). Lost missions still count events seen.
export function recordMission(profile, mission, debrief = null, now = new Date()) {
  const seen = Object.keys(mission?.flags ?? {}).reduce((p, id) => recordEventSeen(p, id), ensure(profile));
  if (mission?.status !== 'won') return seen;
  const score = debrief?.score ?? scoreMission(mission);
  const id = mission.config.id;
  const entry = { stars: score.stars, points: score.points, sols: mission.sol, date: now.toISOString().slice(0, 10), body: mission.config.body };
  const prev = seen.completed[id];
  const better = !prev || entry.stars > prev.stars || (entry.stars === prev.stars && entry.points > prev.points);
  return better ? { ...seen, completed: { ...seen.completed, [id]: entry } } : seen;
}

export function evaluateAchievements(profile, ctx = {}) {
  const p = ensure(profile);
  const full = { mission: ctx.mission ?? null, debrief: ctx.debrief ?? null, profile: p };
  const newlyEarned = ACHIEVEMENTS.filter((a) => !p.badges.includes(a.id) && a.check(full));
  if (!newlyEarned.length) return { profile: p, newlyEarned };
  return { profile: { ...p, badges: [...p.badges, ...newlyEarned.map((a) => a.id)] }, newlyEarned };
}

// One-call summary for a progress screen or a teacher's class report.
export function learningSummary(profile) {
  const p = ensure(profile);
  const chapters = CAMPAIGN.filter((c) => p.completed[c.id]);
  return {
    name: p.name,
    quizAnswered: p.quiz.answered,
    quizAccuracy: p.quiz.answered ? round2(p.quiz.correct / p.quiz.answered) : 0,
    termsViewed: p.termsViewed.length,
    totalTerms: GLOSSARY.length,
    flashcardsKnown: p.flashcardsKnown.length,
    badges: p.badges.length,
    totalBadges: ACHIEVEMENTS.length,
    chaptersCompleted: chapters.length,
    totalChapters: CAMPAIGN.length,
    stars: chapters.reduce((s, c) => s + p.completed[c.id].stars, 0),
    eventsSeen: p.eventsSeen.length,
    mastery: masteryByCategory(p),
  };
}
