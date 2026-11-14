// Mission Quiz. Every question links to a dictionary term, a dictionary category and (usually) a source.
// Shape: { id, question, choices, answer, explain, term, category, difficulty: 1|2|3, source?, missionId?, dataLab? }
import { hashSeed } from '../engine/rng.js';
import { SCIENCE_QUESTIONS } from './quizScience.js';
import { SURVIVAL_QUESTIONS } from './quizSurvival.js';

// Choices that form a number scale (A < C < M < X, 1 < 10 < 100...) stay in reading order.
const KEEP_ORDER = new Set([
  'rad-03', 'rad-04', 'rad-05', 'rad-07', 'sci-02', 'sci-09', 'planet-02', 'planet-07',
  'isru-03', 'life-10', 'weather-05', 'mission-03',
]);

// Authors tend to put the right answer second; rotate choices so the correct slot is spread evenly by id.
function balance(q) {
  if (KEEP_ORDER.has(q.id)) return q;
  const n = q.choices.length;
  const shift = (q.answer - (hashSeed(`slot-${q.id}`) % n) + n) % n;
  if (!shift) return q;
  return { ...q, choices: [...q.choices.slice(shift), ...q.choices.slice(0, shift)], answer: (q.answer - shift + n) % n };
}

export const QUIZ = [...SCIENCE_QUESTIONS, ...SURVIVAL_QUESTIONS].map(balance);

export const DIFFICULTY_LABELS = { 1: 'Cadet', 2: 'Specialist', 3: 'Commander' };

export const questionById = (id) => QUIZ.find((q) => q.id === id) ?? null;

export const questionsForMission = (missionId) => QUIZ.filter((q) => q.missionId === missionId);
