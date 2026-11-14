import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  createProfile, normalizeProfile, pickQuiz, gradeAnswer, recordQuizRound, wordOfTheSol, flashcardDeck,
  markTermViewed, markFlashcard, recordMission, recordEventSeen, evaluateAchievements, masteryByCategory,
  learningSummary, MIN_RECORDED_ROUND,
} from '../src/engine/learning.js';
import { QUIZ, questionById } from '../src/data/quiz.js';
import { GLOSSARY, CATEGORIES } from '../src/data/glossary.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { CAMPAIGN, missionById } from '../src/data/missions.js';
import { createMission, advance } from '../src/engine/sim.js';
import { debrief } from '../src/engine/scoring.js';
import { buildWeatherIndex } from '../src/engine/environment.js';
import { classifySepEvents } from '../src/engine/spaceWeather.js';

const rems = JSON.parse(fs.readFileSync(new URL('../public/data/rems.json', import.meta.url)));
const donki = JSON.parse(fs.readFileSync(new URL('../public/data/donki.json', import.meta.url)));
const ctx = { weatherIndex: buildWeatherIndex(rems), seps: classifySepEvents(donki) };

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); });
  return Object.freeze(o);
};

function playMission(id, { difficulty = 'cadet', code = 'LEARN' } = {}) {
  const config = missionById(id);
  let m = createMission({ config, loadout: config.recommended, difficulty, code }, ctx);
  while (m.status === 'active') m = advance(m, ctx);
  return m;
}

const moonWin = playMission('artemis-dawn');

describe('Learner profile', () => {
  it('matches the shared contract', () => {
    expect(createProfile()).toEqual({
      version: 1, completed: {}, badges: [], quiz: { answered: 0, correct: 0, best: {}, missed: [] },
      termsViewed: [], flashcardsKnown: [], eventsSeen: [], name: '',
    });
    expect(createProfile('Ada').name).toBe('Ada');
  });

  it('repairs corrupt or old saved profiles', () => {
    expect(normalizeProfile(null)).toEqual(createProfile());
    expect(normalizeProfile('junk')).toEqual(createProfile());
    const fixed = normalizeProfile({
      version: 0, badges: ['first-quiz', 'not-a-badge', 'first-quiz'], name: 42,
      quiz: { answered: 3, correct: 9, best: { planet: 1.5, bogus: 1 }, missed: ['time-01', 'nope'] },
      termsViewed: ['sol', 'fake-term', 7], flashcardsKnown: 'sol', eventsSeen: ['aurora', 'unknown'],
      completed: { 'artemis-dawn': { stars: 5, points: 900, sols: 14, date: '2026-11-14', body: 'moon' }, broken: 'x' },
    });
    expect(fixed.badges).toEqual(['first-quiz']);
    expect(fixed.quiz).toEqual({ answered: 3, correct: 3, best: { planet: 1 }, missed: ['time-01'] });
    expect(fixed.termsViewed).toEqual(['sol']);
    expect(fixed.flashcardsKnown).toEqual([]);
    expect(fixed.eventsSeen).toEqual(['aurora']);
    expect(fixed.completed).toEqual({ 'artemis-dawn': { stars: 3, points: 900, sols: 14, date: '2026-11-14', body: 'moon' } });
    expect(fixed.name).toBe('');
  });

  it('accepts the UI fallback profile shape anywhere', () => {
    const legacy = { version: 0, quiz: {}, terms: {}, flashcards: {}, missions: [], events: [], badges: {} };
    expect(markTermViewed(legacy, 'sol').termsViewed).toEqual(['sol']);
    expect(gradeAnswer(legacy, 'time-01', 0).profile.quiz.answered).toBe(1);
  });

  it('never mutates the profile it is given', () => {
    const p = deepFreeze(createProfile());
    const q = QUIZ[0];
    expect(() => {
      gradeAnswer(p, q.id, q.answer);
      recordQuizRound(p, { category: q.category, correct: 5, total: 5 });
      markTermViewed(p, 'sol');
      markFlashcard(p, 'sol', true);
      recordEventSeen(p, 'aurora');
      recordMission(p, moonWin, debrief(moonWin));
      evaluateAchievements(p, { mission: moonWin, debrief: debrief(moonWin) });
      flashcardDeck(p);
      learningSummary(p);
    }).not.toThrow();
    expect(p).toEqual(createProfile());
  });
});

