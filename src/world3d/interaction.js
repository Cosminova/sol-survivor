// Station prompts, actions, mini-game launch, task completion and the end-of-sol flow.
// `rt` is the runtime bag created by index.js (scene parts, HUD, callbacks, current game state).
import { TASKS } from '../engine/sim.js';
import { nearestStation, INTERACT_RANGE } from './layout.js';
import { stationActions, promptText, whyLine, verbFor } from './actions.js';
import { recordAssign, recordTaskResult, recordVerb, endSolState, solSummary } from './gameState.js';
import { runMinigame } from './minigames/runner.js';
import { summaryBody, factCard } from './menus.js';
import { ROCK_FACTS } from './facts.js';
import { dayKey, dayWord } from '../ui/kid/words.js';
import { makeRng, hashString } from './rng.js';
import { applyEvents } from './feedback.js';

const stars = (q) => (q >= 0.9 ? '★★★' : q >= 0.6 ? '★★☆' : '★☆☆');
const firstName = (rt) => (rt.mission.crew.find((c) => c.id === rt.playerId)?.name ?? 'Crew').split(' ')[0];
export const playerCrew = (rt) => rt.mission.crew.find((c) => c.id === rt.playerId) ?? rt.mission.crew[0];

function sepThreat(rt) {
  return rt.gs.sepActive || rt.gs.hazards.some((h) => h.type === 'sepStorm' && h.status === 'warning');
}

export function actionsHere(rt) {
  const pos = rt.player.position();
  const near = nearestStation(rt.world.parts.layout, pos.x, pos.z, INTERACT_RANGE);
  if (!near) return null;
  const extra = { damaged: new Set(Object.keys(rt.gs.damaged)) };
  let actions = stationActions(near.station, rt.mission, extra);
  if (['habitat', 'shelter'].includes(near.station.kind) && sepThreat(rt)) {
    actions = [{ id: 'shelter', type: 'shelter', label: 'Take cover inside', icon: '🛡️' }, ...actions];
  }
  return { ...near, actions };
}

export function currentPrompt(rt) {
  if (rt.player.inRover) return { text: 'Hop out of the rover 🚶 (WASD to drive)' };
  if (rt.player.hidden) return { text: 'Go back outside 🚪 (you are sheltering)' };
  if (rt.hold) return null;
  const here = actionsHere(rt);
  if (!here) return null;
  const name = playerCrew(rt).name;
  const [primary, ...rest] = here.actions;
  const why = whyLine(here.station);
  return {
    text: promptText(primary, name),
    alts: rest.map((a) => ({ label: promptText(a, name), onClick: () => perform(rt, a, here.station, here.spotIndex) })),
    why: { text: why.text, term: why.term },
  };
}

export function interact(rt) {
  if (rt.modals.isOpen() || rt.introPlaying) return;
  rt.audio.unlock();
  if (rt.player.inRover) { rt.player.exitRover(); rt.hud.toast('You hop out of the rover.'); return; }
  if (rt.player.hidden) { rt.player.setHidden(false); rt.sheltering = false; rt.hud.toast('Back outside. Watch your oxygen!'); return; }
  if (rt.hold) return;
  const here = actionsHere(rt);
  if (here) perform(rt, here.actions[0], here.station, here.spotIndex);
}

export function perform(rt, action, station, spotIndex) {
  const { hud, opts } = rt;
  rt.audio.sfx.click();
  switch (action.type) {
    case 'task':
      if (action.minigame) launchMinigame(rt, action, station, spotIndex);
      else rt.hold = { action, station, spotIndex, t: 0 };
      break;
    case 'toggle':
      opts.onToggleModule?.(action.moduleId);
      hud.toast(`${action.label === 'Turn on' ? '🔌 Switched on' : '⏻ Switched off'}: ${station.kind}`);
      break;
    case 'endSol':
      endSolFlow(rt, { auto: false });
      break;
    case 'drive':
      if (rt.player.enterRover()) {
        hud.toast('🚙 W/S to drive, A/D to steer, E to hop out. Your suit refills in here!', 'good');
        commit(rt, recordVerb(rt.gs, 'drive'));
      }
      break;
    case 'shelter':
      rt.player.setHidden(true);
      rt.sheltering = true;
      hud.toast('🛡️ Sheltering inside. Press E to go back out.', 'good');
      break;
    default:
      hud.toast(`🧰 ${rt.mission.resources?.spares ?? 0} spare kits left. Each one fixes a machine instantly.`);
  }
}

function launchMinigame(rt, action, station, spotIndex) {
  const crew = playerCrew(rt);
  rt.workVerb = verbFor(action);
  rt.cancelMinigame = runMinigame(action.minigame, {
    modals: rt.modals,
    audio: rt.audio,
    assist: rt.assist,
    ease: rt.tuning.minigameEase,
    rng: makeRng(hashString(`${rt.mission.code}:${rt.mission.sol}:${station.id}:${rt.gs.stats.tasks}`)),
    role: crew.role,
    harvestReady: (rt.mission.greenhouse?.growth ?? 0) >= 25,
    crewName: crew.name,
    onDone: ({ quality, skipped }) => {
      rt.cancelMinigame = null;
      completeTask(rt, action, station, spotIndex, quality, skipped);
    },
  });
}

