// Event card modal: the heart of "no choice is free". Every choice shows its cost before you commit.
import { describeEffects } from '../../engine/mission.js';
import { escapeHtml, renderText } from '../text.js';

function safeDescribe(effects, state) {
  try {
    const lines = describeEffects(effects ?? {}, state);
    return Array.isArray(lines) ? lines : [];
  } catch {
    return [];
  }
}

function costLine(line) {
  const s = String(line);
  const bad = /[−-]\s?\d/.test(s) || /\b(lose|loses|off|down|blackout|dose|radiation|no radio|less|storm)\b/i.test(s);
  const cls = bad ? 'neg' : /\+\s?\d/.test(s) ? 'pos' : '';
  return `<span class="${cls}">${escapeHtml(s)}</span>`;
}

/** @param {object} card state.pendingCard  @param {object} state MissionState */
export function renderEventCard(card, state) {
  const choices = Array.isArray(card?.choices) ? card.choices : [];
  return `<div class="modal-backdrop" data-modal>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="card-title">
      <div class="row">
        <span class="icon" aria-hidden="true">${escapeHtml(card?.icon ?? '❗')}</span>
        <h2 id="card-title">${escapeHtml(card?.title ?? 'Something happened')}</h2>
      </div>
      <p>${renderText(card?.body ?? '')}</p>
      <details class="science">
        <summary>Why this is real <span data-badge="${escapeHtml(card?.source ?? '')}"></span></summary>
        <p>${renderText(card?.science ?? 'This event is based on real NASA mission experience.')}</p>
      </details>
      <h3 style="margin-top:14px">What do you do?</h3>
      <div class="stack">
        ${choices
          .map((ch, i) => {
            const available = ch?.available !== false;
            const lines = safeDescribe(ch?.effects, state);
            const cost = lines.length ? lines.map(costLine).join(' · ') : 'No direct cost';
            return `<button type="button" class="btn choice ${available ? '' : 'ghost'}" data-action="choose" data-index="${i}" ${available ? '' : 'disabled'}>
              <span>${escapeHtml(ch?.label ?? `Choice ${i + 1}`)}</span>
              <span class="cost">${cost}</span>
              ${available ? '' : `<span class="why">${escapeHtml(ch?.why ?? 'Not available right now')}</span>`}
            </button>`;
          })
          .join('')}
      </div>
    </div>
  </div>`;
}
