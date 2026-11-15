// Coach marks: ONE small speech bubble with an arrow, next to the thing it is about, plus a glowing ring.
// The rest of the screen is only lightly dimmed, so the outpost and the sidebar stay visible while learning.
// "do" steps wait for the player to really use the ringed control (only that control can be clicked);
// "read" steps have a Next button. Escape skips the whole tutorial. Screen readers hear every step through
// the app's live region, focus moves to the ringed control, and nothing animates when motion is reduced.
import { h, announce, prefersReducedMotion } from '../dom.js';
import { icon } from '../icons.js';

const PAD = 6; // ring padding around the target
const GAP = 14; // space between the ring and the bubble (room for the arrow)
const EDGE = 8; // keep this far from the viewport edge
const PHONE = 640;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where to put a w×h bubble next to a target box so it stays on screen and never covers the target.
 * Pure geometry, exported for tests. On phones the bubble is a bar pinned to the top or bottom edge,
 * whichever is farther from the target.
 * @param {{ left: number, top: number, right: number, bottom: number }} box target (already padded)
 * @param {{ w: number, h: number }} size bubble size
 * @param {{ vw: number, vh: number, top?: number, bottom?: number }} view viewport and reserved bars (header, ticker)
 * @returns {{ left: number, top: number, side: 'below'|'above'|'left'|'right'|'bar-top'|'bar-bottom'|'corner' }}
 */
export function placeBubble(box, size, view) {
  const { w, h: bh } = size;
  const { vw, vh } = view;
  const minTop = (view.top ?? 0) + EDGE;
  const maxBottom = vh - (view.bottom ?? 0) - EDGE;
  const clampX = (x) => Math.min(Math.max(EDGE, x), Math.max(EDGE, vw - w - EDGE));
  const clampY = (y) => Math.min(Math.max(minTop, y), Math.max(minTop, maxBottom - bh));
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  if (vw <= PHONE) {
    // A compact bar on the edge away from the target.
    const top = cy > vh / 2 ? minTop : maxBottom - bh;
    return { left: clampX((vw - w) / 2), top, side: cy > vh / 2 ? 'bar-top' : 'bar-bottom' };
  }
  const room = {
    left: box.left - EDGE - GAP,
    right: vw - box.right - EDGE - GAP,
    above: box.top - minTop - GAP,
    below: maxBottom - box.bottom - GAP,
  };
  const fits = { left: room.left >= w, right: room.right >= w, above: room.above >= bh, below: room.below >= bh };
  // The roomiest side that fits: beside a sidebar control that is the outpost, never the control itself.
  const score = { left: room.left - w, right: room.right - w, above: room.above - bh, below: room.below - bh };
  const side = Object.keys(fits).filter((k) => fits[k]).sort((a, b) => score[b] - score[a])[0];
  if (side === 'left') return { left: box.left - GAP - w, top: clampY(cy - bh / 2), side };
  if (side === 'right') return { left: box.right + GAP, top: clampY(cy - bh / 2), side };
  if (side === 'above') return { left: clampX(cx - w / 2), top: box.top - GAP - bh, side };
  if (side === 'below') return { left: clampX(cx - w / 2), top: box.bottom + GAP, side };
  // The target fills the screen: tuck the bubble into the bottom corner farthest from its centre.
  return { left: cx > vw / 2 ? EDGE : vw - w - EDGE, top: maxBottom - bh, side: 'corner' };
}

