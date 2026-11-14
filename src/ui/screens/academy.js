// Astronaut Academy: mastery rings, quiz picker + runner, and the lesson list.
import '../../styles/learn.css';
import { h, mount, announce, prefersReducedMotion } from '../dom.js';
import { subscribe } from '../../state/store.js';
import { QUIZ, LESSONS, call } from '../../state/learn.js';
import { GLOSSARY } from '../../data/glossary.js';
import { missionById } from '../../data/missions.js';
import { didYouKnow } from '../components/common.js';
import { masteryRings } from './learn/mastery.js';
import { runQuiz } from './learn/quiz.js';
import { pickQuestions, quizCategories, usingGlossaryQuestions, withinDifficulty, DIFFICULTIES } from './learn/quizSource.js';
import { currentProfile, saveProfile, awardNewBadges } from './learn/profile.js';

const QUICK_COUNT = 5;
const MIXED_COUNT = 10;

function chip(label, pressed, onclick) {
  return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed), onclick }, label);
}

function availableCount({ category, difficulty }) {
  const source = QUIZ.length ? QUIZ : GLOSSARY;
  return source.filter((q) => (category === 'all' || q.category === category)
    && (!QUIZ.length || withinDifficulty(q, difficulty))).length;
}

// Records the round (best score per category) and then awards any newly earned badges.
function finishRound(category, summary) {
  const before = currentProfile();
  const round = { category, correct: summary.score, total: summary.total };
  const recorded = call('recordQuizRound', [before, round], () => before);
  saveProfile(recorded && typeof recorded === 'object' ? recorded : before);
  awardNewBadges({ quiz: summary });
}

function ringsPanel() {
  const { avg, el } = masteryRings(currentProfile());
  return h('section', { class: 'panel acad-mastery', 'aria-labelledby': 'acad-mastery-title' },
    h('div', { class: 'row between' },
      h('h2', { id: 'acad-mastery-title', class: 'panel-title' }, 'Mission readiness by topic'),
      h('span', { class: 'acad-avg' }, h('strong', { class: 'mono' }, `${avg}%`), ' overall')),
    el,
    h('p', { class: 'faint acad-mastery-note' }, 'Rings fill as you answer questions, study flashcards and open words in the Dictionary.'));
}

function lessonCard(lesson) {
  const mission = lesson.missionId ? missionById(lesson.missionId) : null;
  return h('li', { class: 'card acad-lesson' },
    h('div', { class: 'row' },
      lesson.gradeBand ? h('span', { class: 'badge moon' }, `Grades ${String(lesson.gradeBand).replace(/^grades?\s*/i, '')}`) : null,
      lesson.minutes ? h('span', { class: 'badge' }, `⏱ ${lesson.minutes} min`) : null),
    h('h3', null, lesson.title),
    lesson.objectives?.[0] ? h('p', { class: 'muted' }, lesson.objectives[0]) : null,
    h('div', { class: 'row' },
      h('a', { class: 'btn btn-sm btn-cyan', href: `#/educators?lesson=${encodeURIComponent(lesson.id)}` }, '🍎 Lesson plan'),
      mission ? h('a', { class: 'btn btn-sm', href: `#/loadout/${encodeURIComponent(mission.id)}` }, `🚀 Play ch. ${mission.chapter}: ${mission.title}`) : null));
}

function lessonsPanel() {
  return h('section', { class: 'panel', 'aria-labelledby': 'acad-lessons-title' },
    h('h2', { id: 'acad-lessons-title', class: 'panel-title mars' }, 'Classroom lessons'),
    LESSONS.length
      ? h('ul', { class: 'grid acad-lessons', role: 'list' }, LESSONS.map(lessonCard))
      : h('div', { class: 'empty' },
        h('span', { class: 'big', 'aria-hidden': 'true' }, '🍎'),
        h('p', null, 'Lesson plans are on their way from Mission Control.'),
        h('a', { class: 'btn btn-sm', href: '#/educators' }, 'Open the educator guide')));
}

