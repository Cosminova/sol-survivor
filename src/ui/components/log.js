// The mission log feed. Entries come from state.lastSol.log, accumulated per sol by the app store.
import { escapeHtml, renderText } from '../text.js';

const KINDS = new Set(['info', 'good', 'warn', 'danger']);

/**
 * @param {Array<{ sol: number, kind?: string, text?: string, source?: string }>} entries newest first
 */
export function renderLog(entries) {
  if (!entries?.length) return '<p class="muted">Nothing has happened yet. Press "Next Sol" to begin.</p>';
  return `<div class="log" role="log" aria-label="Mission log">${entries
    .map((e) => {
      const kind = KINDS.has(e.kind) ? e.kind : 'info';
      const badge = e.source ? `<span data-badge="${escapeHtml(e.source)}"></span>` : '';
      return `<div class="log-item ${kind}"><span class="body"><span class="sol-tag">Sol ${escapeHtml(e.sol ?? '?')}</span>${renderText(e.text ?? '')} ${badge}</span></div>`;
    })
    .join('')}</div>`;
}

/** Flatten lastSol.log into store history entries, newest first. */
export function logEntriesFromSol(sol, lastSol) {
  const items = Array.isArray(lastSol?.log) ? lastSol.log : [];
  return items.map((it) => ({ sol, kind: it?.kind ?? 'info', text: it?.text ?? '', source: it?.source }));
}
