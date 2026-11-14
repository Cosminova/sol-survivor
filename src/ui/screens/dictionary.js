// Astronaut Dictionary: Word of the Sol, live search, category filters, term cards and flashcard mode.
import '../../styles/learn.css';
import { h, mount, announce, prefersReducedMotion } from '../dom.js';
import { GLOSSARY, CATEGORIES, termById, searchGlossary } from '../../data/glossary.js';
import { call } from '../../state/learn.js';
import { speak, canSpeak } from '../speech.js';
import { didYouKnow } from '../components/common.js';
import { currentProfile, isViewed, isKnown, markViewed } from './learn/profile.js';
import { renderFlashcards } from './learn/flashcards.js';

const DAY_MS = 86400000;

function wordOfTheSol(date = new Date()) {
  const fallback = () => {
    const day = Math.floor(date.getTime() / DAY_MS);
    return GLOSSARY[(day * 37) % GLOSSARY.length];
  };
  const result = call('wordOfTheSol', [date], fallback);
  const term = typeof result === 'string' ? termById(result) : result?.def ? result : termById(result?.id);
  return term ?? fallback();
}

function speakButton(term, label = `Read ${term.term} aloud`) {
  if (!canSpeak()) return null;
  return h('button', {
    type: 'button', class: 'btn btn-ghost btn-icon dict-speak', 'aria-label': label,
    onclick: () => { speak(`${term.term}. ${term.def} ${term.example ?? ''}`, true); markViewed(term.id); },
  }, '🔊');
}

function wordOfSolCard(term, onOpen) {
  const cat = CATEGORIES[term.category];
  return h('section', { class: 'dict-wos', 'aria-labelledby': 'dict-wos-term' },
    h('div', { class: 'dict-wos-glow', 'aria-hidden': 'true' }),
    h('span', { class: 'kicker mars' }, '☀️ Word of the Sol'),
    h('div', { class: 'dict-wos-head' },
      h('h2', { id: 'dict-wos-term', class: 'dict-wos-term' }, term.term),
      speakButton(term)),
    cat ? h('span', { class: 'badge' }, `${cat.icon} ${cat.label}`) : null,
    h('p', { class: 'dict-wos-def' }, term.def),
    term.example ? h('p', { class: 'dict-example' }, h('strong', null, 'Example: '), term.example) : null,
    h('button', { type: 'button', class: 'btn btn-sm btn-cyan', onclick: () => onOpen(term.id) }, 'Find it in the list ↓'));
}

function statsCard(onFlashcards) {
  const profile = currentProfile();
  const viewed = GLOSSARY.filter((t) => isViewed(profile, t.id)).length;
  const known = GLOSSARY.filter((t) => isKnown(profile, t.id)).length;
  const pct = Math.round((viewed / GLOSSARY.length) * 100);
  return h('section', { class: 'dict-stats panel', 'aria-label': 'Your dictionary progress' },
    h('h2', { class: 'panel-title' }, 'Your word log'),
    h('p', { class: 'dict-stat-big' }, h('strong', { class: 'mono' }, viewed), ` of ${GLOSSARY.length} words explored`),
    h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': 'Words explored', style: { '--pct': `${pct}%`, '--meter-color': 'var(--cyan)' } }, h('span')),
    h('p', { class: 'muted' }, `🃏 ${known} flashcard${known === 1 ? '' : 's'} mastered`),
    h('button', { type: 'button', class: 'btn btn-primary', onclick: onFlashcards }, '🃏 Practice with flashcards'));
}

function termCard(term, { expanded, onToggle, onJump }) {
  const cat = CATEGORIES[term.category];
  const seen = isViewed(currentProfile(), term.id);
  const extraId = `dict-extra-${term.id}`;
  const related = (term.related ?? []).map(termById).filter(Boolean);
  return h('article', { class: ['dict-card', seen && 'is-seen', expanded && 'is-open'], id: `term-${term.id}`, dataset: { term: term.id }, 'aria-labelledby': `dict-h-${term.id}` },
    h('div', { class: 'dict-card-top' },
      h('span', { class: 'dict-cat' }, h('span', { 'aria-hidden': 'true' }, cat?.icon ?? '🛰️'), ` ${cat?.label ?? ''}`),
      seen ? h('span', { class: 'dict-seen', title: 'You have explored this word' }, '✓', h('span', { class: 'sr-only' }, ' Explored')) : null),
    h('div', { class: 'dict-card-head' },
      h('h3', { id: `dict-h-${term.id}`, tabindex: '-1' }, term.term),
      speakButton(term)),
    h('p', { class: 'dict-def' }, term.def),
    (term.example || related.length) ? h('button', {
      type: 'button', class: 'dict-more', 'aria-expanded': String(expanded), 'aria-controls': extraId,
      onclick: () => onToggle(term.id),
    }, expanded ? 'Hide example & related ▴' : 'Example & related words ▾') : null,
    h('div', { class: 'dict-extra', id: extraId, hidden: !expanded },
      term.example ? h('p', { class: 'dict-example' }, h('strong', null, 'Example: '), term.example) : null,
      related.length ? h('div', { class: 'dict-related', role: 'group', 'aria-label': `Words related to ${term.term}` },
        h('span', { class: 'faint' }, 'Related:'),
        related.map((r) => h('button', { type: 'button', class: 'chip', onclick: () => onJump(r.id) }, r.term))) : null));
}

