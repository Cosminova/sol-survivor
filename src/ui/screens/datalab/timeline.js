// Data Lab · Timeline: real exploration milestones from Sputnik to Artemis, filterable by world.
import { h, mount } from '../../dom.js';
import { sourceBadge, termButton } from '../../components/common.js';
import { openModal } from '../../components/modal.js';
import { TIMELINE, timelineFor } from '../../../data/timeline.js';
import { sectionHead, fmtDate } from './shared.js';

const BODIES = [
  { id: 'all', label: '✨ All' },
  { id: 'earth', label: '🌍 Earth orbit' },
  { id: 'moon', label: '🌕 Moon' },
  { id: 'mars', label: '🔴 Mars' },
];
const BODY_BADGE = { earth: ['badge', '🌍 Earth'], moon: ['badge moon', '🌕 Moon'], mars: ['badge mars', '🔴 Mars'] };
const BIG_GAP_YEARS = 10;

const yearOf = (date) => Number(String(date).slice(0, 4));
const imageSrc = (file) => `./images/${encodeURIComponent(file)}`;
const altFor = (item) => `${item.title} (${item.mission})`;
const bodyBadge = (body) => h('span', { class: BODY_BADGE[body]?.[0] ?? 'badge' }, BODY_BADGE[body]?.[1] ?? body);

function yearsAgo(date) {
  const years = new Date().getUTCFullYear() - yearOf(date);
  if (years <= 0) return 'This year';
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function openPhoto(item) {
  openModal({
    title: item.title,
    wide: true,
    className: 'dl-lightbox',
    content: h('div', { class: 'dl-lightbox-body' },
      h('figure', { class: 'dl-lightbox-figure' },
        h('img', { src: imageSrc(item.image), alt: altFor(item) }),
        h('figcaption', { class: 'faint dl-small' }, 'Image: NASA · NASA Image and Video Library')),
      h('div', { class: 'stack-sm' },
        h('div', { class: 'row' }, h('span', { class: 'badge' }, `📅 ${fmtDate(item.date)}`), bodyBadge(item.body)),
        h('strong', null, item.mission),
        h('p', null, item.text),
        h('div', { class: 'row' }, sourceBadge(item.source, { label: 'Source' }), sourceBadge('images', { label: 'Photo' })))),
  });
}

function thumb(item) {
  if (!item.image) return null;
  return h('button', { type: 'button', class: 'dl-tl-thumb', 'aria-label': `Open larger photo: ${altFor(item)}`, onclick: () => openPhoto(item) },
    h('img', {
      src: imageSrc(item.image), alt: altFor(item), loading: 'lazy', decoding: 'async',
      onerror: (e) => { e.currentTarget.closest('.dl-tl-thumb')?.remove(); },
    }));
}

function entry(item) {
  return h('li', { class: ['dl-tl-item', `dl-tl-${item.body}`] },
    h('span', { class: 'dl-tl-dot', 'aria-hidden': 'true' }),
    h('article', { class: 'dl-tl-card' },
      h('header', { class: 'dl-tl-head' },
        h('span', { class: 'dl-tl-year' }, yearOf(item.date)),
        h('div', { class: 'dl-tl-meta' },
          h('span', { class: 'faint dl-small' }, `${fmtDate(item.date)} · ${yearsAgo(item.date)}`),
          bodyBadge(item.body))),
      h('div', { class: ['dl-tl-content', item.image && 'has-thumb'] },
        h('div', null,
          h('span', { class: 'kicker' }, item.mission),
          h('h3', null, item.title),
          h('p', null, item.text),
          sourceBadge(item.source, { label: 'Source' })),
        thumb(item))));
}

function gap(prev, next) {
  const years = yearOf(next.date) - yearOf(prev.date);
  if (years < BIG_GAP_YEARS) return null;
  return h('li', { class: 'dl-tl-gap', 'aria-hidden': 'true' }, `⋮ ${years} years later`);
}

const listFor = (items) => items.flatMap((item, i) => [i > 0 ? gap(items[i - 1], item) : null, entry(item)]);
const countFor = (body) => (body === 'all' ? TIMELINE.length : TIMELINE.filter((t) => t.body === body).length);

function nextChapter() {
  return h('li', { class: 'dl-tl-item dl-tl-next' },
    h('span', { class: 'dl-tl-dot', 'aria-hidden': 'true' }),
    h('div', { class: 'dl-tl-card' },
      h('span', { class: 'kicker mars' }, 'Next chapter'),
      h('h3', null, '🧑‍🚀 You?'),
      h('p', { class: 'muted' }, 'The first people to live on the Moon or Mars are kids in school today. Every mission above solved a problem you will face in Sol Survivor.')));
}

export function renderTimeline(container) {
  const filters = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Filter milestones by world' });
  const summary = h('p', { class: 'faint dl-small', 'aria-live': 'polite' });
  const list = h('ol', { class: 'dl-timeline', 'aria-label': 'Exploration milestones, oldest first' });

  const show = (body, refocus = false) => {
    const items = timelineFor(body);
    mount(filters, BODIES.map((b) => h('button', {
      type: 'button', class: ['chip', `dl-chip-${b.id}`], 'aria-pressed': String(b.id === body), onclick: () => show(b.id, true),
    }, `${b.label} (${countFor(b.id)})`)));
    if (refocus) filters.querySelector('[aria-pressed="true"]')?.focus();
    summary.textContent = items.length
      ? `${items.length} milestones from ${yearOf(items[0].date)} to ${yearOf(items[items.length - 1].date)}. Tap a photo to see it bigger.`
      : 'No milestones for this world yet.';
    mount(list, listFor(items), nextChapter());
  };

  mount(container,
    sectionHead({
      kicker: 'From Sputnik to Artemis',
      title: 'Space Exploration Timeline',
      intro: 'Almost 70 years of firsts: the first satellite, the first footsteps on the Moon, the first rovers and helicopter on Mars. Each one taught us how people might live out there.',
    }),
    h('div', { class: 'row dl-terms' },
      h('span', { class: 'faint dl-small' }, 'Words to know:'),
      termButton('orbit', 'orbit'), termButton('edl', 'landing (EDL)'), termButton('artemis', 'Artemis')),
    filters,
    summary,
    list);
  show('all');
}
