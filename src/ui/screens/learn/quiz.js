// One-question-at-a-time quiz runner used by the Academy. Returns a cleanup function.
import { h, mount, richText, announce, plainText } from '../../dom.js';
import { CATEGORIES, termById } from '../../../data/glossary.js';
import { openTermPopover } from '../../components/termPopover.js';
import { sourceBadge, termButton, stars } from '../../components/common.js';
import { speak, canSpeak } from '../../speech.js';
import { play } from '../../audio.js';
import { currentProfile, saveProfile } from './profile.js';
import { grade, starsFor, DIFFICULTIES } from './quizSource.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const KEY_INDEX = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };

const RESULT_LINES = [
  ['🛰️', 'Good try! Every astronaut trains again and again.'],
  ['🚀', 'Nice work! Review the words you missed and go again.'],
  ['🌟', 'Great job! You are almost mission-ready.'],
  ['🏆', 'Outstanding! Flight director material!'],
];

function readAloudButton(text, label = 'Read the question aloud') {
  if (!canSpeak()) return null;
  return h('button', { type: 'button', class: 'btn btn-ghost btn-icon acad-speak', 'aria-label': label, onclick: () => speak(text, true) }, '🔊');
}

function progressDots(results, index, total) {
  return h('ol', { class: 'acad-dots', 'aria-hidden': 'true' },
    Array.from({ length: total }, (_, i) => {
      const r = results[i];
      const state = r ? (r.correct ? 'is-right' : 'is-wrong') : (i === index ? 'is-current' : '');
      return h('li', { class: ['acad-dot', state] });
    }));
}

function questionHead(q, index, total, onQuit) {
  const cat = CATEGORIES[q.category];
  const diff = DIFFICULTIES.find((d) => d.id === q.difficulty);
  return h('div', { class: 'acad-q-head' },
    h('div', { class: 'row' },
      cat ? h('span', { class: 'kicker' }, `${cat.icon} ${cat.label}`) : null,
      diff ? h('span', { class: 'badge' }, `${diff.icon} ${diff.label}`) : null),
    h('div', { class: 'row' },
      h('span', { class: 'acad-q-count mono' }, `${index + 1} / ${total}`),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: onQuit }, '✕ Quit')));
}

function feedbackBox(q, choice, result) {
  const right = q.choices[q.answer];
  const term = termById(q.term);
  return h('div', { class: ['acad-feedback', result.correct ? 'is-right' : 'is-wrong'] },
    h('p', { class: 'acad-feedback-title' },
      result.correct ? '✅ Correct!' : `❌ Not quite. The answer is ${LETTERS[q.answer]}: ${plainText(right)}`),
    result.explain ? h('p', null, richText(result.explain, openTermPopover)) : null,
    h('div', { class: 'row' },
      term ? termButton(q.term, `📖 Learn the word: ${term.term}`) : null,
      q.source ? sourceBadge(q.source, { label: 'Source' }) : null));
}

function resultsView(results, { onRetry, onExit }) {
  const score = results.filter((r) => r.correct).length;
  const total = results.length;
  const n = starsFor(score, total);
  const [icon, line] = RESULT_LINES[n];
  const missed = results.filter((r) => !r.correct);
  return h('section', { class: 'acad-results', 'aria-labelledby': 'acad-results-title' },
    h('div', { class: 'acad-results-icon', 'aria-hidden': 'true' }, icon),
    h('h2', { id: 'acad-results-title', tabindex: '-1' }, 'Quiz complete!'),
    h('p', { class: 'acad-score mono' }, h('strong', null, score), ` / ${total}`),
    stars(n, 3, { size: '2.4rem', animate: true }),
    h('p', { class: 'acad-results-line' }, line),
    missed.length ? h('div', { class: 'acad-review' },
      h('h3', { class: 'panel-title mars' }, 'Words to review'),
      h('ul', { role: 'list' }, missed.map(({ q }) => h('li', null,
        h('span', null, plainText(q.question)),
        h('span', { class: 'acad-review-answer' }, `✓ ${plainText(q.choices[q.answer])}`),
        termButton(q.term))))) : null,
    h('div', { class: 'row acad-results-actions' },
      h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: onRetry }, '↺ Try again'),
      h('button', { type: 'button', class: 'btn btn-cyan btn-lg', onclick: onExit }, '🎓 Choose another quiz')));
}

