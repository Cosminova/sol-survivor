// Mastery by category: engine masteryByCategory() when available, else computed from local tallies
// (a term counts fully when known in flashcards or answered correctly, a quarter when only viewed).
import { s, h, prefersReducedMotion } from '../../dom.js';
import { CATEGORIES, GLOSSARY } from '../../../data/glossary.js';
import { call } from '../../../state/learn.js';
import { isKnown, isViewed } from './profile.js';

const RING_COLORS = ['var(--cyan)', 'var(--mars)', 'var(--gold)', 'var(--good)', 'var(--violet)', 'var(--o2)', 'var(--rad)', 'var(--food)', 'var(--moon)', 'var(--power)'];

function toPct(value) {
  let v = value;
  if (v && typeof v === 'object') {
    v = v.pct ?? v.percent ?? v.mastery ?? v.score ?? v.value
      ?? (v.total ? (v.correct ?? v.mastered ?? v.known ?? 0) / v.total : null);
  }
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  const pct = v <= 1 ? v * 100 : v;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function normalizeEngine(result) {
  if (!result) return null;
  const entries = Array.isArray(result)
    ? result.map((r) => [r.category ?? r.id, r])
    : Object.entries(result);
  const map = {};
  entries.forEach(([id, v]) => {
    const pct = toPct(v);
    if (id && pct != null) map[id] = pct;
  });
  return Object.keys(map).length ? map : null;
}

function correctTerms(profile) {
  const quiz = profile?.quiz && typeof profile.quiz === 'object' ? profile.quiz : {};
  return new Set(Object.values(quiz).filter((r) => r && r.correct > 0 && r.term).map((r) => r.term));
}

function localMastery(profile) {
  const right = correctTerms(profile);
  const map = {};
  Object.keys(CATEGORIES).forEach((cat) => {
    const terms = GLOSSARY.filter((t) => t.category === cat);
    const points = terms.reduce((sum, t) => {
      if (right.has(t.id) || isKnown(profile, t.id)) return sum + 1;
      return sum + (isViewed(profile, t.id) ? 0.25 : 0);
    }, 0);
    map[cat] = terms.length ? Math.round((points / terms.length) * 100) : 0;
  });
  return map;
}

export function masteryList(profile) {
  const engine = normalizeEngine(call('masteryByCategory', [profile], () => null));
  const map = engine ?? localMastery(profile);
  return Object.entries(CATEGORIES).map(([id, cat], i) => ({
    id, label: cat.label, icon: cat.icon, pct: map[id] ?? 0, color: RING_COLORS[i % RING_COLORS.length],
  }));
}

const R = 42;
const CIRC = 2 * Math.PI * R;

export function masteryRing({ label, icon, pct, color }) {
  const arc = s('circle', {
    class: 'acad-ring-arc', cx: 50, cy: 50, r: R,
    'stroke-dasharray': CIRC.toFixed(2),
    'stroke-dashoffset': (prefersReducedMotion() ? CIRC * (1 - pct / 100) : CIRC).toFixed(2),
  });
  if (!prefersReducedMotion()) {
    requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute('stroke-dashoffset', (CIRC * (1 - pct / 100)).toFixed(2))));
  }
  return h('li', { class: ['acad-ring', pct >= 100 && 'is-max'], style: { '--ring': color } },
    h('div', { class: 'acad-ring-dial', role: 'img', 'aria-label': `${label}: ${pct}% mastered` },
      s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        s('circle', { class: 'acad-ring-track', cx: 50, cy: 50, r: R }),
        arc),
      h('span', { class: 'acad-ring-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'acad-ring-pct', 'aria-hidden': 'true' }, `${pct}%`)),
    h('span', { class: 'acad-ring-label' }, label));
}

export function masteryRings(profile) {
  const list = masteryList(profile);
  const avg = list.length ? Math.round(list.reduce((sum, m) => sum + m.pct, 0) / list.length) : 0;
  return { avg, el: h('ul', { class: 'acad-rings', role: 'list' }, list.map(masteryRing)) };
}