function pickerPanel(state, { onChange, onStart }) {
  const cats = quizCategories();
  const count = availableCount(state);
  const glossaryMode = usingGlossaryQuestions();
  return h('section', { class: 'panel acad-picker', 'aria-labelledby': 'acad-picker-title' },
    h('h2', { id: 'acad-picker-title', class: 'panel-title' }, 'Choose your training'),
    glossaryMode ? h('p', { class: 'muted' }, '🛰️ The full question bank is warming up, so today’s questions come from the Astronaut Dictionary.') : null,
    h('div', { class: 'acad-filter', role: 'group', 'aria-label': 'Topic' },
      h('span', { class: 'field-label' }, 'Topic'),
      h('div', { class: 'row' },
        chip('✨ All topics', state.category === 'all', () => onChange({ category: 'all' })),
        cats.map(([id, c]) => chip(`${c.icon} ${c.label}`, state.category === id, () => onChange({ category: id }))))),
    h('div', { class: 'acad-filter', role: 'group', 'aria-label': 'Difficulty' },
      h('span', { class: 'field-label' }, 'Difficulty'),
      h('div', { class: 'row' },
        chip('Any', !state.difficulty, () => onChange({ difficulty: 0 })),
        DIFFICULTIES.map((d) => chip(`${d.icon} ${d.label}`, state.difficulty === d.id, () => onChange({ difficulty: d.id })))),
      h('p', { class: 'faint acad-filter-note' }, 'Harder levels also include the easier questions.')),
    h('div', { class: 'row acad-start' },
      h('button', { type: 'button', class: 'btn btn-primary btn-lg', disabled: !count, onclick: () => onStart({ ...state, count: QUICK_COUNT }) },
        `▶ Start ${Math.min(QUICK_COUNT, count)}-question quiz`),
      h('button', { type: 'button', class: 'btn btn-cyan btn-lg', onclick: () => onStart({ category: 'all', difficulty: 0, count: MIXED_COUNT }) }, '🎲 Mixed 10'),
      h('span', { class: 'faint', 'aria-live': 'polite' }, `${count} question${count === 1 ? '' : 's'} match`)));
}

export function render(root) {
  let filters = { category: 'all', difficulty: 0 };
  let stopQuiz = null;
  let quizActive = false;

  const ringsSlot = h('div');
  const stage = h('div', { class: 'acad-stage' });

  const refreshRings = () => mount(ringsSlot, ringsPanel());

  const showPicker = () => {
    stopQuiz?.();
    stopQuiz = null;
    quizActive = false;
    mount(stage, pickerPanel(filters, {
      onChange: (patch) => { filters = { ...filters, ...patch }; showPicker(); },
      onStart: startQuiz,
    }));
  };

  function startQuiz(opts) {
    const questions = pickQuestions({ ...opts, profile: currentProfile() });
    if (!questions.length) {
      announce('No questions match yet. Try another topic.');
      return;
    }
    quizActive = true;
    stopQuiz = runQuiz(stage, questions, {
      onFinish: (summary) => { finishRound(opts.category, summary); refreshRings(); },
      onExit: () => { showPicker(); stage.querySelector('.acad-start .btn')?.focus(); },
    });
    stage.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  mount(root,
    h('header', { class: 'screen-head' },
      h('div', null,
        h('span', { class: 'kicker' }, '🎓 Astronaut Academy'),
        h('h1', null, 'Train like a real astronaut'),
        h('p', null, 'Quick quizzes about Mars, the Moon and how to survive there. Every answer teaches you something, even the wrong ones!')),
      h('a', { class: 'btn btn-ghost', href: '#/dictionary?mode=flashcards' }, '🃏 Study flashcards')),
    ringsSlot,
    stage,
    lessonsPanel(),
    h('div', { class: 'acad-dyk' }, didYouKnow()));

  refreshRings();
  showPicker();

  const unsubscribe = subscribe(() => { if (!quizActive) refreshRings(); });
  return () => { stopQuiz?.(); unsubscribe(); };
}
