// Tiny DOM builder. Text is always inserted as text nodes, never as HTML.
const SVG_NS = 'http://www.w3.org/2000/svg';
const EMOJI = /(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}][\uFE0F\u200D]*)+ ?|[\uFE0F\u20E3]/gu;
const TEXT_ATTRS = new Set(['aria-label', 'title', 'alt', 'placeholder']);

// Emoji are never shown in the UI; data strings that still carry them are cleaned at render time.
export const stripEmoji = (text) => String(text).replace(EMOJI, '');

function applyProps(el, props, isSvg) {
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') {
      el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) {
        if (v == null) continue;
        if (prop.startsWith('--')) el.style.setProperty(prop, String(v));
        else el.style[prop] = v;
      }
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'ref' && typeof value === 'function') {
      value(el);
    } else if (!isSvg && (key === 'value' || key === 'checked' || key === 'selected')) {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : TEXT_ATTRS.has(key) ? stripEmoji(value) : String(value));
    }
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    el.append(child instanceof Node ? child : document.createTextNode(stripEmoji(child)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props, false);
  appendChildren(el, children);
  return el;
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props, true);
  appendChildren(el, children);
  return el;
}

export function mount(parent, ...children) {
  parent.replaceChildren();
  appendChildren(parent, children);
  return parent;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Splits "text [[term-id|label]] more" into strings and {term, label} parts.
export function parseTermLinks(text = '') {
  const parts = [];
  const re = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ term: match[1], label: match[2] ?? null });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export const plainText = (text = '') => parseTermLinks(text)
  .map((p) => (typeof p === 'string' ? p : p.label ?? p.term.replace(/-/g, ' ')))
  .join('');

// Renders glossary links as tappable chips. onTerm(termId, buttonEl) opens the popover.
export function richText(text, onTerm, labelFor = (id) => id.replace(/-/g, ' ')) {
  return parseTermLinks(text).map((part) => (typeof part === 'string'
    ? part
    : h('button', {
      type: 'button',
      class: 'term-chip',
      'aria-haspopup': 'dialog',
      onclick: (e) => onTerm?.(part.term, e.currentTarget),
    }, part.label ?? labelFor(part.term))));
}

export function prefersReducedMotion() {
  return document.documentElement.dataset.motion === 'reduced'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function announce(message) {
  const region = document.getElementById('live-region');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}
