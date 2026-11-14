// Category mastery from a learner profile. Kept separate from learning.js so achievement checks can use it
// without an import cycle. Weights: flashcards known 40%, dictionary terms viewed 20%, best quiz round 40%.
import { CATEGORIES, GLOSSARY } from '../data/glossary.js';

const WEIGHTS = { known: 0.4, viewed: 0.2, quiz: 0.4 };
const round2 = (v) => Math.round(v * 100) / 100;

export function masteryByCategory(profile) {
  const known = new Set(profile?.flashcardsKnown ?? []);
  const viewed = new Set(profile?.termsViewed ?? []);
  const best = profile?.quiz?.best ?? {};
  return Object.fromEntries(Object.keys(CATEGORIES).map((cat) => {
    const terms = GLOSSARY.filter((t) => t.category === cat);
    const frac = (set) => (terms.length ? terms.filter((t) => set.has(t.id)).length / terms.length : 0);
    const quiz = Math.min(1, Math.max(0, Number(best[cat]) || 0));
    return [cat, round2(WEIGHTS.known * frac(known) + WEIGHTS.viewed * frac(viewed) + WEIGHTS.quiz * quiz)];
  }));
}
