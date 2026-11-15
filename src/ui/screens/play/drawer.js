// Cadet view: the ONE "Mission details" drawer. Everything that is not needed to choose today's plan lives
// here: Mission Control tips, exact numbers, every machine switch, the weather and the mission log.
import { h, mount, richText } from '../../dom.js';
import { icon } from '../../icons.js';
import { advise, forecast } from '../../../engine/advisor.js';
import { trapFocus } from '../../components/modal.js';
import { openTermPopover } from '../../components/termPopover.js';
import { termButton } from '../../components/common.js';
import { expertResources, expertPower, expertDosimeter } from './gauges.js';
import { capcomPanel, cadetModules, expertLog } from './side.js';
import { cadetChips, weatherSource } from './hud.js';
import { plainify, dayWord } from '../../kid/words.js';
import { moreDetails, realDataLabel } from '../../kid/view.js';

function latestNews(m) {
  const last = m.log[m.log.length - 1];
  if (!last) return null;
  const unit = dayWord(m.config.body, { cap: true });
  return h('p', { class: 'kid-news' }, h('strong', null, `${unit} ${last.sol}: `), richText(plainify(last.text, m.config.body), openTermPopover));
}

/** Everything inside the drawer for the current mission. Rebuilt on every redraw while the drawer is open. */
export function drawerContent(m, { power, onToggle }) {
  const body = m.config.body;
  const fc = forecast(m);
  const src = weatherSource(m);
  return [
    h('section', { class: 'kid-drawer-part' }, latestNews(m)),
    capcomPanel(advise(m), body),
    cadetModules(m, power, onToggle),
    h('section', { class: 'panel', 'aria-label': 'Outside today' },
      h('h3', { class: 'panel-title' }, icon('thermometer', { size: 18 }), 'Outside today'),
      h('div', { class: 'hud-env' }, cadetChips(m)),
      body === 'mars' ? h('p', null, termButton('sol', 'A day on Mars is called a sol.')) : null,
      src ? h('p', { class: 'kid-drawer-src' }, src) : null,
      m.today?.sep ? h('p', { class: 'kid-drawer-src' }, realDataLabel(m.today.sep.time, 'donki', 'Solar storm')) : null),
    moreDetails('numbers', 'Exact numbers', expertResources(m, fc), expertPower(m, power), expertDosimeter(m)),
    moreDetails('log', 'Mission log', expertLog(m)),
  ];
}

/** The drawer shell. One per play screen; content is re-mounted by the screen while it is open. */
export function createDrawer({ onOpenChange } = {}) {
  let opener = null;
  const bodyEl = h('div', { class: 'kid-drawer-body' });
  const closeBtn = h('button', { type: 'button', class: 'btn btn-ghost kid-drawer-close', onclick: () => api.close() }, icon('close', { size: 20 }), 'Close');
  const panel = h('div', { class: 'kid-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'kid-drawer-title', tabindex: '-1' },
    h('div', { class: 'kid-drawer-head' }, h('h2', { id: 'kid-drawer-title' }, 'Mission details'), closeBtn),
    bodyEl);
  const el = h('div', { class: 'kid-drawer-backdrop', hidden: true, onclick: (e) => { if (e.target === el) api.close(); } }, panel);
  const onKey = (e) => {
    if (document.querySelector('.popover, .modal-backdrop')) return;
    if (e.key === 'Escape') { e.stopPropagation(); api.close(); } else trapFocus(panel, e);
  };
  const api = {
    el,
    isOpen: () => !el.hidden,
    render: (nodes) => mount(bodyEl, nodes),
    open() {
      if (!el.hidden) return;
      opener = document.activeElement;
      el.hidden = false;
      document.addEventListener('keydown', onKey, true);
      onOpenChange?.(true);
      closeBtn.focus();
    },
    close() {
      if (el.hidden) return;
      el.hidden = true;
      document.removeEventListener('keydown', onKey, true);
      onOpenChange?.(false);
      const back = opener && document.contains(opener) ? opener : document.getElementById('mission-details-btn');
      back?.focus();
    },
    stop() { document.removeEventListener('keydown', onKey, true); el.remove(); },
  };
  return api;
}
