// Crew cards: role, health, morale, radiation dose, and a big-button task selector.
import { h } from '../../dom.js';
import { ROLES, TASKS, isOnEva } from '../../../engine/sim.js';
import { RADIATION } from '../../../data/constants.js';
import { meter } from '../../components/common.js';
import { icon, TASK_ICONS } from '../../icons.js';

const colorFor = (v) => (v > 60 ? 'var(--good)' : v > 30 ? 'var(--warn)' : 'var(--danger)');

function stat(label, value, max, color, suffix = '') {
  return h('div', { class: 'crew-stat' },
    h('span', { class: 'crew-stat-label' }, label),
    meter((100 * value) / max, color, `${label} ${Math.round(value)}${suffix}`),
    h('span', { class: 'mono crew-stat-num' }, `${Math.round(value)}${suffix}`));
}

function taskPicker(c, disabled, onTask) {
  return h('div', { class: 'task-picker', role: 'group', 'aria-label': `Task for ${c.name}` },
    Object.entries(TASKS).map(([id, t]) => h('button', {
      type: 'button',
      id: `task-${c.id}-${id}`,
      class: ['task-btn', c.task === id && 'active'],
      'aria-pressed': String(c.task === id),
      title: `${t.label}: ${t.desc}`,
      disabled,
      onclick: () => onTask(c.id, id),
    }, h('span', { class: 'task-icon', 'aria-hidden': 'true' }, icon(TASK_ICONS[id] ?? 'settings', { size: 20 })), h('span', { class: 'task-name' }, t.label.replace(' (EVA)', '')))));
}

export function crewPanel(m, onTask) {
  const locked = m.status !== 'active' || m.phase === 'event';
  return h('section', { class: 'panel play-crew', 'aria-label': 'Crew' },
    h('h2', { class: 'panel-title' }, icon('user', { size: 18 }), 'Crew assignments', h('span', { class: 'spacer' }), h('span', { class: 'faint' }, 'Pick a job for tomorrow')),
    h('div', { class: 'crew-grid' }, m.crew.map((c) => {
      const eva = isOnEva(m, c);
      const task = TASKS[c.task];
      return h('article', { class: ['crew-card', c.health <= 30 && 'hurt', eva && 'eva'] },
        h('div', { class: 'crew-head' },
          h('span', { class: 'crew-avatar', 'aria-hidden': 'true' }, icon('user', { size: 24 })),
          h('div', null,
            h('h3', null, c.name),
            h('span', { class: 'crew-role', title: ROLES[c.role]?.bonus }, ROLES[c.role]?.label ?? c.role)),
          eva ? h('span', { class: 'badge mars crew-eva' }, 'EVA') : null),
        stat('Health', c.health, 100, colorFor(c.health)),
        stat('Morale', c.morale, 100, colorFor(c.morale)),
        stat('Dose', c.doseMsv, RADIATION.careerLimitMsv, 'var(--rad)', ' mSv'),
        taskPicker(c, locked, onTask),
        h('p', { class: 'crew-task-desc' }, task ? `${task.icon} ${task.desc}` : ''));
    })));
}
