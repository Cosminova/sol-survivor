// Small shared widgets: source badge, "Did you know?" card, toasts, stars, meters.
import { h } from '../dom.js';
import { SOURCES } from '../../data/sources.js';
import { randomFact } from '../../state/learn.js';
import { openTermPopover } from './termPopover.js';
import { termById } from '../../data/glossary.js';

export function sourceBadge(id, { label = 'Archived NASA data' } = {}) {
  const src = SOURCES[id];
  if (!src) return null;
  return h('a', {
    class: 'source-badge',
    href: src.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    title: `${src.title} (${src.org})`,
  }, h('span', { 'aria-hidden': 'true' }, '🛰️'), `${label}: ${src.org.split(',')[0]}`, h('span', { class: 'sr-only' }, ' (opens in a new tab)'));
}

export function termButton(id, label) {
  const t = termById(id);
  if (!t) return null;
  return h('button', { type: 'button', class: 'term-chip', 'aria-haspopup': 'dialog', onclick: (e) => openTermPopover(id, e.currentTarget) }, label ?? t.term);
}

export function didYouKnow(fact = randomFact()) {
  if (!fact) return null;
  return h('aside', { class: 'dyk', 'aria-label': 'Did you know?' },
    h('span', { class: 'dyk-icon', 'aria-hidden': 'true' }, '💡'),
    h('div', null,
      h('strong', null, 'Did you know?'),
      h('p', null, fact.text),
      h('div', { class: 'row' }, fact.term ? termButton(fact.term) : null, fact.source ? sourceBadge(fact.source, { label: 'Source' }) : null)));
}

export function loadingState(message = 'Downloading telemetry…') {
  return h('div', { class: 'stack', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'loading-line', 'aria-hidden': 'true' }),
    h('p', { class: 'muted center' }, message),
    didYouKnow());
}

export function stars(count, max = 3, { size = '1.4rem', animate = false } = {}) {
  return h('span', { class: ['stars', animate && 'stars-animate'], role: 'img', 'aria-label': `${count} of ${max} stars`, style: { fontSize: size } },
    Array.from({ length: max }, (_, i) => h('span', { class: i < count ? 'star on' : 'star', style: { '--i': i }, 'aria-hidden': 'true' }, '★')));
}

export function meter(pct, color, label) {
  const clamped = Math.max(0, Math.min(100, pct));
  return h('div', { class: 'meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(clamped), 'aria-label': label, style: { '--pct': `${clamped}%`, '--meter-color': color } }, h('span'));
}

function toastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = h('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' });
    document.body.append(stack);
  }
  return stack;
}

export function toast(text, { icon = '📡', kind = '', ms = 4200 } = {}) {
  const el = h('div', { class: ['toast', kind] }, h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, icon), h('div', null, text));
  toastStack().append(el);
  setTimeout(() => el.remove(), ms);
}

export const badgeToast = (badge) => toast(h('span', null, h('strong', null, 'Badge earned! '), `${badge.icon ?? '🏅'} ${badge.title}`), { icon: '🏅', kind: 'badge-toast', ms: 5200 });
