// Renders one printable lesson plan. Accepts strings or { title, text, minutes } objects for list items.
import { h } from '../../dom.js';

const ngssData = Object.values(import.meta.glob('../../../data/ngss.js', { eager: true }))[0] ?? {};
const NGSS_STANDARDS = ngssData.NGSS_STANDARDS ?? {};

export const ngssTitle = (code) => NGSS_STANDARDS[code]?.title ?? '';

function itemText(item) {
  if (item == null) return '';
  if (typeof item !== 'object') return String(item);
  const lead = item.title ?? item.name ?? '';
  const body = item.text ?? item.desc ?? item.description ?? '';
  const mins = item.minutes ? ` (${item.minutes} min)` : '';
  return lead && body ? [h('strong', null, `${lead}${mins}: `), body] : `${lead || body}${mins}`;
}

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function block(title, content, className) {
  if (!content || (Array.isArray(content) && !content.length)) return null;
  return h('section', { class: ['edu-block', className] }, h('h3', null, title), content);
}

const list = (tag, items) => (items.length ? h(tag, null, items.map((it) => h('li', null, itemText(it)))) : null);

function ngssBadges(codes) {
  return codes.map((code) => {
    const title = ngssTitle(code);
    return h('span', { class: 'badge edu-ngss-badge mono', title: title || code }, code, title ? h('span', { class: 'sr-only' }, `: ${title}`) : null);
  });
}

function gradeLabel(band) {
  const text = String(band ?? '').trim();
  return text ? `Grades ${text.replace(/^grades?\s*/i, '')}` : null;
}

// lessonArticle(lesson, { index, mission, termChip(id) -> node, onPrint(article) })
export function lessonArticle(lesson, { index, mission, termChip, onPrint }) {
  const titleId = `lesson-title-${lesson.id}`;
  const terms = asList(lesson.terms).map((id) => termChip(id)).filter(Boolean);
  const grade = gradeLabel(lesson.gradeBand);
  const article = h('article', { class: 'panel edu-lesson', id: `lesson-${lesson.id}`, 'aria-labelledby': titleId },
    h('header', { class: 'edu-lesson-head' },
      h('div', null,
        h('span', { class: 'kicker' }, `Lesson ${index}`),
        h('h2', { id: titleId, tabindex: '-1' }, lesson.title),
        h('div', { class: 'row edu-meta' },
          grade ? h('span', { class: 'badge moon' }, grade) : null,
          lesson.minutes ? h('span', { class: 'badge' }, `⏱ ${lesson.minutes} minutes`) : null,
          mission ? h('span', { class: ['badge', mission.body] }, `Chapter ${mission.chapter}: ${mission.title}`) : null)),
      h('button', { type: 'button', class: 'btn btn-sm no-print', onclick: () => onPrint(article), 'aria-label': `Print lesson: ${lesson.title}` }, '🖨️ Print lesson')),
    asList(lesson.ngss).length ? h('div', { class: 'row edu-ngss-row', 'aria-label': 'NGSS performance expectations' },
      h('span', { class: 'faint' }, 'NGSS:'), ngssBadges(asList(lesson.ngss))) : null,
    h('div', { class: 'edu-cols' },
      block('🎯 Learning objectives', list('ul', asList(lesson.objectives))),
      block('📖 Vocabulary', terms.length ? h('div', { class: 'edu-terms' }, terms) : null)),
    block('🔥 Warm-up', lesson.warmUp ? h('p', null, itemText(lesson.warmUp)) : null),
    block('🧭 Steps', list('ol', asList(lesson.steps)), 'edu-steps'),
    block('💬 Discussion questions', list('ul', asList(lesson.discussion))),
    block('🚀 Extension', lesson.extension ? h('p', null, itemText(lesson.extension)) : null),
    block('🎟️ Exit ticket', lesson.exitTicket ? h('p', null, itemText(lesson.exitTicket)) : null, 'edu-exit'),
    mission ? h('p', { class: 'edu-play no-print' },
      h('a', { class: 'btn btn-cyan btn-sm', href: `#/loadout/${encodeURIComponent(mission.id)}` }, `🚀 Play Chapter ${mission.chapter}: ${mission.title}`),
      h('a', { class: 'btn btn-ghost btn-sm', href: '#/campaign' }, 'See all chapters')) : null,
    mission ? h('p', { class: 'edu-print-only' }, `Game link: Sol Survivor → Campaign → Chapter ${mission.chapter}, “${mission.title}”.`) : null);
  return article;
}