describe('Quiz', () => {
  it('is seeded and repeatable', () => {
    const a = pickQuiz({ seed: 'CLASS-7B' }).map((q) => q.id);
    expect(pickQuiz({ seed: 'CLASS-7B' }).map((q) => q.id)).toEqual(a);
    expect(pickQuiz({ seed: 'CLASS-7C' }).map((q) => q.id)).not.toEqual(a);
    expect(new Set(a).size).toBe(10);
  });

  it('filters by category, difficulty ceiling and count', () => {
    const radiation = pickQuiz({ seed: 1, category: 'radiation', count: 5 });
    expect(radiation).toHaveLength(5);
    expect(radiation.every((q) => q.category === 'radiation')).toBe(true);
    expect(pickQuiz({ seed: 2, difficulty: 1, count: 50 }).every((q) => q.difficulty === 1)).toBe(true);
    expect(pickQuiz({ seed: 3, category: 'body', count: 100 }).length).toBe(QUIZ.filter((q) => q.category === 'body').length);
    expect(pickQuiz({ seed: 4, count: 0 })).toEqual([]);
  });

  it('puts the chapter’s own questions first, then tops up from related categories', () => {
    const tagged = QUIZ.filter((q) => q.missionId === 'long-night');
    const picked = pickQuiz({ seed: 5, missionId: 'long-night', count: tagged.length + 3 });
    expect(picked).toHaveLength(tagged.length + 3);
    expect(tagged.every((q) => picked.includes(q))).toBe(true);
    const cats = new Set(tagged.map((q) => q.category));
    expect(picked.every((q) => cats.has(q.category))).toBe(true);
  });

  it('prefers questions the learner missed before', () => {
    const missed = ['sci-02', 'life-06', 'isru-03'];
    const profile = { ...createProfile(), quiz: { ...createProfile().quiz, missed } };
    for (const seed of ['a', 'b', 'c']) {
      const ids = pickQuiz({ seed, count: 4, profile }).map((q) => q.id);
      expect(missed.every((id) => ids.includes(id))).toBe(true);
    }
  });

  it('grades answers, tracks misses and clears them when answered right', () => {
    const q = questionById('rad-03');
    const wrong = gradeAnswer(createProfile(), q.id, (q.answer + 1) % q.choices.length);
    expect(wrong.correct).toBe(false);
    expect(wrong.answer).toBe(q.answer);
    expect(wrong.explain).toBe(q.explain);
    expect(wrong.profile.quiz).toMatchObject({ answered: 1, correct: 0, missed: ['rad-03'] });
    const again = gradeAnswer(wrong.profile, q.id, (q.answer + 1) % q.choices.length);
    expect(again.profile.quiz.missed).toEqual(['rad-03']);
    const right = gradeAnswer(again.profile, q.id, q.answer);
    expect(right.correct).toBe(true);
    expect(right.profile.quiz).toMatchObject({ answered: 3, correct: 1, missed: [] });
    expect(() => gradeAnswer(createProfile(), 'no-such-question', 0)).toThrow(/Unknown quiz question/);
  });

  it('records best round scores but ignores short rounds and unknown categories', () => {
    const p = createProfile();
    expect(recordQuizRound(p, { category: 'planet', correct: 1, total: MIN_RECORDED_ROUND - 1 })).toBe(p);
    expect(recordQuizRound(p, { category: 'cheese', correct: 5, total: 5 })).toBe(p);
    const r1 = recordQuizRound(p, { category: 'planet', correct: 4, total: 5 });
    expect(r1.quiz.best.planet).toBe(0.8);
    expect(recordQuizRound(r1, { category: 'planet', correct: 3, total: 5 })).toBe(r1);
    expect(recordQuizRound(r1, { category: 'planet', correct: 10, total: 10 }).quiz.best.planet).toBe(1);
    expect(recordQuizRound(p, { correct: 6, total: 6 }).quiz.best.all).toBe(1);
  });
});