function commit(rt, result) {
  rt.gs = result.state;
  applyEvents(rt, result.events);
}

export function completeTask(rt, action, station, spotIndex, quality, skipped = false) {
  const { opts, hud, world, audio } = rt;
  const crewId = rt.playerId;
  const verb = verbFor(action);
  rt.workVerb = null;
  rt.workTimer = 2.5;
  rt.lastWorkVerb = verb;
  commit(rt, recordAssign(rt.gs, crewId));
  commit(rt, recordTaskResult(rt.gs, { verb, quality, moduleId: station.moduleId }));
  opts.onAssignTask?.(crewId, action.taskId);
  opts.onTaskResult?.({ crewId, taskId: action.taskId, quality: Math.round(quality * 100) / 100, stationId: station.id, skipped });
  const p = world.parts;
  const anchor = p.stations.anchor(station.id, 1.5) ?? rt.player.position();
  p.particles.burst(anchor, { count: quality >= 0.9 ? 40 : 18, color: quality >= 0.9 ? '#ffe066' : '#7fe3ff' });
  if (quality >= 0.9) audio.sfx.perfect(); else if (quality >= 0.5) audio.sfx.success(); else audio.sfx.fail();
  if (verb === 'clean') p.stations.wipePanel(spotIndex, quality);
  if (verb === 'sample') {
    p.stations.markSampled(station.id);
    showRockFact(rt, station);
  }
  hud.toast(`${firstName(rt)}: ${TASKS[action.taskId].icon} ${TASKS[action.taskId].label} ${stars(quality)}${skipped ? ' (skipped)' : ''}`, quality >= 0.6 ? 'good' : 'info');
}

function showRockFact(rt, station) {
  const list = ROCK_FACTS[rt.world.parts.body] ?? ROCK_FACTS.mars;
  const fact = list[(hashString(`${rt.mission.code}:${rt.mission.sol}`) + (station.index ?? 0)) % list.length];
  rt.radio.say('CAPCOM: Sample logged. The science team is cheering back on Earth.');
  rt.modals.open({
    title: '🔬 Sample collected!',
    body: [factCard(fact), playerCrew(rt).role === 'geologist' ? factCard({ icon: '⛏️', title: 'Geologist bonus', text: 'Geologists find 50% more science on EVAs.' }) : null].filter(Boolean),
    buttons: [{ label: 'Awesome!', primary: true }],
    dismiss: () => {},
  });
}

export function updateHold(rt, dt) {
  const h = rt.hold;
  if (!h) { rt.hud.setHold(null); return; }
  const pos = rt.player.position();
  const spot = h.station.spots[h.spotIndex] ?? h.station.spots[0];
  if (Math.hypot(spot.x - pos.x, spot.z - pos.z) > INTERACT_RANGE + 0.8) {
    rt.hold = null;
    rt.hud.setHold(null);
    return;
  }
  h.t += dt;
  rt.hud.setHold(Math.min(1, h.t));
  if (h.t >= 1) {
    rt.hold = null;
    rt.hud.setHold(null);
    completeTask(rt, h.action, h.station, h.spotIndex, 1);
  }
}

export function endSolFlow(rt, { auto }) {
  if (rt.ending || rt.gs.ended) return;
  rt.ending = true;
  rt.hold = null;
  rt.cancelMinigame?.();
  const before = rt.gs;
  const inside = auto ? !rt.lastOutside || rt.player.hidden : true;
  commit(rt, endSolState(rt.gs, { inside }));
  if (rt.player.inRover) rt.player.exitRover();
  rt.player.setHidden(true);
  const summary = solSummary(rt.gs);
  const finish = () => {
    clearTimeout(rt.autoEndTimer);
    rt.awaitingNextSol = true;
    rt.hud.setAlert('📡 Mission Control is crunching today’s numbers…', 'info');
    rt.opts.onEndSol?.();
  };
  const buttons = [{ label: auto ? 'Continue ▶' : `End ${dayWord(dayKey(rt.mission.config))} ▶`, primary: true, onClick: finish }];
  if (!auto) {
    buttons.unshift({
      label: 'Keep working',
      onClick: () => { rt.gs = before; rt.ending = false; rt.player.setHidden(false); },
    });
  }
  rt.modals.open({
    title: `${dayWord(dayKey(rt.mission.config), { cap: true })} ${rt.gs.sol} complete`,
    body: summaryBody(summary, { auto }),
    className: 'w3d-summary',
    buttons,
    dismiss: auto ? null : () => { rt.gs = before; rt.ending = false; rt.player.setHidden(false); },
  });
  if (auto) rt.autoEndTimer = setTimeout(() => { if (rt.ending && !rt.awaitingNextSol) { rt.modals.close(); finish(); } }, 15000);
}
