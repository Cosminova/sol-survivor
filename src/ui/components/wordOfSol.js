// "Word of the Sol" card: one glossary term per day, chosen by the learning engine (or by date).
import { h } from '../dom.js';
import { GLOSSARY, termById, CATEGORIES } from '../../data/glossary.js';
import { call } from '../../state/learn.js';
import { openTermPopover } from './termPopover.js';
import { speak, canSpeak } from '../speech.js';

export function wordOfTheSol(date = new Date()) {
  const fallback = () => GLOSSARY[Math.floor(date.getTime() / 864e5) % GLOSSARY.length];
  const result = call('wordOfTheSol', [date], fallback);
  if (typeof result === 'string') return termById(result) ?? fallback();
  if (result?.term && result?.def) return result;
  if (result?.id) return termById(result.id) ?? fallback();
  return fallback();
}

export function wordOfSolCard({ compact = false } = {}) {
  const term = wordOfTheSol();
  const cat = CATEGORIES[term.category];
  return h('section', { class: ['panel', 'wos-card', compact && 'compact'], 'aria-label': 'Word of the Sol' },
    h('h2', { class: 'panel-title' }, 'Word of the Sol'),
    h('p', { class: 'wos-cat' }, cat ? `${cat.icon} ${cat.label}` : ''),
    h('p', { class: 'wos-term' }, term.term),
    h('p', { class: 'wos-def' }, term.def),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-sm btn-cyan', onclick: (e) => openTermPopover(term.id, e.currentTarget) }, 'Learn more'),
      canSpeak() ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => speak(`${term.term}. ${term.def}`, true) }, '🔊 Hear it') : null,
      h('a', { class: 'btn btn-sm btn-ghost', href: '#/dictionary' }, 'All words →')));
}
