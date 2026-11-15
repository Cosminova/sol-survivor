// "What just happened" popups: one short card for the BIG results of a day. Only one is ever on screen
// (the rest wait in a queue). Each closes by itself after about six seconds unless it is hovered or focused,
// and has a Close button. The holder ignores clicks, so a popup never covers a button it does not sit on.
import { h, announce, prefersReducedMotion } from '../dom.js';
import { icon } from '../icons.js';

const SHOW_MS = 6000;
const queue = [];
let showing = null;

function holder() {
  let el = document.querySelector('.effect-pop-holder');
  if (!el) {
    el = h('div', { class: 'effect-pop-holder', role: 'region', 'aria-label': 'What just happened' });
    document.body.append(el);
  }
  return el;
}

function next() {
  if (showing || !queue.length) return;
  const { title, items } = queue.shift();
  let timer = 0;
  const close = () => {
    if (!showing || showing.el !== el) return;
    window.clearTimeout(timer);
    const hadFocus = el.contains(document.activeElement);
    el.remove();
    showing = null;
    if (!queue.length) document.querySelector('.effect-pop-holder')?.remove();
    if (hadFocus) document.getElementById('next-sol')?.focus();
    next();
  };
  const arm = () => { window.clearTimeout(timer); timer = window.setTimeout(close, SHOW_MS); };
  const hold = () => window.clearTimeout(timer);
  const el = h('section', {
    class: ['effect-pop', prefersReducedMotion() && 'still'],
    role: 'group',
    'aria-label': `What happened: ${title}`,
    onmouseenter: hold, onmouseleave: arm, onfocusin: hold, onfocusout: arm,
  },
  h('h2', { class: 'effect-pop-title' }, title),
  h('ul', { class: 'effect-pop-list' }, items.map((it) => h('li', { class: it.tone ?? '' }, icon(it.icon ?? 'info', { size: 22 }), h('span', null, it.text)))),
  h('button', { type: 'button', class: 'btn btn-ghost btn-sm effect-pop-close', onclick: close }, icon('close', { size: 18 }), 'Close'));
  showing = { el, close };
  holder().append(el);
  announce(`${title}. ${items.map((it) => it.text).join(' ')}`);
  arm();
}

/** @param {{ title: string, items: { icon?: string, text: string, tone?: 'good'|'bad'|'' }[] }|null} effect */
export function showEffect(effect) {
  if (!effect?.items?.length) return;
  // Fast players can outrun the popups: keep only the newest one waiting, so old news never piles up.
  if (queue.length >= 1) queue.length = 0;
  queue.push(effect);
  next();
}

/** Drops everything (used when leaving the play screen). */
export function clearEffects() {
  queue.length = 0;
  showing?.el.remove();
  showing = null;
  document.querySelector('.effect-pop-holder')?.remove();
}
