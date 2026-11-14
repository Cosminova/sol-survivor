// Data Lab · Gallery: archived NASA Image and Video Library photos with topic filters and a lightbox.
import { h, mount } from '../../dom.js';
import { sourceBadge } from '../../components/common.js';
import { openModal } from '../../components/modal.js';
import { loadGallery } from '../../../state/nasaData.js';
import { sectionHead, withData, fmtDate } from './shared.js';

const MILESTONE_TOPIC = 'Historic milestones';
const TOPIC_LABELS = {
  [MILESTONE_TOPIC]: '🏛️ Milestones',
  'Curiosity rover Mars surface': '🤖 Curiosity',
  'Perseverance rover Jezero': '🚙 Perseverance',
  'Mars dust storm': '🌪️ Dust storms',
  'Mars habitat concept': '🏠 Habitats',
  'Artemis lunar surface': '🌕 Artemis',
  'MOXIE oxygen Perseverance': '🫧 MOXIE oxygen',
};
const CENTERS = { JPL: 'NASA/JPL-Caltech', JSC: 'NASA Johnson', KSC: 'NASA Kennedy', GSFC: 'NASA Goddard', MSFC: 'NASA Marshall', HQ: 'NASA HQ', ARC: 'NASA Ames' };

const topicLabel = (topic) => TOPIC_LABELS[topic] ?? topic;
const credit = (center) => CENTERS[center] ?? (center ? `NASA ${center}` : 'NASA');
const imageSrc = (item) => `./images/${encodeURIComponent(item.file)}`;

function tidy(text = '') {
  const clean = text.trim();
  return /[.!?”")]$/.test(clean) ? clean : `${clean}…`;
}

async function loadMilestones() {
  try {
    const res = await fetch('./data/milestones.json');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item) => ({ ...item, topic: item.topic ?? MILESTONE_TOPIC }));
  } catch (err) {
    console.warn('[datalab] milestones.json unavailable', err);
    return [];
  }
}

async function loadAll() {
  const [gallery, milestones] = await Promise.all([loadGallery(), loadMilestones()]);
  const seen = new Set();
  return [...milestones, ...(gallery.items ?? [])]
    .filter((item) => item?.file && item.title)
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    .map((item) => ({ ...item, topic: item.topic ?? 'Other' }));
}

function photo(item, { lazy = true, className = '' } = {}) {
  const fallback = h('div', { class: 'dl-photo-fallback', hidden: true }, h('span', { 'aria-hidden': 'true' }, '🛰️'), 'Image not in this offline pack');
  const img = h('img', {
    src: imageSrc(item),
    alt: item.title,
    loading: lazy ? 'lazy' : 'eager',
    decoding: 'async',
    class: className,
    onerror: (e) => { e.currentTarget.hidden = true; fallback.hidden = false; },
  });
  return [img, fallback];
}

function openLightbox(item) {
  openModal({
    title: item.title,
    wide: true,
    className: 'dl-lightbox',
    content: h('div', { class: 'dl-lightbox-body' },
      h('figure', { class: 'dl-lightbox-figure' }, photo(item, { lazy: false }),
        h('figcaption', { class: 'faint dl-small' }, `Image credit: ${credit(item.center)} · NASA Image and Video Library`)),
      h('div', { class: 'stack-sm' },
        h('div', { class: 'row' },
          h('span', { class: 'badge' }, `📅 ${fmtDate(item.date)}`),
          item.center ? h('span', { class: 'badge moon' }, `🏢 ${item.center}`) : null,
          h('span', { class: 'badge mars' }, topicLabel(item.topic))),
        item.description && item.description.trim() !== item.title.trim()
          ? h('p', null, tidy(item.description))
          : h('p', { class: 'muted' }, 'No longer caption in the NASA archive for this photo.'),
        h('div', { class: 'row' },
          h('a', { class: 'btn btn-sm', href: `https://images.nasa.gov/details/${encodeURIComponent(item.id)}`, target: '_blank', rel: 'noopener noreferrer', 'data-autofocus': '' },
            'View original at NASA', h('span', { class: 'sr-only' }, ' (opens in a new tab)')),
          sourceBadge('images', { label: 'Source' })))),
  });
}

function tile(item) {
  return h('li', { class: 'dl-tile' }, h('button', {
    type: 'button',
    class: 'dl-tile-btn',
    'aria-label': `${item.title}, ${fmtDate(item.date)}. Open larger image`,
    onclick: () => openLightbox(item),
  },
  h('span', { class: 'dl-tile-img' }, photo(item)),
  h('span', { class: 'dl-tile-meta' },
    h('span', { class: 'dl-tile-title' }, item.title),
    h('span', { class: 'faint dl-small' }, `${fmtDate(item.date)} · ${topicLabel(item.topic)}`))));
}

function build(items) {
  if (!items.length) return h('div', { class: 'panel empty' }, 'No photos in this offline pack yet.');
  const topics = [...new Set(items.map((i) => i.topic))];
  const filters = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Filter photos by topic' });
  const grid = h('ul', { class: 'dl-gallery' });
  const count = h('p', { class: 'faint dl-small', 'aria-live': 'polite' });

  const show = (topic, refocus = false) => {
    const list = topic === 'all' ? items : items.filter((i) => i.topic === topic);
    mount(filters, ['all', ...topics].map((t) => h('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(t === topic),
      onclick: () => show(t, true),
    }, t === 'all' ? `✨ All (${items.length})` : topicLabel(t))));
    if (refocus) filters.querySelector('[aria-pressed="true"]')?.focus();
    mount(grid, [...list].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(tile));
    count.textContent = `Showing ${list.length} photo${list.length === 1 ? '' : 's'}, oldest first. Tap one to see it big.`;
  };
  show('all');
  return h('div', { class: 'stack' }, filters, count, grid);
}

export function renderGallery(container) {
  const body = h('div');
  mount(container,
    sectionHead({
      kicker: 'NASA Image & Video Library',
      title: 'Mission Photo Gallery',
      intro: 'Real pictures from the Moon, Mars and the missions that got us there, from Apollo 8’s Earthrise to Perseverance and Artemis.',
    }),
    h('div', { class: 'row dl-terms' }, sourceBadge('images', { label: 'Photos' })),
    body);
  return withData(body, { loader: loadAll, message: 'Developing photos…', build });
}
