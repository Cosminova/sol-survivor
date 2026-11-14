// Shared card frame and formatting helpers for the Mission Tools screen.
import { h } from '../../dom.js';

const NUM = (digits) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const DATE = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export const fmt = (n, digits = 0) => (Number.isFinite(n) ? NUM(digits).format(n) : '–');
export const fmtDate = (date) => (date instanceof Date && Number.isFinite(date.getTime()) ? DATE.format(date) : '–');
export const DAY_MS = 864e5;

export function minSec(seconds) {
  if (!Number.isFinite(seconds)) return '–';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
}

// Parses an <input type="date"> value as noon UTC so time zones never shift the day.
export function parseDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

export const toDateInput = (date) => date.toISOString().slice(0, 10);

export function toolCard({ id, icon, kicker, title, tone = 'cyan', wide = false, footer, children }) {
  return h('article', { class: ['panel', 'tools-card', `tools-tone-${tone}`, wide && 'tools-wide'], 'aria-labelledby': `${id}-title` },
    h('header', { class: 'tools-card-head' },
      h('span', { class: 'tools-card-icon', 'aria-hidden': 'true' }, icon),
      h('div', null,
        h('span', { class: ['kicker', tone === 'mars' && 'mars'] }, kicker),
        h('h2', { id: `${id}-title` }, title))),
    h('div', { class: 'tools-card-body' }, children),
    footer ? h('footer', { class: 'tools-card-foot' }, footer) : null);
}

export function readout(label, valueNode, { big = false, tone } = {}) {
  return h('div', { class: ['tools-readout', big && 'tools-readout-big', tone && `tools-text-${tone}`] },
    h('span', { class: 'tools-readout-label' }, label),
    h('strong', { class: 'tools-readout-value' }, valueNode));
}
