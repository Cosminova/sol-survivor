// Pure mapping from a station + mission state to what an astronaut can do there.
// Each action knows the engine task it assigns and the hands-on mini-game that goes with it.
import { TASKS } from '../engine/sim.js';
import { STATION_INFO } from './facts.js';
import { dayKey, dayWord } from '../ui/kid/words.js';

export const MINIGAMES = {
  wipe: { label: 'Wipe the dust', seconds: 12 },
  shovel: { label: 'Shovel regolith', seconds: 10 },
  water: { label: 'Tend the plants', seconds: 14 },
  scan: { label: 'Scan the rock', seconds: 12 },
  repair: { label: 'Reconnect the wires', seconds: 15 },
  drill: { label: 'Drill for ice', seconds: 12 },
};

const TASK_STATIONS = {
  rest: ['habitat'],
  science: ['outcrop', 'rover'],
  maintain: ['solar', 'battery', 'recycler', 'oxygen', 'moxie', 'regolithO2', 'iceDrill', 'fission', 'relay', 'greenhouse', 'rover'],
  shield: ['berm', 'shelter'],
  greenhouse: ['greenhouse'],
};

export const isBroken = (mission, moduleId) => Boolean(moduleId) && (mission.broken?.[moduleId] ?? 0) > 0;
export const isDisabled = (mission, moduleId) => Boolean(moduleId) && mission.enabled?.[moduleId] === false;
export const canToggle = (mission, moduleId) => Boolean(moduleId) && moduleId in (mission.enabled ?? {});

const task = (taskId, label, minigame = null) => ({
  id: `task:${taskId}:${minigame ?? 'hold'}`, type: 'task', taskId, label, icon: TASKS[taskId].icon, minigame,
});

function repairAction() {
  return { ...task('maintain', 'Repair (Maintain)', 'repair'), id: 'task:maintain:repair', repair: true };
}

function primaryActions(station, mission, extra) {
  const { kind, moduleId } = station;
  const broken = isBroken(mission, moduleId) || extra.damaged?.has?.(moduleId);
  if (broken && kind !== 'habitat') return [repairAction()];
  switch (kind) {
    case 'habitat': return [
      { id: 'endSol', type: 'endSol', label: `Enter airlock: End ${dayWord(dayKey(mission?.config))}`, icon: '🌙' },
      task('rest', 'Rest inside'),
    ];
    case 'berm':
    case 'shelter': return [task('shield', 'Build shielding', 'shovel')];
    case 'solar': return [task('maintain', 'Clean solar panels', 'wipe')];
    case 'greenhouse': return [task('greenhouse', 'Tend greenhouse', 'water')];
    case 'outcrop': return [task('science', 'Explore: scan rocks', 'scan')];
    case 'iceDrill': return [task('maintain', 'Run the ice drill', 'drill')];
    case 'rover': return [
      { id: 'drive', type: 'drive', label: 'Drive the rover', icon: '🚙' },
      task('science', 'Plan a rover traverse'),
    ];
    case 'spares': return [{ id: 'info', type: 'info', label: 'Check spare parts', icon: '🧰' }];
    default: return [task('maintain', `Inspect the ${STATION_INFO[kind]?.name ?? kind}`)];
  }
}

// Ordered list; the first action is what E does, the rest are offered as extra buttons.
export function stationActions(station, mission, extra = {}) {
  const actions = primaryActions(station, mission, extra);
  if (canToggle(mission, station.moduleId)) {
    const off = isDisabled(mission, station.moduleId);
    actions.push({ id: 'toggle', type: 'toggle', moduleId: station.moduleId, label: off ? 'Turn on' : 'Turn off', icon: off ? '🔌' : '⏻' });
  }
  return actions;
}

export function promptText(action, crewName) {
  const first = crewName ? crewName.split(' ')[0] : 'crew';
  if (action.type === 'task') return `Assign ${first} to: ${action.label} ${action.icon}`;
  return `${action.label} ${action.icon}`;
}

export function stationForTask(taskId) {
  return TASK_STATIONS[taskId] ?? ['habitat'];
}

export function whyLine(station) {
  const info = STATION_INFO[station.kind] ?? STATION_INFO.habitat;
  return { text: info.why, term: info.term, name: info.name, icon: info.icon };
}

// Objective bookkeeping uses a coarser verb than the engine task.
export function verbFor(action) {
  if (action.type !== 'task') return action.type;
  if (action.repair) return 'repair';
  return { wipe: 'clean', shovel: 'shield', water: 'tend', scan: 'sample', drill: 'drill' }[action.minigame] ?? action.taskId;
}
