// Text helpers: HTML escaping and the [[term]] / [[term|label]] glossary link renderer.
import { termById } from '../data/glossary.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeTerm(id) {
  try {
    return termById(id) ?? null;
  } catch {
    return null;
  }
}

/** Render a string containing [[term]] links into safe HTML with tappable glossary buttons. */
export function renderText(text) {
  const src = String(text ?? '');
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let out = '';
  let last = 0;
  let match;
  while ((match = re.exec(src)) !== null) {
    out += escapeHtml(src.slice(last, match.index));
    const id = match[1].trim();
    const term = safeTerm(id);
    const label = match[2]?.trim() ?? term?.name ?? id.replace(/-/g, ' ');
    if (term) {
      out += `<button type="button" class="term" data-term="${escapeHtml(id)}" aria-label="${escapeHtml(label)}: what does this mean?">${escapeHtml(label)}</button>`;
    } else {
      out += escapeHtml(label);
    }
    last = re.lastIndex;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

export function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return '–';
  if (!Number.isFinite(n)) return '∞';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
