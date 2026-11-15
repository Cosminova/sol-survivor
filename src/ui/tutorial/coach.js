// Coach marks: dim the screen, light up ONE thing, point at it with an arrow and say one sentence.
// "do" steps wait for the player to really use the lit-up control (only that control can be clicked);
// "read" steps have a Next button. Escape skips the whole tutorial. Screen readers hear every step through
// the app's live region, focus moves to the lit-up control, and nothing animates when motion is reduced.
import { h, announce, prefersReducedMotion } from '../dom.js';
import { icon } from '../icons.js';

const PAD = 8;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @typedef {{ id: string, target: string, kind: 'do'|'read', text: string, extra?: () => Node|null, nextLabel?: string }} CoachStep
 * @param {{ steps: CoachStep[], onSkip: () => void, onNext: (step: CoachStep) => void }} opts
 */
export function createCoach({ steps, onSkip, onNext }) {
  let index = -1;
  let raf = 0;
  let lastKey = '';
  let lastTarget = null;
  let stopped = false;
  let missingSince = 0;

  const dims = ['top', 'right', 'bottom', 'left'].map((side) => h('div', { class: `coach-dim coach-dim-${side}` }));
  const cover = h('div', { class: 'coach-cover' }); // keeps "read" steps from being clicked through
  const ring = h('div', { class: 'coach-ring', 'aria-hidden': 'true' });
  const count = h('p', { class: 'coach-count' });
  const text = h('p', { class: 'coach-text', id: 'coach-text' });
  const extra = h('div', { class: 'coach-extra' });
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary coach-next', onclick: () => { const st = steps[index]; if (st) onNext(st); } }, 'Next', icon('arrow-right', { size: 18 }));
  const skipBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm coach-skip', onclick: () => onSkip() }, 'Skip tutorial');
  const arrow = h('span', { class: 'coach-arrow', 'aria-hidden': 'true' });
  const bubble = h('div', { class: 'coach-bubble', role: 'dialog', 'aria-label': 'Tutorial', 'aria-describedby': 'coach-text' },
    arrow, count, text, extra, h('div', { class: 'coach-actions' }, nextBtn, skipBtn));
  const root = h('div', { class: ['coach', prefersReducedMotion() && 'still'] }, ...dims, cover, ring, bubble);

  const onKey = (e) => {
    if (e.key !== 'Escape' || document.querySelector('.popover')) return;
    e.preventDefault();
    e.stopPropagation();
    onSkip();
  };

  const targetEl = () => {
    const st = steps[index];
    if (!st) return null;
    const el = document.querySelector(st.target);
    return el && el.getClientRects().length ? el : null;
  };

  function place() {
    raf = requestAnimationFrame(place);
    const st = steps[index];
    if (!st) return;
    const el = targetEl();
    // Safety net: if the thing to tap never shows up, offer Next so nobody gets stuck.
    if (el) missingSince = 0; else if (!missingSince) missingSince = performance.now();
    nextBtn.hidden = !(st.kind === 'read' || (!el && performance.now() - missingSince > 2500));
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = el ? el.getBoundingClientRect() : { left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2, width: 0, height: 0 };
    const box = {
      left: Math.max(0, r.left - PAD), top: Math.max(0, r.top - PAD),
      right: Math.min(vw, r.right + PAD), bottom: Math.min(vh, r.bottom + PAD),
    };
    const bh = bubble.offsetHeight;
    const bw = bubble.offsetWidth;
    const key = [box.left, box.top, box.right, box.bottom, vw, vh, bh, bw, index].map(Math.round).join(',');
    if (el !== lastTarget) {
      lastTarget = el;
      if (el) {
        if (r.bottom > vh || r.top < 0) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        focusStep(st, el);
      }
    }
    if (key === lastKey) return;
    lastKey = key;
    const px = (v) => `${Math.round(v)}px`;
    Object.assign(dims[0].style, { left: 0, top: 0, width: '100vw', height: px(box.top) });
    Object.assign(dims[2].style, { left: 0, top: px(box.bottom), width: '100vw', height: px(Math.max(0, vh - box.bottom)) });
    Object.assign(dims[3].style, { left: 0, top: px(box.top), width: px(box.left), height: px(box.bottom - box.top) });
    Object.assign(dims[1].style, { left: px(box.right), top: px(box.top), width: px(Math.max(0, vw - box.right)), height: px(box.bottom - box.top) });
    const hole = { left: px(box.left), top: px(box.top), width: px(box.right - box.left), height: px(box.bottom - box.top) };
    Object.assign(ring.style, hole);
    Object.assign(cover.style, hole);
    cover.hidden = st.kind === 'do' && Boolean(el);
    ring.hidden = !el;

    // Bubble: below the target when there is room, else above, else pinned to the bottom of the screen.
    const gap = 16;
    const below = vh - box.bottom;
    const above = box.top;
    let top;
    let side;
    if (below >= bh + gap + 8) { top = box.bottom + gap; side = 'below'; }
    else if (above >= bh + gap + 8) { top = box.top - gap - bh; side = 'above'; }
    else { top = (box.top + box.bottom) / 2 > vh / 2 ? 8 : Math.max(8, vh - bh - 12); side = 'over'; }
    const cx = (box.left + box.right) / 2;
    const left = Math.min(Math.max(8, cx - bw / 2), Math.max(8, vw - bw - 8));
    Object.assign(bubble.style, { top: px(top), left: px(left) });
    bubble.dataset.side = side;
    arrow.style.left = px(Math.min(Math.max(18, cx - left), bw - 18));
  }

  function focusStep(st, el) {
    // Let any dialog that just opened finish its own autofocus first.
    window.setTimeout(() => {
      if (stopped || steps[index] !== st) return;
      if (st.kind === 'read') { nextBtn.focus({ preventScroll: true }); return; }
      const live = targetEl() ?? el;
      const focusable = live.matches(FOCUSABLE) ? live : live.querySelector('[data-autofocus]') ?? live.querySelector(FOCUSABLE);
      (focusable ?? nextBtn).focus({ preventScroll: true });
    }, 80);
  }

  const api = {
    el: root,
    index: () => index,
    step: () => steps[index] ?? null,
    start() {
      document.body.append(root);
      document.body.classList.add('coach-on');
      document.addEventListener('keydown', onKey, true);
      raf = requestAnimationFrame(place);
    },
    show(i) {
      index = i;
      const st = steps[i];
      if (!st) return;
      lastKey = '';
      lastTarget = null;
      missingSince = 0;
      root.dataset.step = st.id;
      root.dataset.kind = st.kind;
      root.dataset.target = st.target;
      count.textContent = `Step ${i + 1} of ${steps.length}`;
      text.textContent = st.text;
      extra.replaceChildren(...[st.extra?.()].filter(Boolean));
      nextBtn.hidden = st.kind !== 'read';
      nextBtn.firstChild.textContent = st.nextLabel ?? 'Next';
      targetEl()?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      announce(`Tutorial step ${i + 1} of ${steps.length}. ${st.text}${st.kind === 'read' ? ' Press Next to go on.' : ''}`);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('coach-on');
      root.remove();
    },
  };
  return api;
}
