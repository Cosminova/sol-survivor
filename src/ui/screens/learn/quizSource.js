// Where Academy questions come from: the engine's pickQuiz, else the QUIZ bank, else questions built
// from the glossary (definition -> pick the word) so the Academy always has something to play.
import { GLOSSARY, CATEGORIES } from '../../../data/glossary.js';
import { QUIZ, call, learning } from '../../../state/learn.js';
import { recordLocalAnswer } from './profile.js';

export const DIFFICULTIES = [
  { id: 1, label: 'Cadet', icon: '🟢' },
  { id: 2, label: 'Specialist', icon: '🟡' },
  { id: 3, label: 'Commander', icon: '🔴' },
];

function rng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Hides the answer inside its own definition ("A sol is…" -> "A ____ is…").
function maskTerm(def, term) {
  const names = [term.replace(/\s*\(.*\)\s*/, ''), ...(term.match(/\(([^)]+)\)/)?.slice(1) ?? [])]
    .flatMap((n) => n.split(/\s*&\s*/))
    .filter((n) => n.length > 2);
  return names.reduce((text, n) => text.replace(new RegExp(`\\b${escapeRe(n)}s?\\b`, 'gi'), '_____'), def);
}

function glossaryQuestion(term, rand, difficulty) {
  const sameCat = GLOSSARY.filter((t) => t.id !== term.id && t.category === term.category);
  const others = GLOSSARY.filter((t) => t.id !== term.id && t.category !== term.category);
  const pool = difficulty >= 3 ? [...shuffled(sameCat, rand), ...shuffled(others, rand)] : shuffled([...sameCat, ...others], rand);
  const distractors = pool.slice(0, 3);
  const choices = shuffled([term, ...distractors], rand);
  return {
    id: `gloss-${term.id}`,
    generated: true,
    question: `Which word matches this clue? “${maskTerm(term.def, term.term)}”`,
    choices: choices.map((c) => c.term),
    answer: choices.indexOf(term),
    explain: `${term.term}: ${term.def}`,
    term: term.id,
    category: term.category,
    difficulty: difficulty || 1,
  };
}

function fromGlossary({ seed, category, count, difficulty }) {
  const rand = rng(seed);
  const terms = GLOSSARY.filter((t) => !category || category === 'all' || t.category === category);
  return shuffled(terms, rand).slice(0, count).map((t) => glossaryQuestion(t, rand, difficulty));
}

// Difficulty is a ceiling (as in the engine): Cadet = level 1 only, Commander = everything.
export const withinDifficulty = (q, difficulty) => !difficulty || (q.difficulty ?? 1) <= difficulty;

function fromBank({ seed, category, count, difficulty, missionId }) {
  const rand = rng(seed);
  const matches = (q) => (!category || category === 'all' || q.category === category)
    && (!missionId || q.missionId === missionId);
  const pool = QUIZ.filter((q) => matches(q) && withinDifficulty(q, difficulty));
  return shuffled(pool, rand).slice(0, count);
}

const isQuestion = (q) => q && typeof q.question === 'string' && Array.isArray(q.choices) && Number.isInteger(q.answer);

export function pickQuestions({ category = 'all', difficulty = 0, count = 10, missionId, profile } = {}) {
  const seed = Date.now() % 2147483647;
  const opts = { seed, category, count, difficulty: difficulty || undefined, missionId, profile };
  const fromEngine = call('pickQuiz', [opts], () => null);
  const engineList = Array.isArray(fromEngine) ? fromEngine.filter(isQuestion) : [];
  if (engineList.length) return engineList;
  const bank = fromBank(opts);
  if (bank.length) return bank;
  return fromGlossary(opts);
}

export const usingGlossaryQuestions = () => !QUIZ.length && typeof learning.pickQuiz !== 'function';

// Categories that actually have questions, in glossary order.
export function quizCategories() {
  const source = QUIZ.length ? QUIZ : GLOSSARY;
  const used = new Set(source.map((q) => q.category));
  return Object.entries(CATEGORIES).filter(([id]) => used.has(id));
}

// Grades with the engine for bank questions; generated questions are graded locally.
export function grade(profile, q, choice) {
  if (q.generated) return recordLocalAnswer(profile, q, choice);
  const result = call('gradeAnswer', [profile, q.id, choice], () => null);
  if (result && typeof result.correct === 'boolean') {
    return { correct: result.correct, explain: result.explain ?? q.explain, profile: result.profile ?? profile };
  }
  return recordLocalAnswer(profile, q, choice);
}

export const starsFor = (score, total) => {
  const pct = total ? score / total : 0;
  if (pct >= 0.9) return 3;
  if (pct >= 0.7) return 2;
  return pct >= 0.4 ? 1 : 0;
};
