// Badges: every achievement (earned in color, locked as a silhouette with a hint), campaign stars and patch link.
import '../../styles/learn.css';
import { h, mount } from '../dom.js';
import { getState, subscribe } from '../../state/store.js';
import { ACHIEVEMENTS } from '../../state/learn.js';
import { CAMPAIGN } from '../../data/missions.js';
import { stars, meter } from '../components/common.js';
import { earnedInfo, awardNewBadges } from './learn/profile.js';
import { paintCanvas } from './learn/patchCanvas.js';

const achievementData = Object.values(import.meta.glob('../../data/achievements.js', { eager: true }))[0] ?? {};
const CATEGORY_META = achievementData.ACHIEVEMENT_CATEGORIES ?? {};
const PREVIEW_SIZE = 150;
const MAX_STARS_PER_CHAPTER = 3;

const categoryLabel = (id) => CATEGORY_META[id] ?? { label: id ? id[0].toUpperCase() + id.slice(1) : 'Other', icon: '🏅' };
const dateText = (d) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function badgeTile(badge, profile) {
  const info = earnedInfo(profile, badge.id);
  return h('li', { class: ['bdg-tile', info ? 'is-earned' : 'is-locked'] },
    h('div', { class: 'bdg-medal', 'aria-hidden': 'true' },
      h('span', { class: 'bdg-icon' }, badge.icon ?? '🏅'),
      info ? null : h('span', { class: 'bdg-lock' }, '🔒')),
    h('div', { class: 'bdg-text' },
      h('h3', null, badge.title, h('span', { class: 'sr-only' }, info ? ' (earned)' : ' (locked)')),
      h('p', null, info ? badge.desc : h('span', null, h('strong', null, 'How to earn: '), badge.desc)),
      info ? h('span', { class: 'badge good' }, info.date ? `Earned ${dateText(info.date)}` : 'Earned ✓') : null));
}

function groupedBadges(profile) {
  const groups = ACHIEVEMENTS.reduce((acc, b) => {
    const key = b.category ?? 'other';
    return { ...acc, [key]: [...(acc[key] ?? []), b] };
  }, {});
  const order = [...Object.keys(CATEGORY_META), ...Object.keys(groups)].filter((k, i, all) => groups[k] && all.indexOf(k) === i);
  return order.map((key) => {
    const list = groups[key];
    const cat = categoryLabel(key);
    const got = list.filter((b) => earnedInfo(profile, b.id)).length;
    return h('section', { class: 'bdg-group', 'aria-labelledby': `bdg-g-${key}` },
      h('h2', { id: `bdg-g-${key}`, class: 'panel-title' }, `${cat.icon} ${cat.label}`, h('span', { class: 'spacer' }), h('span', { class: 'mono' }, `${got} / ${list.length}`)),
      h('ul', { class: 'bdg-grid', role: 'list' }, list.map((b) => badgeTile(b, profile))));
  });
}

function chapterStars(chapter, progress, profile) {
  return Math.max(progress[chapter.id]?.stars ?? 0, profile?.completed?.[chapter.id]?.stars ?? 0);
}

function campaignPanel(progress, profile) {
  const total = CAMPAIGN.reduce((sum, c) => sum + chapterStars(c, progress, profile), 0);
  const max = CAMPAIGN.length * MAX_STARS_PER_CHAPTER;
  return h('section', { class: 'panel bdg-campaign', 'aria-labelledby': 'bdg-campaign-title' },
    h('h2', { id: 'bdg-campaign-title', class: 'panel-title mars' }, 'Campaign stars', h('span', { class: 'spacer' }), h('span', { class: 'mono' }, `${total} / ${max} ★`)),
    meter((total / max) * 100, 'var(--gold)', 'Campaign stars earned'),
    h('ol', { class: 'bdg-chapters', role: 'list' }, CAMPAIGN.map((c) => {
      const n = chapterStars(c, progress, profile);
      return h('li', { class: ['bdg-chapter', n > 0 && 'is-done'] },
        h('span', { class: 'bdg-ch-num mono', 'aria-hidden': 'true' }, c.chapter),
        h('div', { class: 'bdg-ch-text' },
          h('strong', null, `Chapter ${c.chapter}: ${c.title}`),
          h('span', { class: ['badge', c.body] }, c.body === 'moon' ? '🌕 Moon' : '🔴 Mars')),
        stars(n, MAX_STARS_PER_CHAPTER),
        h('a', { class: 'btn btn-sm', href: `#/loadout/${encodeURIComponent(c.id)}`, 'aria-label': `${n ? 'Replay' : 'Play'} chapter ${c.chapter}: ${c.title}` }, n ? 'Replay' : 'Play'));
    })));
}

function patchCard(patch) {
  const canvas = h('canvas', { class: 'bdg-patch-canvas', width: PREVIEW_SIZE, height: PREVIEW_SIZE, 'aria-hidden': 'true' });
  paintCanvas(canvas, patch ?? {}, PREVIEW_SIZE);
  return h('a', { class: 'bdg-patch-card', href: '#/patch' },
    canvas,
    h('div', null,
      h('span', { class: 'kicker mars' }, '🧵 Create'),
      h('h2', null, patch ? 'Edit your Mission Patch' : 'Design your Mission Patch'),
      h('p', null, 'Real NASA crews design a patch for every mission. Pick a shape, an emblem and your crew’s names, then print it or save it as a picture.'),
      h('span', { class: 'btn btn-primary' }, 'Open the Patch Designer →')));
}

function view() {
  const { profile, progress, patch } = getState();
  const earned = ACHIEVEMENTS.filter((b) => earnedInfo(profile, b.id)).length;
  const pct = ACHIEVEMENTS.length ? (earned / ACHIEVEMENTS.length) * 100 : 0;
  return [
    h('header', { class: 'screen-head' },
      h('div', null,
        h('span', { class: 'kicker' }, '🏅 Badges'),
        h('h1', null, 'Your mission patches'),
        h('p', null, 'Earn badges by finishing missions, solving science problems and training in the Academy. Locked badges show you how to earn them.')),
      h('div', { class: 'bdg-count' },
        h('strong', { class: 'mono' }, earned), h('span', null, ` of ${ACHIEVEMENTS.length} earned`),
        meter(pct, 'var(--gold)', 'Badges earned'))),
    patchCard(patch),
    h('div', { class: 'bdg-layout' },
      h('div', { class: 'stack' }, ACHIEVEMENTS.length
        ? groupedBadges(profile)
        : h('div', { class: 'panel empty' }, h('span', { class: 'big', 'aria-hidden': 'true' }, '🏅'), h('p', null, 'Badges are being stitched. Check back soon!'))),
      campaignPanel(progress ?? {}, profile)),
  ];
}

export function render(root) {
  awardNewBadges();
  const paint = () => mount(root, view());
  paint();
  return subscribe(paint);
}
