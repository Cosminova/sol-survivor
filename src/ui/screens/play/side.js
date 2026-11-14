// CAPCOM advisor tips, module power switches and the sol-by-sol mission log.
import { h, richText } from '../../dom.js';
import { MODULES, moduleById } from '../../../data/modules.js';
import { openTermPopover } from '../../components/termPopover.js';
import { termButton } from '../../components/common.js';
import { icon, MODULE_ICONS } from '../../icons.js';

const LEVEL_ICON = { danger: 'alert', warn: 'alert', info: 'antenna', good: 'check' };
const LOG_ICON = { story: 'book', event: 'reticle', warn: 'alert', danger: 'alert', fail: 'wrench', info: 'antenna' };

export function capcomPanel(tips) {
  return h('section', { class: 'panel play-capcom', 'aria-label': 'CAPCOM advice', 'aria-live': 'polite' },
    h('h2', { class: 'panel-title' }, icon('antenna', { size: 18 }), 'CAPCOM', h('span', { class: 'spacer' }), termButton('capcom', 'Who is CAPCOM?')),
    h('ul', { class: 'capcom-list' }, tips.map((tip) => h('li', { class: ['capcom-tip', tip.level] },
      h('span', { class: 'capcom-icon', 'aria-hidden': 'true' }, icon(LEVEL_ICON[tip.level] ?? 'antenna', { size: 18 })),
      h('span', null, tip.text, tip.term ? [' ', termButton(tip.term, 'Learn')] : null)))));
}

function status(m, id, power) {
  if ((m.broken[id] ?? 0) >= (m.modules[id] ?? 0)) return { text: 'Broken', cls: 'danger' };
  if (m.modifiers?.offline?.[id] > 0) return { text: 'Offline', cls: 'warn' };
  if (!m.enabled[id]) return { text: 'Off', cls: '' };
  if (power.shed.includes(id)) return { text: 'No power', cls: 'warn' };
  return { text: 'Running', cls: 'good' };
}

export function modulesPanel(m, power, onToggle) {
  const switchable = MODULES.filter((mod) => mod.id in m.enabled);
  const passive = Object.keys(m.modules).filter((id) => !(id in m.enabled)).map(moduleById).filter(Boolean);
  const locked = m.status !== 'active' || m.phase === 'event';
  return h('section', { class: 'panel play-modules', 'aria-label': 'Base systems' },
    h('h2', { class: 'panel-title' }, icon('power', { size: 18 }), 'Base systems', h('span', { class: 'spacer' }), termButton('trade-off', 'Trade-offs')),
    switchable.length ? h('ul', { class: 'mod-list' }, switchable.map((mod) => {
      const st = status(m, mod.id, power);
      const n = m.modules[mod.id];
      return h('li', { class: 'mod-row' },
        h('label', { class: 'switch mod-switch' },
          h('span', { class: 'mod-name' },
            h('span', { class: 'mod-icon', 'aria-hidden': 'true' }, icon(MODULE_ICONS[mod.id] ?? 'settings', { size: 18 })), `${mod.name}${n > 1 ? ` ×${n}` : ''}`,
            h('small', { class: 'faint' }, ` · ${mod.kw * n} kW`),
            h('span', { class: ['badge', st.cls] }, st.text)),
          h('input', { id: `mod-switch-${mod.id}`, type: 'checkbox', checked: Boolean(m.enabled[mod.id]), disabled: locked, onchange: () => onToggle(mod.id) })));
    })) : h('p', { class: 'faint' }, 'No switchable machines.'),
    passive.length ? h('p', { class: 'mod-passive' }, 'Always on: ', passive.map((mod) => h('span', { class: 'badge' }, `${mod.icon} ${mod.name}${m.modules[mod.id] > 1 ? ` ×${m.modules[mod.id]}` : ''}`))) : null);
}

export function logPanel(m) {
  const recent = m.log.slice(-40).reverse();
  return h('section', { class: 'panel play-log', 'aria-label': 'Mission log' },
    h('h2', { class: 'panel-title' }, icon('log', { size: 18 }), 'Mission log'),
    h('ol', { class: 'log-list', reversed: true }, recent.map((entry) => h('li', { class: ['log-entry', entry.type] },
      h('span', { class: 'log-sol mono' }, `Sol ${entry.sol}`),
      h('span', { class: 'log-icon', 'aria-hidden': 'true' }, icon(LOG_ICON[entry.type] ?? 'info', { size: 16 })),
      h('span', { class: 'log-text' }, richText(entry.text, openTermPopover))))));
}
