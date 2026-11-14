// Small building blocks shared by the Data Lab sections.
import { h, mount } from '../../dom.js';
import { loadingState } from '../../components/common.js';

const NUMBER = new Intl.NumberFormat('en-US');
const DATE = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });

export const fmtNum = (n) => (Number.isFinite(n) ? NUMBER.format(n) : '–');

export function fmtDate(iso) {
  const t = Date.parse(iso?.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isFinite(t) ? DATE.format(new Date(t)) : '–';
}

export function fmtMonth(yyyyMm) {
  const t = Date.parse(`${yyyyMm}-15T12:00:00Z`);
  return Number.isFinite(t) ? MONTH.format(new Date(t)) : yyyyMm;
}

export const signed = (n) => (n > 0 ? `+${n}` : String(n));

export function statCard({ icon, label, value, detail, tone = 'cyan' }) {
  return h('div', { class: ['dl-stat', `dl-tone-${tone}`] },
    h('span', { class: 'dl-stat-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'dl-stat-label' }, label),
    h('strong', { class: 'dl-stat-value' }, value),
    detail ? h('span', { class: 'dl-stat-detail' }, detail) : null);
}

export const statGrid = (cards) => h('div', { class: 'dl-stats' }, cards);

export function sectionHead({ kicker, title, intro, tone }) {
  return h('header', { class: 'dl-section-head' },
    h('span', { class: ['kicker', tone === 'mars' && 'mars'] }, kicker),
    h('h2', null, title),
    intro ? h('p', { class: 'muted' }, intro) : null);
}

// "What am I looking at?" caption under a chart.
export function caption(icon, ...children) {
  return h('p', { class: 'dl-caption' }, h('span', { class: 'dl-caption-icon', 'aria-hidden': 'true' }, icon), h('span', null, children));
}

export function errorPanel(message, onRetry) {
  return h('div', { class: 'panel empty dl-error', role: 'alert' },
    h('span', { class: 'big', 'aria-hidden': 'true' }, '📡'),
    h('strong', null, 'Lost the signal to this dataset.'),
    h('p', { class: 'muted' }, message, ' The rest of the Data Lab still works.'),
    onRetry ? h('button', { type: 'button', class: 'btn btn-cyan', onclick: onRetry }, 'Try again') : null);
}

// Shows loadingState, awaits loader(), then mounts build(data). Ignores results after cleanup.
export function withData(container, { loader, message, build }) {
  let alive = true;
  let innerCleanup = null;
  const run = () => {
    mount(container, loadingState(message));
    loader()
      .then((data) => {
        if (!alive) return;
        const built = build(data);
        innerCleanup = typeof built?.cleanup === 'function' ? built.cleanup : null;
        mount(container, built?.node ?? built);
      })
      .catch((err) => {
        if (!alive) return;
        console.error('[datalab] dataset failed to load', err);
        mount(container, errorPanel(err?.message ?? 'Unknown error.', run));
      });
  };
  run();
  return () => {
    alive = false;
    innerCleanup?.();
  };
}
