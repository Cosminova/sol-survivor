// For Educators: classroom guide, printable lesson plans and the NGSS alignment table.
import '../../styles/learn.css';
import { h, mount, prefersReducedMotion } from '../dom.js';
import { LESSONS, NGSS_ALIGNMENT, call } from '../../state/learn.js';
import { getState } from '../../state/store.js';
import { CAMPAIGN, missionById } from '../../data/missions.js';
import { termButton } from '../components/common.js';
import { lessonArticle, ngssTitle } from './learn/lessonPlan.js';

const PRINT_RESET_MS = 1200;

const GUIDE = [
  ['🔑', 'Same mission code for everyone', 'Share one mission code so the whole class gets the same landing date, weather and events. Results are directly comparable, which makes a great class discussion.'],
  ['🟢', 'Cadet difficulty for grades 4–5', 'Cadet gives a bigger mass budget and fewer breakdowns. Use Specialist for grades 6–7 and Commander for confident grade 8–9 teams.'],
  ['📴', 'Works offline', 'Load the game once while online and it keeps working without internet, so it’s fine on Chromebooks and tablets with flaky Wi-Fi.'],
  ['🔊', 'Read-aloud & text size', 'Turn on Read aloud, larger text, high contrast or reduced motion in Settings ⚙️. Every dictionary word and quiz question has a 🔊 button.'],
  ['👥', 'Play in teams of 2–4', 'One student is Flight Director (makes decisions), one tracks supplies, one reads the science cards aloud, one keeps the mission log.'],
  ['📊', 'Real NASA data', 'Weather, solar storms and maps come from archived NASA datasets. The Data Lab lists every source so students can check the evidence.'],
];

function scrollToEl(el) {
  el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  el?.querySelector('h2')?.focus({ preventScroll: true });
}

function guidePanel() {
  return h('section', { class: 'panel edu-guide', 'aria-labelledby': 'edu-guide-title' },
    h('h2', { id: 'edu-guide-title', class: 'panel-title' }, 'How to use Sol Survivor with your class'),
    h('ul', { class: 'edu-guide-grid', role: 'list' }, GUIDE.map(([icon, title, text]) => h('li', { class: 'edu-tip' },
      h('span', { class: 'edu-tip-icon', 'aria-hidden': 'true' }, icon),
      h('div', null, h('h3', null, title), h('p', null, text))))),
    h('div', { class: 'row no-print' },
      h('a', { class: 'btn btn-sm btn-cyan', href: '#/datalab' }, '📊 Data Lab: sources & methods'),
      h('a', { class: 'btn btn-sm', href: '#/campaign' }, '🚀 Campaign chapters'),
      h('a', { class: 'btn btn-sm', href: '#/settings' }, '⚙️ Accessibility settings')));
}

const cellText = (v) => (Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? Object.values(v).join(' · ') : String(v ?? ''));

function lessonLinks(ids, onJump) {
  return ids.map((id) => {
    const lesson = LESSONS.find((l) => l.id === id);
    return lesson ? h('button', { type: 'button', class: 'edu-link', onclick: () => onJump(id) }, lesson.title) : h('span', null, id);
  }).flatMap((el, i) => (i ? [h('br'), el] : [el]));
}

function alignmentRows(onJump) {
  if (Array.isArray(NGSS_ALIGNMENT) && NGSS_ALIGNMENT.length && NGSS_ALIGNMENT[0]?.code) {
    return {
      head: ['Code', 'Grade', 'Performance expectation', 'Lessons'],
      rows: NGSS_ALIGNMENT.map((r) => [h('span', { class: 'badge mono' }, r.code), cellText(r.grade), cellText(r.title), lessonLinks(r.lessons ?? [], onJump)]),
    };
  }
  if (Array.isArray(NGSS_ALIGNMENT) && NGSS_ALIGNMENT.length) {
    const keys = Object.keys(NGSS_ALIGNMENT[0] ?? {});
    return { head: keys, rows: NGSS_ALIGNMENT.map((r) => keys.map((k) => cellText(r[k]))) };
  }
  if (NGSS_ALIGNMENT && typeof NGSS_ALIGNMENT === 'object') {
    return { head: ['Standard', 'Details'], rows: Object.entries(NGSS_ALIGNMENT).map(([k, v]) => [k, cellText(v)]) };
  }
  const codes = [...new Set(LESSONS.flatMap((l) => l.ngss ?? []))].sort();
  return {
    head: ['Code', 'Performance expectation', 'Lessons'],
    rows: codes.map((code) => [h('span', { class: 'badge mono' }, code), ngssTitle(code), lessonLinks(LESSONS.filter((l) => l.ngss?.includes(code)).map((l) => l.id), onJump)]),
  };
}

function alignmentPanel(onJump) {
  const { head, rows } = alignmentRows(onJump);
  if (!rows.length) return null;
  return h('section', { class: 'panel edu-ngss', 'aria-labelledby': 'edu-ngss-title' },
    h('h2', { id: 'edu-ngss-title', class: 'panel-title mars' }, 'Which science standards each lesson covers (NGSS)'),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'table edu-table' },
        h('thead', null, h('tr', null, head.map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => h('td', null, c))))))));
}