function categoryChips(active, onPick) {
  const chip = (id, label, icon) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(active === id), onclick: () => onPick(id),
  }, h('span', { 'aria-hidden': 'true' }, icon), label);
  return h('div', { class: 'row dict-cats', role: 'group', 'aria-label': 'Filter by topic' },
    chip('all', 'All', '✨'),
    Object.entries(CATEGORIES).map(([id, c]) => chip(id, c.label, c.icon)));
}

export function render(root, route) {
  const st = {
    query: '',
    category: CATEGORIES[route.query?.category] ? route.query.category : 'all',
    mode: route.query?.mode === 'flashcards' ? 'cards' : 'list',
    expanded: new Set(),
  };
  let stopCards = null;
  let timer = null;

  const statsSlot = h('div');
  const chipsSlot = h('div');
  const countEl = h('p', { class: 'dict-count faint', 'aria-live': 'polite' });
  const body = h('div', { class: 'dict-body' });
  const search = h('input', {
    class: 'input dict-search', type: 'search', id: 'dict-search', placeholder: 'Try “sol”, “dust” or “oxygen”…',
    autocomplete: 'off', oninput: (e) => { st.query = e.target.value; renderBody(); },
  });
  const searchField = h('label', { class: 'field dict-search-field', for: 'dict-search' }, h('span', null, '🔎 Search the dictionary'), search);
  const modeBtn = (mode, label) => h('button', { type: 'button', class: 'chip dict-mode', 'aria-pressed': String(st.mode === mode), dataset: { mode }, onclick: () => setMode(mode) }, label);
  const modeTabs = h('div', { class: 'tabs dict-modes', role: 'group', 'aria-label': 'View' }, modeBtn('list', '📖 Word list'), modeBtn('cards', '🃏 Flashcards'));

  const refreshStats = () => mount(statsSlot, statsCard(() => setMode('cards')));

  function cardOpts() {
    return { expanded: false, onToggle: toggle, onJump: jumpTo };
  }

  function replaceCard(id) {
    const old = body.querySelector(`#term-${CSS.escape(id)}`);
    const term = termById(id);
    if (old && term) old.replaceWith(termCard(term, { ...cardOpts(), expanded: st.expanded.has(id) }));
  }

  function toggle(id) {
    st.expanded = new Set(st.expanded.has(id) ? [...st.expanded].filter((x) => x !== id) : [...st.expanded, id]);
    markViewed(id);
    replaceCard(id);
    refreshStats();
    body.querySelector(`#term-${CSS.escape(id)} .dict-more`)?.focus();
  }

  function renderBody() {
    stopCards?.();
    stopCards = null;
    searchField.hidden = st.mode !== 'list';
    if (st.mode === 'cards') {
      countEl.textContent = '';
      stopCards = renderFlashcards(body, { category: st.category, onExit: () => setMode('list') });
      return;
    }
    const list = searchGlossary(st.query, st.category);
    countEl.textContent = `Showing ${list.length} of ${GLOSSARY.length} words`;
    mount(body, list.length
      ? h('div', { class: 'dict-grid' }, list.map((t) => termCard(t, { ...cardOpts(), expanded: st.expanded.has(t.id) })))
      : h('div', { class: 'empty panel' }, h('span', { class: 'big', 'aria-hidden': 'true' }, '🔭'),
        h('p', null, `No words match “${st.query}”. Try a shorter search or another topic.`)));
  }

  function renderChips() {
    mount(chipsSlot, categoryChips(st.category, (id) => { st.category = id; renderChips(); renderBody(); }));
  }

  function setMode(mode) {
    st.mode = mode;
    modeTabs.querySelectorAll('.dict-mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    renderBody();
    refreshStats();
    if (mode === 'list') search.focus();
    announce(mode === 'cards' ? 'Flashcard mode' : 'Word list');
  }

  function jumpTo(id) {
    const term = termById(id);
    if (!term) return;
    const visible = st.mode === 'list' && searchGlossary(st.query, st.category).some((t) => t.id === id);
    if (!visible) {
      st.mode = 'list';
      st.query = '';
      search.value = '';
      st.category = 'all';
      modeTabs.querySelectorAll('.dict-mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === 'list')));
      renderChips();
    }
    st.expanded = new Set([...st.expanded, id]);
    markViewed(id);
    renderBody();
    refreshStats();
    const card = body.querySelector(`#term-${CSS.escape(id)}`);
    if (!card) return;
    card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    card.classList.remove('is-pulse');
    void card.offsetWidth;
    card.classList.add('is-pulse');
    card.querySelector('h3')?.focus({ preventScroll: true });
    announce(`${term.term}: ${term.def}`);
  }

  const wos = wordOfTheSol();
  mount(root,
    h('header', { class: 'screen-head' },
      h('div', null,
        h('span', { class: 'kicker' }, '📖 Astronaut Dictionary'),
        h('h1', null, 'Speak like Mission Control'),
        h('p', null, 'Every word an astronaut needs to survive on Mars and the Moon. Tap 🔊 to hear any word read aloud.'))),
    h('div', { class: 'dict-hero' }, wordOfSolCard(wos, jumpTo), statsSlot),
    h('section', { class: 'panel dict-toolbar', 'aria-label': 'Search and filter' },
      h('div', { class: 'dict-toolbar-row' }, modeTabs, searchField),
      chipsSlot),
    countEl,
    body,
    h('div', { class: 'dict-dyk' }, didYouKnow()));

  refreshStats();
  renderChips();
  renderBody();

  if (route.query?.term && termById(route.query.term)) {
    timer = setTimeout(() => jumpTo(route.query.term), 120);
  }

  return () => { stopCards?.(); clearTimeout(timer); };
}