describe('Dictionary, flashcards and word of the sol', () => {
  it('gives the same word all sol and a different mix across sols', () => {
    const morning = wordOfTheSol(new Date('2026-11-14T08:00:00Z'));
    expect(GLOSSARY).toContain(morning);
    const sameSol = wordOfTheSol(new Date('2026-11-14T08:20:00Z'));
    expect(sameSol).toBe(morning);
    const words = new Set(Array.from({ length: 12 }, (_, i) => wordOfTheSol(new Date(Date.UTC(2026, 10, 1 + i, 12))).id));
    expect(words.size).toBeGreaterThan(6);
  });

  it('shows unknown flashcards first and toggles known cards', () => {
    const p = markFlashcard(createProfile(), 'sol', true);
    expect(markFlashcard(p, 'sol', true)).toBe(p);
    expect(markFlashcard(p, 'not-a-term', true)).toBe(p);
    const deck = flashcardDeck(p, 'time');
    expect(deck.every((t) => t.category === 'time')).toBe(true);
    expect(deck[deck.length - 1]).toMatchObject({ id: 'sol', known: true });
    expect(deck[0].known).toBe(false);
    expect(flashcardDeck(p)).toHaveLength(GLOSSARY.length);
    expect(markFlashcard(p, 'sol', false).flashcardsKnown).toEqual([]);
  });

  it('marks dictionary terms viewed once and ignores unknown ids', () => {
    const p = markTermViewed(createProfile(), 'tau');
    expect(p.termsViewed).toEqual(['tau']);
    expect(markTermViewed(p, 'tau')).toBe(p);
    expect(markTermViewed(p, 'imaginary')).toBe(p);
  });
});

describe('Missions, events and mastery', () => {
  it('records a won mission and keeps the best result', () => {
    const d = debrief(moonWin);
    const p = recordMission(createProfile(), moonWin, d, new Date('2026-11-14T10:00:00Z'));
    expect(p.completed['artemis-dawn']).toEqual({ stars: d.score.stars, points: d.score.points, sols: 14, date: '2026-11-14', body: 'moon' });
    expect(p.eventsSeen).toContain('earthrise');
    const worse = { ...moonWin, crew: moonWin.crew.map((c) => ({ ...c, health: 10 })) };
    expect(recordMission(p, worse).completed['artemis-dawn'].points).toBe(d.score.points);
  });

  it('counts events seen on lost missions without completing them', () => {
    const lost = { ...moonWin, status: 'lost', flags: { earthrise: true, 'script-3': true } };
    const p = recordMission(createProfile(), lost, null);
    expect(p.completed).toEqual({});
    expect(p.eventsSeen).toEqual(['earthrise']);
    expect(recordMission(p, null)).toEqual(p);
  });

  it('records each event once', () => {
    const p = recordEventSeen(recordEventSeen(createProfile(), 'aurora'), 'aurora');
    expect(p.eventsSeen).toEqual(['aurora']);
    expect(recordEventSeen(p, 'made-up')).toBe(p);
  });

  it('scores mastery from flashcards, dictionary views and quiz rounds', () => {
    const empty = masteryByCategory(createProfile());
    expect(Object.keys(empty).sort()).toEqual(Object.keys(CATEGORIES).sort());
    expect(Object.values(empty).every((v) => v === 0)).toBe(true);
    const timeTerms = GLOSSARY.filter((t) => t.category === 'time').map((t) => t.id);
    const p = { ...createProfile(), flashcardsKnown: timeTerms, termsViewed: timeTerms, quiz: { ...createProfile().quiz, best: { time: 1 } } };
    expect(masteryByCategory(p).time).toBe(1);
    expect(masteryByCategory(p).planet).toBe(0);
  });

  it('summarizes progress for a teacher report', () => {
    const p = recordMission(gradeAnswer(createProfile('Kai'), 'time-01', questionById('time-01').answer).profile, moonWin);
    const s = learningSummary(p);
    expect(s).toMatchObject({ name: 'Kai', quizAnswered: 1, quizAccuracy: 1, chaptersCompleted: 1, totalChapters: CAMPAIGN.length });
    expect(s.totalBadges).toBe(ACHIEVEMENTS.length);
  });
});

