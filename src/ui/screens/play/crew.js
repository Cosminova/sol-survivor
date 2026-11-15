// Crew cards: role, health, morale, radiation dose, and a big-button task selector.
import { h } from '../../dom.js';
import { ROLES, TASKS, isOnEva } from '../../../engine/sim.js';
import { RADIATION } from '../../../data/constants.js';
import { meter } from '../../components/common.js';
import { icon, TASK_ICONS } from '../../icons.js';
import { termButton } from '../../components/common.js';
import { isExpertView, moreDetails } from '../../kid/view.js';
import { KID_TASKS, KID_ROLES, dayWord, dayKey, daysText } from '../../kid/words.js';

const colorFor = (v) => (v > 60 ? 'var(--good)' : v > 30 ? 'var(--warn)' : 'var(--danger)');

function stat(label, value, max, color, suffix = '') {
  return h('div', { class: 'crew-stat' },
    h('span', { class: 'crew-stat-label' }, label),
    meter((100 * value) / max, color, `${label} ${Math.round(value)}${suffix}`),
    h('span', { class: 'mono crew-stat-num' }, `${Math.round(value)}${suffix}`));
}

function taskPicker(c, disabled, onTask, key) {
  return h('div', { class: 'task-picker', role: 'group', 'aria-label': `Task for ${c.name}` },
    Object.entries(TASKS).map(([id, t]) => h('button', {
      type: 'button',
      id: `task-${c.id}-${id}`,
      class: ['task-btn', c.task === id && 'active'],
      'aria-pressed': String(c.task === id),
      title: `${t.label}: ${daysText(t.desc, key)}`,
      disabled,
      onclick: () => onTask(c.id, id),
    }, h('span', { class: 'task-icon', 'aria-hidden': 'true' }, icon(TASK_ICONS[id] ?? 'settings', { size: 20 })), h('span', { class: 'task-name' }, t.label.replace(' (EVA)', '')))));
}

function expertCrew(m, onTask) {
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
          eva ? h('span', { class: 'badge mars crew-eva' }, 'EVA: outside') : null),
        stat('Health', c.health, 100, colorFor(c.health)),
        stat('Morale', c.morale, 100, colorFor(c.morale)),
        stat('Dose', c.doseMsv, RADIATION.careerLimitMsv, 'var(--rad)', ' mSv'),
        taskPicker(c, locked, onTask, dayKey(m.config)),
        h('p', { class: 'crew-task-desc' }, task ? `${task.icon} ${daysText(task.desc, dayKey(m.config))}` : ''));
    })));
}

// ---- Cadet view: bigger job buttons, plain words, a "why" line for the chosen job -------------------

const feeling = (c) => (c.health <= 30 ? 'Needs rest now' : c.morale < 35 ? 'Very tired' : c.health > 60 && c.morale > 60 ? 'Feeling great' : 'Doing okay');

function kidWhy(m, taskId) {
  if (taskId === 'greenhouse' && !((m.modules.greenhouse ?? 0) > 0)) return 'There is no greenhouse on this mission, so this job will not help.';
  return KID_TASKS[taskId]?.why ?? '';
}

function kidTaskPicker(m, c, disabled, onTask) {
  // A job that cannot do anything on this mission is left out, unless the astronaut is already on it.
  const jobs = Object.keys(TASKS).filter((id) => id !== 'greenhouse' || (m.modules.greenhouse ?? 0) > 0 || c.task === id);
  return h('div', { class: 'task-picker kid-tasks', role: 'group', 'aria-label': `Job for ${c.name}` },
    jobs.map((id) => h('button', {
      type: 'button',
      id: `task-${c.id}-${id}`,
      class: ['task-btn', 'kid-task', c.task === id && 'active'],
      'aria-pressed': String(c.task === id),
      title: kidWhy(m, id),
      disabled,
      onclick: () => onTask(c.id, id),
    }, h('span', { class: 'task-icon', 'aria-hidden': 'true' }, icon(TASK_ICONS[id] ?? 'settings', { size: 26 })), h('span', { class: 'task-name' }, KID_TASKS[id]?.label ?? TASKS[id].label))));
}

function cadetCrew(m, onTask) {
  const locked = m.status !== 'active' || m.phase === 'event';
  const tomorrow = m.config.body === 'mars' ? 'the next sol' : 'tomorrow';
  return h('section', { class: 'panel play-crew kid-crew', 'aria-label': 'Crew' },
    h('h2', { class: 'panel-title' }, icon('user', { size: 18 }), 'Your crew'),
    h('p', { class: 'kid-lead' }, `Pick one job for each astronaut for ${tomorrow}. Then press Next Day.`),
    h('div', { class: 'crew-grid' }, m.crew.map((c) => {
      const eva = isOnEva(m, c);
      return h('article', { class: ['crew-card', 'kid-crew-card', c.health <= 30 && 'hurt', eva && 'eva'] },
        h('div', { class: 'crew-head' },
          h('span', { class: 'crew-avatar', 'aria-hidden': 'true' }, icon('user', { size: 24 })),
          h('div', null,
            h('h3', null, c.name),
            h('span', { class: 'crew-role' }, ROLES[c.role]?.label ?? c.role)),
          h('span', { class: ['badge', c.health <= 30 ? 'danger' : c.morale < 35 ? 'warn' : 'good', 'crew-feel'] }, feeling(c))),
        stat('Health', c.health, 100, colorFor(c.health)),
        stat('Mood', c.morale, 100, colorFor(c.morale)),
        kidTaskPicker(m, c, locked, onTask),
        h('p', { class: 'crew-task-desc kid-why' }, h('strong', null, `${KID_TASKS[c.task]?.label ?? c.task}: `), kidWhy(m, c.task),
          eva ? [' ', termButton('eva', 'Going outside is called an EVA.')] : null));
    })),
    moreDetails('crew', 'More details: what each job and astronaut does',
      h('ul', { class: 'kid-list' }, Object.keys(TASKS).map((id) => h('li', null, h('strong', null, `${KID_TASKS[id].label}: `), KID_TASKS[id].why))),
      h('ul', { class: 'kid-list' }, m.crew.map((c) => h('li', null, h('strong', null, `${c.name}, ${ROLES[c.role]?.label ?? c.role}: `),
        KID_ROLES[c.role] ?? '', ` Radiation so far: ${Math.round(c.doseMsv)} of ${RADIATION.careerLimitMsv} mSv.`))),
      h('p', { class: 'faint' }, `Building a shield takes teamwork: every 6 crew-${dayWord(dayKey(m.config), { plural: true })} of work adds one shield level.`)));
}

export const crewPanel = (m, onTask) => (isExpertView() ? expertCrew(m, onTask) : cadetCrew(m, onTask));
