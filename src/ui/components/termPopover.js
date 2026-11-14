// Definition popover for [[term]] chips: definition, example, related terms, read-aloud.
import { h } from '../dom.js';
import { termById, CATEGORIES } from '../../data/glossary.js';
import { getState, setProfile } from '../../state/store.js';
import { call } from '../../state/learn.js';
import { speak, canSpeak } from '../speech.js';
import { trapFocus } from './modal.js';

let current = null;

export function closeTermPopover() {
  if (!current) return;
  const { el, anchor, onKey, onDown } = current;
  document.removeEventListener('keydown', onKey, true);
  document.removeEventListener('pointerdown', onDown, true);
  el.remove();
  current = null;
  if (anchor && document.contains(anchor)) anchor.focus();
}

function position(el, anchor) {
  const pad = 12;
  const rect = anchor?.getBoundingClientRect?.() ?? { left: innerWidth / 2, bottom: innerHeight / 3, top: innerHeight / 3, width: 0 };
  const box = el.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - box.width / 2;
  left = Math.max(pad, Math.min(innerWidth - box.width - pad, left));
  let top = rect.bottom + 8;
  if (top + box.height > innerHeight - pad) top = Math.max(pad, rect.top - box.height - 8);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function markViewed(id) {
  const { profile } = getState();
  const next = call('markTermViewed', [profile, id], () => profile);
  if (next === profile) return;
  setProfile(next);
  import('../screens/learn/profile.js')
    .then((m) => m.awardNewBadges())
    .catch((err) => console.warn('[termPopover] badge check failed', err));
}

function content(term, show, close) {
  const cat = CATEGORIES[term.category];
  return [
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon modal-close', 'aria-label': 'Close definition', onclick: close }, '✕'),
    h('span', { class: 'kicker' }, cat ? `${cat.icon} ${cat.label}` : 'Astronaut Dictionary'),
    h('h3', { id: 'term-pop-title' }, term.term),
    h('p', null, term.def),
    term.example ? h('p', { class: 'example' }, h('strong', null, 'Example: '), term.example) : null,
    term.related?.length
      ? h('div', { class: 'related', 'aria-label': 'Related terms' },
        term.related.map((rid) => {
          const r = termById(rid);
          return r ? h('button', { type: 'button', class: 'chip', onclick: () => show(rid) }, r.term) : null;
        }))
      : null,
    h('div', { class: 'row', style: { marginTop: '0.8rem' } },
      canSpeak() ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => speak(`${term.term}. ${term.def} ${term.example ?? ''}`, true) }, '🔊 Read aloud') : null,
      h('a', { class: 'btn btn-sm btn-ghost', href: `#/dictionary?term=${encodeURIComponent(term.id)}`, onclick: close }, '📖 Open in Dictionary')),
  ];
}

export function openTermPopover(termId, anchor) {
  const term = termById(termId);
  if (!term) return;
  const reopenAnchor = current?.anchor ?? anchor;
  closeTermPopover();

  const el = h('div', { class: 'popover', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'term-pop-title' });
  const show = (id) => {
    const t = termById(id);
    if (!t) return;
    el.replaceChildren(...content(t, show, closeTermPopover).filter(Boolean));
    markViewed(id);
    requestAnimationFrame(() => {
      position(el, reopenAnchor);
      el.querySelector('h3')?.setAttribute('tabindex', '-1');
      el.querySelector('h3')?.focus();
    });
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeTermPopover();
    } else {
      trapFocus(el, e);
    }
  };
  const onDown = (e) => {
    if (!el.contains(e.target) && e.target !== reopenAnchor) closeTermPopover();
  };
  document.body.append(el);
  current = { el, anchor: reopenAnchor, onKey, onDown };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onDown, true);
  show(termId);
}
