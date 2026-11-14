// Accessible modal dialog with focus trap, Escape to close and focus restore.
import { h } from '../dom.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(container, event) {
  if (event.key !== 'Tab') return;
  const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// openModal({ title, content, wide, dismissible, onClose }) -> close()
// content may be a node or a function (close) => node.
export function openModal({ title, content, wide = false, dismissible = true, onClose, className = '' }) {
  const previous = document.activeElement;
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    onClose?.();
  };

  const onKey = (e) => {
    if (document.querySelector('.popover')) return;
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      close();
    } else {
      trapFocus(dialog, e);
    }
  };

  const dialog = h('div', {
    class: ['modal', wide && 'wide', className],
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
  },
  dismissible ? h('button', { type: 'button', class: 'btn btn-ghost btn-icon modal-close', 'aria-label': 'Close', onclick: close }, '✕') : null,
  h('h2', { id: titleId }, title),
  typeof content === 'function' ? content(close) : content);

  const backdrop = h('div', {
    class: 'modal-backdrop',
    onclick: (e) => { if (e.target === backdrop && dismissible) close(); },
  }, dialog);

  document.body.append(backdrop);
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => {
    const target = dialog.querySelector('[data-autofocus]') ?? dialog.querySelector(FOCUSABLE);
    target?.focus();
  });
  return close;
}
