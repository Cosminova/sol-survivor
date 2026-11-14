// Adapter for the learning layer (quiz, badges, lessons, facts). Files that do not exist yet are simply
// absent from the glob, so every helper degrades to a safe fallback instead of crashing the UI.
const found = import.meta.glob([
  '../engine/learning.js',
  '../data/quiz.js',
  '../data/achievements.js',
  '../data/lessons.js',
  '../data/facts.js',
  '../data/timeline.js',
], { eager: true });

const pick = (path) => found[path] ?? {};

export const learning = pick('../engine/learning.js');
export const QUIZ = pick('../data/quiz.js').QUIZ ?? [];
export const ACHIEVEMENTS = pick('../data/achievements.js').ACHIEVEMENTS ?? [];
export const LESSONS = pick('../data/lessons.js').LESSONS ?? [];
export const NGSS_ALIGNMENT = pick('../data/lessons.js').NGSS_ALIGNMENT ?? null;
export const DID_YOU_KNOW = pick('../data/facts.js').DID_YOU_KNOW ?? [];
export const COMPARISON = pick('../data/facts.js').COMPARISON ?? null;
export const TIMELINE = pick('../data/timeline.js').TIMELINE ?? [];

export const hasLearning = typeof learning.createProfile === 'function';

const FALLBACK_FACTS = [
  { text: 'A day on Mars is called a sol. It lasts 24 hours, 39 minutes and 35 seconds.', source: 'mars-fact', term: 'sol' },
  { text: 'Mars’s air pressure is less than 1% of Earth’s, so astronauts always need a pressurized suit outside.', source: 'rems', term: 'atmospheric-pressure' },
  { text: 'The ISS recycles about 98% of its water, including sweat and urine.', source: 'eclss', term: 'eclss' },
  { text: 'Radio signals take between 3 and 22 minutes to travel from Earth to Mars.', source: 'jpl-elements', term: 'light-delay' },
  { text: 'Perseverance’s MOXIE made 122 grams of oxygen from the Martian air, enough for a small dog to breathe for 10 hours.', source: 'moxie', term: 'moxie' },
];

export const facts = () => (DID_YOU_KNOW.length ? DID_YOU_KNOW : FALLBACK_FACTS);

export function randomFact(seed = Math.random()) {
  const list = facts();
  return list[Math.floor(seed * list.length) % list.length];
}

// Calls learning[name](...args), returning fallback() if missing or if it throws.
export function call(name, args, fallback) {
  const fn = learning[name];
  if (typeof fn !== 'function') return fallback();
  try {
    return fn(...args);
  } catch (err) {
    console.warn(`[learning] ${name} failed`, err);
    return fallback();
  }
}

export const normalizeProfile = (raw) => call('normalizeProfile', [raw], () => raw);

export const createProfile = () => call('createProfile', [], () => ({ version: 0, quiz: {}, terms: {}, flashcards: {}, missions: [], events: [], badges: {} }));
