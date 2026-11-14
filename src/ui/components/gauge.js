// Big ring gauge used for AIR, POWER and SHIELDING. Returns an HTML string.
import { escapeHtml, clamp } from '../text.js';

/**
 * @param {{ label: string, fraction: number, center: string, big: string, sub: string, tone?: 'good'|'warn'|'danger' }} g
 */
export function gauge({ label, fraction, center, big, sub, tone = 'good' }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const f = clamp(Number.isFinite(fraction) ? fraction : 1, 0, 1);
  const dash = `${(c * f).toFixed(1)} ${c.toFixed(1)}`;
  return `<div class="card gauge ${tone}" role="group" aria-label="${escapeHtml(label)}: ${escapeHtml(big)}. ${escapeHtml(sub)}">
    <svg viewBox="0 0 110 110" aria-hidden="true">
      <circle class="ring-bg" cx="55" cy="55" r="${r}" fill="none" stroke-width="10"></circle>
      <circle class="ring" cx="55" cy="55" r="${r}" fill="none" stroke-width="10" stroke-dasharray="${dash}" transform="rotate(-90 55 55)"></circle>
      <text class="center" x="55" y="60" text-anchor="middle">${escapeHtml(center)}</text>
    </svg>
    <div>
      <div class="label">${escapeHtml(label)}</div>
      <div class="big">${escapeHtml(big)}</div>
      <div class="sub">${sub}</div>
    </div>
  </div>`;
}

/** Pick a colour tone from how many sols of a supply are left. */
export function toneForSols(sols) {
  if (!Number.isFinite(sols)) return 'good';
  if (sols <= 3) return 'danger';
  if (sols <= 8) return 'warn';
  return 'good';
}

export function toneForPercent(pct) {
  if (pct <= 20) return 'danger';
  if (pct <= 45) return 'warn';
  return 'good';
}