describe('Achievements', () => {
  it('every check is safe with no mission and a blank profile', () => {
    for (const a of ACHIEVEMENTS) {
      expect(() => a.check({ mission: null, debrief: null, profile: createProfile() }), a.id).not.toThrow();
      expect(() => a.check({ mission: null, debrief: null, profile: {} }), a.id).not.toThrow();
      expect(a.check({ mission: null, debrief: null, profile: createProfile() }), a.id).toBe(false);
    }
  });

  it('awards mission patches once', () => {
    const d = debrief(moonWin);
    const p = recordMission(createProfile(), moonWin, d);
    const first = evaluateAchievements(p, { mission: moonWin, debrief: d });
    const ids = first.newlyEarned.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-landing', 'moonwalker']));
    expect(ids).not.toContain('red-planeteer');
    expect(first.profile.badges).toEqual(ids);
    const second = evaluateAchievements(first.profile, { mission: moonWin, debrief: d });
    expect(second.newlyEarned).toEqual([]);
    expect(second.profile).toBe(first.profile);
  });

  it('awards learning and explorer badges from the profile alone', () => {
    const base = createProfile();
    const p = {
      ...base,
      quiz: { answered: 60, correct: 55, best: { radiation: 1 }, missed: [] },
      termsViewed: GLOSSARY.map((t) => t.id),
      flashcardsKnown: GLOSSARY.slice(0, 20).map((t) => t.id),
      eventsSeen: ['earthrise', 'blue_sunset', 'aurora', 'frost', 'phobos', 'dust_devil', 'meteorite', 'birthday', 'homesick', 'harvest'],
    };
    const ids = evaluateAchievements(p).newlyEarned.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-quiz', 'quiz-whiz', 'perfect-round', 'word-collector', 'walking-dictionary', 'flashcard-ace', 'science-reader', 'sky-watcher']));
    expect(ids).not.toContain('seen-it-all');
  });

  it('awards campaign, two-worlds and well-rounded badges', () => {
    const completed = Object.fromEntries(CAMPAIGN.map((c) => [c.id, { stars: 3, points: 800, sols: c.targetSols, date: '2026-11-14', body: c.body }]));
    const all = GLOSSARY.map((t) => t.id);
    const best = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 1]));
    const p = { ...createProfile(), completed, termsViewed: all, flashcardsKnown: all, quiz: { ...createProfile().quiz, best } };
    const ids = evaluateAchievements(p).newlyEarned.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['campaign-complete', 'two-worlds', 'three-stars', 'night-shift', 'long-hauler', 'well-rounded']));
  });

  it('rewards good mission play: shelter, harvest, ice and low dose', () => {
    const mars = playMission('green-thumb');
    expect(mars.status).toBe('won');
    const ids = evaluateAchievements(createProfile(), { mission: mars, debrief: debrief(mars) }).newlyEarned.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['red-planeteer', 'first-harvest', 'ice-miner']));
    const sunShield = ACHIEVEMENTS.find((a) => a.id === 'sun-shield');
    expect(sunShield.check({ mission: { ...mars, stats: { ...mars.stats, sepEvents: 2, sepSheltered: 2 } }, profile: createProfile() })).toBe(true);
    expect(sunShield.check({ mission: { ...mars, stats: { ...mars.stats, sepEvents: 2, sepSheltered: 1 } }, profile: createProfile() })).toBe(false);
    const shielded = { ...mars, crew: mars.crew.map((c) => ({ ...c, doseMsv: c.transitDoseMsv })) };
    expect(ACHIEVEMENTS.find((a) => a.id === 'dose-detective').check({ mission: shielded, profile: createProfile() })).toBe(true);
  });
});