function progressPanel() {
  const sum = call('learningSummary', [getState().profile], () => null);
  if (!sum) return null;
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '0%');
  const stats = [
    ['🚀', 'Chapters', `${sum.chaptersCompleted} / ${sum.totalChapters}`, `${sum.stars} ⭐ earned`],
    ['🎓', 'Quiz answers', sum.quizAnswered, `${Math.round(sum.quizAccuracy * 100)}% correct`],
    ['📖', 'Words explored', `${sum.termsViewed} / ${sum.totalTerms}`, `${sum.flashcardsKnown} flashcards known`],
    ['🏅', 'Badges', `${sum.badges} / ${sum.totalBadges}`, pct(sum.badges, sum.totalBadges)],
    ['🎴', 'Science cards seen', sum.eventsSeen, 'Real Science panels read'],
  ];
  return h('section', { class: 'panel edu-progress', 'aria-labelledby': 'edu-progress-title' },
    h('h2', { id: 'edu-progress-title', class: 'panel-title' }, 'What players on this device have learned', h('span', { class: 'spacer' }), sum.name ? h('span', { class: 'faint' }, sum.name) : null),
    h('ul', { class: 'edu-stats', role: 'list' }, stats.map(([icon, label, value, note]) => h('li', { class: 'edu-stat' },
      h('span', { class: 'edu-stat-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'edu-stat-value mono' }, String(value)),
      h('span', { class: 'edu-stat-label' }, label),
      h('span', { class: 'faint edu-stat-note' }, note)))),
    h('p', { class: 'faint' }, 'Progress is stored only in this browser. Nothing is uploaded, so student data stays on the device.'));
}

function chapterFallback() {
  return h('section', { class: 'panel', 'aria-labelledby': 'edu-fallback-title' },
    h('h2', { id: 'edu-fallback-title', class: 'panel-title' }, 'Chapter guide'),
    h('p', { class: 'muted' }, 'Full lesson plans are loading. Meanwhile, here is the big idea behind each campaign chapter.'),
    h('ol', { class: 'edu-chapter-list' }, CAMPAIGN.map((c) => h('li', null,
      h('strong', null, `Chapter ${c.chapter}: ${c.title}. `), c.lesson, ' ',
      h('a', { href: `#/loadout/${encodeURIComponent(c.id)}`, class: 'no-print' }, 'Play →')))));
}

function lessonIndex(onJump) {
  return h('nav', { class: 'edu-index no-print', 'aria-label': 'Lessons in this guide' },
    h('span', { class: 'field-label' }, 'Jump to a lesson'),
    h('div', { class: 'row' }, LESSONS.map((l, i) => h('button', { type: 'button', class: 'chip', onclick: () => onJump(l.id) }, `${i + 1}. ${l.title}`))));
}

export function render(root, route) {
  let resetTimer = null;
  let afterPrint = null;

  const finishPrint = () => {
    root.classList.remove('edu-print-one');
    root.querySelectorAll('.edu-print-target').forEach((el) => el.classList.remove('edu-print-target'));
    if (afterPrint) window.removeEventListener('afterprint', afterPrint);
    afterPrint = null;
  };

  const printNow = () => {
    afterPrint = finishPrint;
    window.addEventListener('afterprint', afterPrint);
    window.print();
    clearTimeout(resetTimer);
    resetTimer = setTimeout(finishPrint, PRINT_RESET_MS);
  };

  const printLesson = (article) => {
    finishPrint();
    root.classList.add('edu-print-one');
    article.classList.add('edu-print-target');
    printNow();
  };

  const printAll = () => { finishPrint(); printNow(); };
  const jump = (id) => scrollToEl(root.querySelector(`#lesson-${CSS.escape(id)}`));

  const lessons = LESSONS.map((lesson, i) => lessonArticle(lesson, {
    index: i + 1,
    mission: lesson.missionId ? missionById(lesson.missionId) : null,
    termChip: termButton,
    onPrint: printLesson,
  }));

  mount(root,
    h('header', { class: 'screen-head' },
      h('div', null,
        h('span', { class: 'kicker' }, '🍎 For Educators'),
        h('h1', null, 'For teachers and parents'),
        h('p', null, 'Lesson plans you can print, for ages 9 to 15 (grades 4 to 9). Each one goes with a mission in the game and uses real NASA data. New here? Play the three-minute training mission first: it teaches the whole game.')),
      h('div', { class: 'row no-print' },
        h('a', { class: 'btn', href: '#/play?tutorial=1' }, 'Try the training mission'),
        LESSONS.length ? h('button', { type: 'button', class: 'btn btn-primary', onclick: printAll }, '🖨️ Print all lessons') : null)),
    guidePanel(),
    progressPanel(),
    LESSONS.length ? lessonIndex(jump) : null,
    LESSONS.length ? h('div', { class: 'edu-lessons' }, lessons) : chapterFallback(),
    alignmentPanel(jump));

  if (route.query?.lesson) resetTimer = setTimeout(() => jump(route.query.lesson), 120);

  return () => { clearTimeout(resetTimer); finishPrint(); };
}