/**
 * @typedef {{ id: string, target: string, kind: 'do'|'read', text: string, why?: string, inline?: () => Node|null, extra?: () => Node|null }} CoachStep
 * `inline` is always shown under the text (for example keycaps); `extra` is folded behind "More details".
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
  const ring = h('div', { class: 'coach-ring', 'aria-hidden': 'true' });
  const count = h('span', { class: 'coach-count' });
  const text = h('p', { class: 'coach-text', id: 'coach-text' });
  const whyText = h('p', { class: 'coach-why-text', id: 'coach-why-text', hidden: true });
  const whyBtn = h('button', {
    type: 'button', class: 'coach-why', 'aria-expanded': 'false', 'aria-controls': 'coach-why-text',
    onclick: () => {
      const open = whyText.hidden;
      whyText.hidden = !open;
      whyBtn.setAttribute('aria-expanded', String(open));
      lastKey = '';
      if (open) announce(whyText.textContent);
    },
  }, 'Why?');
  // Extra content (for example the live Sun card) stays folded away behind "More details" so the bubble
  // stays small; a bouncing arrow points at the button until it is opened.
  const inline = h('div', { class: 'coach-inline' });
  const extra = h('div', { class: 'coach-extra', id: 'coach-extra', hidden: true });
  const moreBtn = h('button', {
    type: 'button', class: 'coach-more', 'aria-expanded': 'false', 'aria-controls': 'coach-extra',
    onclick: () => {
      const open = extra.hidden;
      extra.hidden = !open;
      moreBtn.setAttribute('aria-expanded', String(open));
      moreBtn.querySelector('.coach-more-label').textContent = open ? 'Fewer details' : 'More details';
      moreBtn.classList.add('seen');
      lastKey = '';
      if (open) announce(extra.textContent);
    },
  }, h('span', { class: 'coach-more-label' }, 'More details'), h('span', { class: 'coach-more-hint', 'aria-hidden': 'true' }, '←'));
  const nextBtn = h('button', { type: 'button', class: 'coach-next', onclick: () => { const st = steps[index]; if (st) onNext(st); } }, 'Next', icon('arrow-right', { size: 16 }));
  const skipBtn = h('button', { type: 'button', class: 'coach-skip', onclick: () => onSkip() }, 'Skip');
  const arrow = h('span', { class: 'coach-arrow', 'aria-hidden': 'true' });
  const bubble = h('div', { class: 'coach-bubble', role: 'dialog', 'aria-label': 'Tutorial', 'aria-describedby': 'coach-text' },
    arrow,
    h('div', { class: 'coach-top' }, count, skipBtn),
    text, inline, whyText, extra,
    h('div', { class: 'coach-actions' }, whyBtn, moreBtn, nextBtn));
  const root = h('div', { class: ['coach', prefersReducedMotion() && 'still'] }, ...dims, ring, bubble);

  const onKey = (e) => {
    if (e.key !== 'Escape' || document.querySelector('.popover')) return;
    e.preventDefault();
    e.stopPropagation();
    onSkip();
  };
  // On a "read" step nothing on the page should react: only the bubble's own buttons work.
  const onPress = (e) => {
    if (steps[index]?.kind !== 'read' || bubble.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const targetEl = () => {
    const st = steps[index];
    if (!st) return null;
    const el = document.querySelector(st.target);
    return el && el.getClientRects().length ? el : null;
  };
  const barHeight = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight ? r : null;
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
    const r = el ? el.getBoundingClientRect() : { left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2 };
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
    Object.assign(ring.style, { left: px(box.left), top: px(box.top), width: px(box.right - box.left), height: px(box.bottom - box.top) });
    ring.hidden = !el;

    // Keep clear of the sticky site header and the ticker when they are on screen and no dialog covers them.
    const overDialog = Boolean(document.querySelector('.modal-backdrop'));
    const header = overDialog ? null : barHeight('.site-header');
    const ticker = overDialog ? null : barHeight('.ticker');
    const pos = placeBubble(box, { w: bw, h: bh }, { vw, vh, top: header ? Math.max(0, header.bottom) : 0, bottom: ticker ? Math.max(0, vh - ticker.top) : 0 });
    Object.assign(bubble.style, { top: px(pos.top), left: px(pos.left) });
    bubble.dataset.side = pos.side;
    const cx = (box.left + box.right) / 2;
    const cy = (box.top + box.bottom) / 2;
    if (pos.side === 'left' || pos.side === 'right') Object.assign(arrow.style, { top: px(Math.min(Math.max(16, cy - pos.top), bh - 16)), left: '' });
    else Object.assign(arrow.style, { left: px(Math.min(Math.max(16, cx - pos.left), bw - 16)), top: '' });
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
      for (const type of ['pointerdown', 'mousedown', 'click']) document.addEventListener(type, onPress, true);
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
      count.textContent = `${i + 1} of ${steps.length}`;
      text.textContent = st.text;
      whyText.textContent = st.why ?? '';
      whyText.hidden = true;
      whyBtn.hidden = !st.why;
      whyBtn.setAttribute('aria-expanded', 'false');
      inline.replaceChildren(...[st.inline?.()].filter(Boolean));
      extra.replaceChildren(...[st.extra?.()].filter(Boolean));
      extra.hidden = true;
      moreBtn.hidden = !st.extra;
      moreBtn.classList.remove('seen');
      moreBtn.setAttribute('aria-expanded', 'false');
      moreBtn.querySelector('.coach-more-label').textContent = 'More details';
      nextBtn.hidden = st.kind !== 'read';
      targetEl()?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      announce(`Tutorial step ${i + 1} of ${steps.length}. ${st.text}${st.kind === 'read' ? ' Press Next to go on.' : ''}`);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      for (const type of ['pointerdown', 'mousedown', 'click']) document.removeEventListener(type, onPress, true);
      document.body.classList.remove('coach-on');
      root.remove();
    },
  };
  return api;
}
