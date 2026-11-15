// CAPCOM advisor tips, module power switches and the sol-by-sol mission log.
import { h, richText } from '../../dom.js';
import { MODULES, moduleById } from '../../../data/modules.js';
import { openTermPopover } from '../../components/termPopover.js';
import { termButton } from '../../components/common.js';
import { icon, MODULE_ICONS } from '../../icons.js';
import { isExpertView, moreDetails } from '../../kid/view.js';
import { KID_MODULES, plainify, dayWord } from '../../kid/words.js';
import { getState } from '../../../state/store.js';

const LEVEL_ICON = { danger: 'alert', warn: 'alert', info: 'antenna', good: 'check' };
const LOG_ICON = { story: 'book', event: 'reticle', warn: 'alert', danger: 'alert', fail: 'wrench', info: 'antenna' };

// CAPCOM tips come from the advisor. Cadet view calls CAPCOM "Mission Control" and swaps the few
// science words in each tip for plain ones (same advice, same thresholds).
export function capcomPanel(tips, body = getState().savedMission?.config?.body ?? 'mars') {
  const expert = isExpertView();
  return h('section', { class: 'panel play-capcom', 'aria-label': expert ? 'CAPCOM advice' : 'Advice from Mission Control', 'aria-live': 'polite' },
    h('h2', { class: 'panel-title' }, icon('antenna', { size: 18 }), expert ? 'CAPCOM' : 'Mission Control', h('span', { class: 'spacer' }), termButton('capcom', expert ? 'Who is CAPCOM?' : 'Your helper is called CAPCOM')),
    h('ul', { class: 'capcom-list' }, tips.map((tip) => h('li', { class: ['capcom-tip', tip.level] },
      h('span', { class: 'capcom-icon', 'aria-hidden': 'true' }, icon(LEVEL_ICON[tip.level] ?? 'antenna', { size: 18 })),
      h('span', null, expert ? tip.text : plainify(tip.text, body), tip.term ? [' ', termButton(tip.term, expert ? 'Learn' : 'Learn why')] : null)))));
}

function status(m, id, power) {
  if ((m.broken[id] ?? 0) >= (m.modules[id] ?? 0)) return { text: 'Broken', cls: 'danger' };
  if (m.modifiers?.offline?.[id] > 0) return { text: 'Offline', cls: 'warn' };
  if (!m.enabled[id]) return { text: 'Off', cls: '' };
  if (power.shed.includes(id)) return { text: 'No power', cls: 'warn' };
  return { text: 'Running', cls: 'good' };
}

function expertModules(m, power, onToggle) {
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

export function expertLog(m) {
  const recent = m.log.slice(-40).reverse();
  return h('section', { class: 'panel play-log', 'aria-label': 'Mission log' },
    h('h2', { class: 'panel-title' }, icon('log', { size: 18 }), 'Mission log'),
    h('ol', { class: 'log-list', reversed: true, tabindex: '0', 'aria-label': 'Mission log entries, newest first' }, recent.map((entry) => h('li', { class: ['log-entry', entry.type] },
      h('span', { class: 'log-sol mono' }, `Sol ${entry.sol}`),
      h('span', { class: 'log-icon', 'aria-hidden': 'true' }, icon(LOG_ICON[entry.type] ?? 'info', { size: 16 })),
      h('span', { class: 'log-text' }, richText(entry.text, openTermPopover))))));
}

// ---- Cadet view ------------------------------------------------------------------------------------

const KID_STATUS = { Broken: 'Broken. Needs fixing', Offline: 'Being repaired', Off: 'Switched off', 'No power': 'Not enough power', Running: 'Working' };

export function cadetModules(m, power, onToggle) {
  const switchable = MODULES.filter((mod) => mod.id in m.enabled);
  const passive = Object.keys(m.modules).filter((id) => !(id in m.enabled)).map(moduleById).filter(Boolean);
  const locked = m.status !== 'active' || m.phase === 'event';
  const spares = m.resources.spares ?? 0;
  return h('section', { class: 'panel play-modules kid-modules', 'aria-label': 'Base machines' },
    h('h2', { class: 'panel-title' }, icon('power', { size: 18 }), 'Base machines'),
    h('p', { class: 'kid-lead' }, 'Low on power? Switch a machine off to save some. ', termButton('trade-off', 'That is a trade-off.')),
    switchable.length ? h('ul', { class: 'mod-list' }, switchable.map((mod) => {
      const st = status(m, mod.id, power);
      const n = m.modules[mod.id];
      return h('li', { class: 'mod-row kid-mod-row' },
        h('label', { class: 'switch mod-switch' },
          h('span', { class: 'mod-name' },
            h('span', { class: 'mod-icon', 'aria-hidden': 'true' }, icon(MODULE_ICONS[mod.id] ?? 'settings', { size: 22 })),
            h('span', { class: 'kid-mod-title' }, `${mod.name}${n > 1 ? ` ×${n}` : ''}`),
            h('span', { class: ['badge', st.cls] }, KID_STATUS[st.text] ?? st.text),
            h('span', { class: 'kid-mod-why' }, KID_MODULES[mod.id] ?? mod.blurb)),
          h('input', { id: `mod-switch-${mod.id}`, type: 'checkbox', checked: Boolean(m.enabled[mod.id]), disabled: locked, onchange: () => onToggle(mod.id) })));
    })) : h('p', { class: 'faint' }, 'No machines to switch on this mission.'),
    h('p', { class: 'kid-spares' }, icon('wrench', { size: 18 }), `Spare kits: ${spares}. `, termButton('redundancy', 'Used to fix broken machines.')),
    moreDetails('mods', 'More details: power each machine uses',
      h('ul', { class: 'kid-list' }, switchable.map((mod) => h('li', null, `${mod.name}: ${mod.kw * m.modules[mod.id]} kW when it is on.`))),
      passive.length ? h('p', { class: 'mod-passive' }, 'Always on: ', passive.map((mod) => h('span', { class: 'badge' }, `${mod.name}${m.modules[mod.id] > 1 ? ` ×${m.modules[mod.id]}` : ''}`))) : null,
      h('p', { class: 'faint' }, termButton('kwh', 'What is a kW?'))));
}

// The mission log is secondary detail in Cadet view: one line for the latest news, the full log in a disclosure.
function cadetLog(m) {
  const last = m.log[m.log.length - 1];
  const unit = dayWord(m.config.body, { cap: true });
  return h('section', { class: 'panel play-log kid-log', 'aria-label': 'Mission log' },
    h('h2', { class: 'panel-title' }, icon('log', { size: 18 }), 'Latest news'),
    last ? h('p', { class: 'kid-news' }, h('strong', null, `${unit} ${last.sol}: `), richText(plainify(last.text, m.config.body), openTermPopover)) : h('p', { class: 'faint' }, 'Nothing yet.'),
    moreDetails('log', 'More details: full mission log', expertLog(m)));
}

export const modulesPanel = (m, power, onToggle) => (isExpertView() ? expertModules(m, power, onToggle) : cadetModules(m, power, onToggle));
export const logPanel = (m) => (isExpertView() ? expertLog(m) : cadetLog(m));
