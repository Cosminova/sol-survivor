// Flashcard trainer for the Dictionary: 3D flip card, "I know it" / "Again" queue, keyboard shortcuts.
import { h, mount, announce, prefersReducedMotion } from '../../dom.js';
import { GLOSSARY, CATEGORIES, termById } from '../../../data/glossary.js';
import { call } from '../../../state/learn.js';
import { speak, canSpeak } from '../../speech.js';
import { play } from '../../audio.js';
import { currentProfile, isKnown, markFlashcard, markViewed } from './profile.js';

const CONFETTI = ['⭐', '🚀', '🪐', '✨', '🌕', '🛰️'];

function toTerm(entry) {
  if (typeof entry === 'string') return termById(entry);
  if (entry && typeof entry === 'object') return entry.def ? entry : termById(entry.id ?? entry.term);
  return null;
}

// Engine deck if available; otherwise the category's terms with not-yet-known cards first.
export function buildDeck(category) {
  const profile = currentProfile();
  const cat = category === 'all' ? undefined : category;
  const engine = call('flashcardDeck', [profile, cat], () => null);
  const list = Array.isArray(engine) ? engine.map(toTerm).filter(Boolean) : [];
  if (list.length) return list;
  const terms = GLOSSARY.filter((t) => !cat || t.category === cat);
  return [...terms.filter((t) => !isKnown(profile, t.id)), ...terms.filter((t) => isKnown(profile, t.id))];
}

function face(side, term) {
  const cat = CATEGORIES[term.category];
  if (side === 'front') {
    return h('span', { class: 'flash-face flash-front', 'aria-hidden': 'true' },
      h('span', { class: 'flash-cat' }, cat ? `${cat.icon} ${cat.label}` : ''),
      h('span', { class: 'flash-icon' }, cat?.icon ?? '🛰️'),
      h('span', { class: 'flash-term' }, term.term),
      h('span', { class: 'flash-tip' }, 'Tap or press Space to flip'));
  }
  return h('span', { class: 'flash-face flash-back', 'aria-hidden': 'true' },
    h('span', { class: 'flash-cat' }, term.term),
    h('span', { class: 'flash-def' }, term.def),
    term.example ? h('span', { class: 'flash-example' }, h('strong', null, 'Example: '), term.example) : null);
}

function celebrate(container) {
  if (prefersReducedMotion()) return null;
  return h('div', { class: 'flash-confetti', 'aria-hidden': 'true' },
    Array.from({ length: 18 }, (_, i) => h('span', {
      style: { '--x': `${(i * 37) % 100}%`, '--d': `${(i % 6) * 0.12}s`, '--r': `${(i * 47) % 360}deg` },
    }, CONFETTI[i % CONFETTI.length])));
}

