// A small popover that explains a glossary term where the player tapped it.
import { termById, GLOSSARY } from '../../data/glossary.js';
import { escapeHtml, renderText } from '../text.js';

let popover = null;
let lastAnchor = null;

function getTerm(id) {
  try {
    return termById(id) ?? null;
  } catch {
    return null;
  }
}

function ensureEl() {
  if (popover) return popover;
  popover = document.createElement('div');
  popover.className = 'popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.hidden = true;
  document.body.appendChild(popover);
  return popover;
}

export function closePopover() {
  if (popover) popover.hidden = true;
  if (lastAnchor && document.contains(lastAnchor)) lastAnchor.focus({ preventScroll: true });
  lastAnchor = null;
}

export function openPopover(termId, anchor) {
  const term = getTerm(termId);
  const el = ensureEl();
  lastAnchor = anchor ?? null;
  const name = term?.name ?? String(termId).replace(/-/g, ' ');
  const short = term?.short ?? 'We do not have a definition for this word yet.';
  el.innerHTML = `
    <h3>${escapeHtml(name)}</h3>
    <p>${renderText(short)}</p>
    ${term?.long ? `<div class="long" hidden data-long>${renderText(term.long)}</div>` : ''}
    <div class="row between">
      ${term?.long ? '<button type="button" class="btn small" data-popover-more aria-expanded="false">Tell me more</button>' : '<span></span>'}
      <button type="button" class="btn small" data-popover-close>Close</button>
    </div>`;
  el.hidden = false;
  // Position below the anchor on desktop; CSS pins it to the bottom on phones.
  const rect = anchor?.getBoundingClientRect?.() ?? { left: 16, bottom: 80, top: 80 };
  const width = Math.min(340, window.innerWidth - 32);
  const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
  const spaceBelow = window.innerHeight - rect.bottom;
  el.style.left = `${left}px`;
  el.style.top = spaceBelow > 220 ? `${rect.bottom + 8}px` : `${Math.max(16, rect.top - 8 - 200)}px`;
  el.querySelector('[data-popover-close]')?.focus({ preventScroll: true });
}

/** Attach one delegated listener set for .term buttons and popover controls. */
export function initGlossaryPopover() {
  document.addEventListener('click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const termBtn = target.closest('.term');
    if (termBtn) {
      ev.preventDefault();
      openPopover(termBtn.dataset.term, termBtn);
      return;
    }
    if (target.closest('[data-popover-close]')) {
      closePopover();
      return;
    }
    const more = target.closest('[data-popover-more]');
    if (more && popover) {
      const long = popover.querySelector('[data-long]');
      if (long) {
        long.hidden = !long.hidden;
        more.setAttribute('aria-expanded', String(!long.hidden));
        more.textContent = long.hidden ? 'Tell me more' : 'Show less';
      }
      return;
    }
    if (popover && !popover.hidden && !popover.contains(target)) closePopover();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && popover && !popover.hidden) closePopover();
  });
}

/** Full glossary list for the Glossary tab. */
export function renderGlossaryList() {
  let terms = [];
  try {
    terms = Object.values(GLOSSARY ?? {}).filter(Boolean);
  } catch {
    terms = [];
  }
  terms.sort((a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)));
  if (!terms.length) return '<p class="muted">The glossary is loading or empty.</p>';
  return `<div class="glossary-list">${terms
    .map(
      (t) => `<details id="term-${escapeHtml(t.id)}">
        <summary>${escapeHtml(t.name ?? t.id)}<small class="muted">${escapeHtml(t.source ? 'Source: ' + t.source : '')}</small></summary>
        <p>${renderText(t.short ?? '')}</p>
        ${t.long ? `<p class="muted">${renderText(t.long)}</p>` : ''}
      </details>`,
    )
    .join('')}</div>`;
}