// runQuiz(stage, questions, { onFinish(summary), onExit() }) -> cleanup
export function runQuiz(stage, questions, { onFinish, onExit } = {}) {
  let index = 0;
  let results = [];
  let answered = false;

  const finish = () => {
    const score = results.filter((r) => r.correct).length;
    const summary = { score, total: results.length, stars: starsFor(score, results.length), results };
    play(summary.stars >= 2 ? 'win' : 'click');
    mount(stage, resultsView(results, { onRetry: restart, onExit }));
    announce(`Quiz complete. You scored ${score} out of ${results.length}.`);
    stage.querySelector('#acad-results-title')?.focus();
    onFinish?.(summary);
  };

  const next = () => {
    index += 1;
    if (index >= questions.length) finish();
    else showQuestion();
  };

  const choose = (choice) => {
    if (answered) return;
    answered = true;
    const q = questions[index];
    const result = grade(currentProfile(), q, choice);
    saveProfile(result.profile);
    results = [...results, { q, choice, correct: result.correct }];
    play(result.correct ? 'good' : 'bad');
    showAnswered(q, choice, result);
  };

  function choiceButtons(q, choice, result) {
    return h('div', { class: 'acad-choices', role: 'group', 'aria-label': 'Answer choices' },
      q.choices.map((text, i) => {
        const state = result && (i === q.answer ? 'is-correct' : i === choice ? 'is-wrong' : 'is-dim');
        return h('button', {
          type: 'button',
          class: ['acad-choice', state],
          disabled: Boolean(result),
          'aria-label': `${LETTERS[i]}: ${plainText(text)}${state === 'is-correct' ? ' (correct answer)' : ''}${state === 'is-wrong' ? ' (your answer)' : ''}`,
          onclick: () => choose(i),
        }, h('span', { class: 'acad-letter', 'aria-hidden': 'true' }, LETTERS[i]), h('span', { 'aria-hidden': 'true' }, plainText(text)));
      }));
  }

  function card(q, body) {
    const spoken = `${plainText(q.question)} ${q.choices.map((c, i) => `${LETTERS[i]}: ${plainText(c)}.`).join(' ')}`;
    return h('section', { class: 'acad-q panel', 'aria-labelledby': 'acad-q-text' },
      questionHead(q, index, questions.length, onExit),
      progressDots(results, index, questions.length),
      h('div', { class: 'acad-q-row' },
        h('h2', { id: 'acad-q-text', class: 'acad-q-text', tabindex: '-1' }, richText(q.question, openTermPopover)),
        readAloudButton(spoken)),
      body);
  }

  function showQuestion() {
    answered = false;
    const q = questions[index];
    mount(stage, card(q, [
      choiceButtons(q, null, null),
      h('p', { class: 'acad-hint faint' }, 'Tip: press 1–4 or A–D to answer.'),
    ]));
    stage.querySelector('#acad-q-text')?.focus();
  }

  function showAnswered(q, choice, result) {
    const last = index + 1 >= questions.length;
    const nextBtn = h('button', { type: 'button', class: 'btn btn-primary btn-lg acad-next', onclick: next }, last ? 'See results 🏁' : 'Next question →');
    mount(stage, card(q, [
      choiceButtons(q, choice, result),
      h('div', { 'aria-live': 'polite' }, feedbackBox(q, choice, result)),
      h('div', { class: 'row acad-next-row' }, nextBtn),
    ]));
    announce(result.correct ? 'Correct!' : `Not quite. The answer is ${plainText(q.choices[q.answer])}.`);
    nextBtn.focus();
  }

  function restart() {
    index = 0;
    results = [];
    showQuestion();
  }

  const onKey = (e) => {
    if (answered || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, .popover, .modal')) return;
    const i = KEY_INDEX[e.key.toLowerCase()];
    if (i == null || !stage.querySelector('.acad-choices') || i >= questions[index].choices.length) return;
    e.preventDefault();
    choose(i);
  };

  document.addEventListener('keydown', onKey);
  showQuestion();
  return () => document.removeEventListener('keydown', onKey);
}