// renderFlashcards(container, { category, onExit }) -> cleanup
export function renderFlashcards(container, { category = 'all', onExit } = {}) {
  const deck = buildDeck(category);
  let queue = deck.map((t) => t.id);
  let known = 0;
  let flipped = false;

  const catLabel = category === 'all' ? 'All topics' : CATEGORIES[category]?.label ?? category;

  const progress = () => h('div', { class: 'flash-progress' },
    h('div', { class: 'row between' },
      h('span', { class: 'kicker' }, `🃏 ${catLabel} deck`),
      h('span', { class: 'mono' }, `${known} / ${deck.length} learned`)),
    h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': deck.length, 'aria-valuenow': known, 'aria-label': 'Cards learned', style: { '--pct': `${deck.length ? (known / deck.length) * 100 : 0}%`, '--meter-color': 'var(--good)' } }, h('span')));

  function flip() {
    const card = container.querySelector('.flash-card');
    if (!card) return;
    flipped = !flipped;
    card.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    const term = termById(queue[0]);
    card.setAttribute('aria-label', flipped ? `${term.term}: ${term.def}` : `${term.term}. Press to see the definition.`);
    if (flipped) { markViewed(term.id); announce(term.def); }
    play('click');
  }

  function rotate(step) {
    if (queue.length < 2) return;
    queue = step > 0 ? [...queue.slice(1), queue[0]] : [queue[queue.length - 1], ...queue.slice(0, -1)];
    show();
  }

  function answer(isKnownNow) {
    const id = queue[0];
    markFlashcard(id, isKnownNow);
    if (isKnownNow) {
      known += 1;
      queue = queue.slice(1);
      play('good');
    } else {
      queue = [...queue.slice(1), id];
    }
    if (queue.length) show(); else done();
  }

  function done() {
    play('win');
    mount(container,
      progress(),
      h('section', { class: 'flash-done panel', 'aria-labelledby': 'flash-done-title' },
        celebrate(container),
        h('div', { class: 'flash-done-icon', 'aria-hidden': 'true' }, '🏅'),
        h('h2', { id: 'flash-done-title', tabindex: '-1' }, 'Deck complete!'),
        h('p', null, `You learned all ${deck.length} words in the ${catLabel} deck. Mission Control is proud of you!`),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => restart() }, '↺ Study again'),
          h('a', { class: 'btn btn-cyan', href: '#/academy' }, '🎓 Take a quiz'),
          onExit ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: onExit }, '📖 Back to the word list') : null)));
    announce(`Deck complete! You learned all ${deck.length} words.`);
    container.querySelector('#flash-done-title')?.focus();
  }

  function show() {
    flipped = false;
    const term = termById(queue[0]);
    const card = h('button', {
      type: 'button', class: 'flash-card', 'aria-pressed': 'false',
      'aria-label': `${term.term}. Press to see the definition.`, onclick: flip,
    }, h('span', { class: 'flash-inner' }, face('front', term), face('back', term)));
    mount(container,
      progress(),
      h('div', { class: 'flash-stage' },
        h('button', { type: 'button', class: 'btn btn-icon flash-nav', 'aria-label': 'Previous card', onclick: () => rotate(-1), disabled: queue.length < 2 }, '←'),
        h('div', { class: 'flash-scene' }, card),
        h('button', { type: 'button', class: 'btn btn-icon flash-nav', 'aria-label': 'Next card', onclick: () => rotate(1), disabled: queue.length < 2 }, '→')),
      h('div', { class: 'row flash-actions' },
        h('button', { type: 'button', class: 'btn btn-lg flash-again', onclick: () => answer(false) }, '↺ Again'),
        canSpeak() ? h('button', { type: 'button', class: 'btn btn-lg btn-ghost', 'aria-label': `Read ${term.term} aloud`, onclick: () => speak(`${term.term}. ${term.def}`, true) }, '🔊') : null,
        h('button', { type: 'button', class: 'btn btn-lg flash-know', onclick: () => answer(true) }, 'I know it ✓')),
      h('p', { class: 'faint center flash-keys' }, `${queue.length} card${queue.length === 1 ? '' : 's'} left · Space/Enter flip · ← → move · K know it · J again`));
    card.focus({ preventScroll: true });
  }

  function restart() {
    queue = deck.map((t) => t.id);
    known = 0;
    show();
  }

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !container.querySelector('.flash-card')) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, .popover, .modal')) return;
    const onOtherButton = t.closest?.('button, a') && !t.classList?.contains('flash-card');
    const key = e.key.toLowerCase();
    if ((key === ' ' || key === 'enter') && !onOtherButton && !t.classList?.contains('flash-card')) {
      e.preventDefault();
      flip();
    } else if (key === 'arrowright') { e.preventDefault(); rotate(1); }
    else if (key === 'arrowleft') { e.preventDefault(); rotate(-1); }
    else if (key === 'k') { e.preventDefault(); answer(true); }
    else if (key === 'j') { e.preventDefault(); answer(false); }
  };

  document.addEventListener('keydown', onKey);
  if (deck.length) show();
  else mount(container, h('div', { class: 'empty' }, h('span', { class: 'big' }, '🃏'), h('p', null, 'No cards in this deck yet.')));
  return () => document.removeEventListener('keydown', onKey);
}
