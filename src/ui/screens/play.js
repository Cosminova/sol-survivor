// Mission Control dashboard: animated outpost scene, gauges, crew, CAPCOM, log and the sol loop.
import '../../styles/play.css';
import '../../styles/outpost3d.css';
import { h, mount, announce, prefersReducedMotion } from '../dom.js';
import { beginSol, resolveEvent, runSol, setTask, toggleModule, computePower, isOnEva } from '../../engine/sim.js';
import { forecast, advise } from '../../engine/advisor.js';
import { getState, setMission } from '../../state/store.js';
import { loadSimContext } from '../../state/nasaData.js';
import { createScene } from '../scene.js';
import { createOutpostBackdrop } from '../outpost3d/host.js';
import { navigate } from '../router.js';
import { play } from '../audio.js';
import { didYouKnow } from '../components/common.js';
import { hud, sceneOverlay } from './play/hud.js';
import { resourcesPanel, powerPanel, dosimeter } from './play/gauges.js';
import { crewPanel } from './play/crew.js';
import { capcomPanel, modulesPanel, logPanel } from './play/side.js';
import { openEventModal } from './play/eventModal.js';
import { finishMission } from './play/finish.js';
import { viewToggle } from './play/view3d.js';
import { telemetryItems } from './play/status.js';
import { setTickerItems } from '../components/ticker.js';
import { icon } from '../icons.js';

function noMission(root) {
  root.append(h('section', { class: 'panel empty' },
    h('span', { class: 'big', 'aria-hidden': 'true' }, icon('satellite', { size: 56 })),
    h('h1', null, 'No mission in progress'),
    h('p', null, 'Pick a campaign chapter or design your own mission to start.'),
    h('div', { class: 'row' }, h('a', { class: 'btn btn-primary btn-lg', href: '#/campaign' }, '🚀 Campaign'), h('a', { class: 'btn btn-lg', href: '#/loadout/free-play' }, '🛠️ Free Play')),
    didYouKnow()));
}

function describe(m) {
  const outside = m.crew.filter((c) => isOnEva(m, c)).length;
  const parts = [`Outpost at ${m.site.name}, ${m.config.body === 'mars' ? 'sol' : 'day'} ${m.sol}.`];
  parts.push(outside ? `${outside} astronaut${outside > 1 ? 's' : ''} outside on EVA.` : 'Everyone is inside.');
  if (m.env.storm) parts.push('A dust storm darkens the sky.');
  if (m.config.body === 'moon') parts.push(m.env.lit ? 'The Sun is up.' : 'It is lunar night.');
  if (m.today?.sep) parts.push('A solar radiation storm is hitting the base.');
  return parts.join(' ');
}

const alreadyFinished = (m) => {
  const last = getState().lastResult?.mission;
  return last && last.code === m.code && last.sol === m.sol && last.config.id === m.config.id;
};

export function render(root) {
  let m = getState().savedMission;
  if (!m) { noMission(root); return undefined; }
  root.classList.add('view-wide');

  let ctx = null;
  let busy = false;
  const ctxReady = loadSimContext().then((c) => { ctx = c; return c; });
  // Backdrop: the orbiting 3D outpost by default. The painted 2D map is built only while "Map 2D" is showing
  // (or when WebGL is missing), so just one of the two ever renders.
  const canvas = h('canvas', { class: 'scene-canvas', hidden: true });
  let scene = null;
  const outpost = createOutpostBackdrop({ reducedMotion: prefersReducedMotion, onUnavailable: () => view3d.outpostUnavailable() });
  const onMode = (mode) => {
    outpost.setActive(mode === 'outpost');
    canvas.hidden = mode !== 'map';
    if (mode === 'map' && !scene) {
      scene = createScene(canvas, { label: describe(m) });
      scene.update(m, describe(m));
    } else if (mode !== 'map' && scene) {
      scene.stop();
      scene = null;
    }
  };
  const els = Object.fromEntries(['hud', 'overlay', 'res', 'power', 'rad', 'crew', 'capcom', 'mods', 'log'].map((k) => [k, h('div', { class: `slot-${k}` })]));
  const commit = (next) => { m = next; setMission(m); draw(); };
  const onTask = (crewId, task) => { play('click'); commit(setTask(m, crewId, task)); document.getElementById(`task-${crewId}-${task}`)?.focus(); };
  const onToggle = (id) => { play('click'); commit(toggleModule(m, id)); document.getElementById(`mod-switch-${id}`)?.focus(); };
  const view3d = viewToggle({ onMode, getMission: () => m, commit, onTask, onToggle, onEndSol: () => nextSol() });

  function afterRun() {
    const today = m.log.filter((l) => l.sol === m.sol);
    if (today.some((l) => l.type === 'danger' || l.type === 'fail')) play('bad');
    announce(`${m.config.body === 'mars' ? 'Sol' : 'Day'} ${m.sol} complete. ${advise(m)[0]?.text ?? ''}`);
    if (m.status !== 'active' && !alreadyFinished(m)) {
      finishMission(m);
      play(m.status === 'won' ? 'win' : 'bad');
      draw();
      requestAnimationFrame(() => els.overlay.querySelector('[data-autofocus]')?.focus());
    }
  }

  function showEvent(withEvent) {
    play('alert');
    outpost.setDimmed(true);
    return new Promise((resolve) => {
      openEventModal(withEvent, {
        onChoose: (i) => { commit(resolveEvent(m, i)); return m; },
        onDone: () => {
          if (m.phase !== 'event') {
            commit(runSol(m));
            afterRun();
          }
          outpost.setDimmed(false);
          resolve(true);
          document.getElementById('next-sol')?.focus();
        },
      });
    });
  }

  async function nextSol() {
    if (busy || m.status !== 'active') return false;
    busy = true;
    draw();
    try {
      await ctxReady;
      const started = beginSol(m, ctx ?? {});
      commit(started);
      play('sol');
      if (started.phase === 'event') return await showEvent(started);
      commit(runSol(started));
      afterRun();
      return false;
    } finally {
      busy = false;
      draw();
    }
  }

  async function runFive() {
    for (let i = 0; i < 5 && m.status === 'active'; i += 1) {
      const hadEvent = await nextSol();
      if (hadEvent) break;
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  function draw() {
    const power = computePower(m);
    const fc = forecast(m);
    mount(els.hud, hud(m, { onNext: nextSol, onRun: runFive, busy, fc }));
    mount(els.overlay, sceneOverlay(m, { onDebrief: () => navigate('debrief') }));
    mount(els.res, resourcesPanel(m, fc));
    mount(els.power, powerPanel(m, power));
    mount(els.rad, dosimeter(m));
    mount(els.crew, crewPanel(m, onTask));
    mount(els.capcom, capcomPanel(advise(m)));
    mount(els.mods, modulesPanel(m, power, onToggle));
    mount(els.log, logPanel(m));
    outpost.update(m, describe(m));
    scene?.update(m, describe(m));
    view3d.update(m);
    setTickerItems(telemetryItems(m, fc));
  }

  const onKey = (e) => {
    if (e.key !== 'n' && e.key !== 'N') return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-backdrop')) return;
    e.preventDefault();
    nextSol();
  };
  document.addEventListener('keydown', onKey);

  root.append(
    els.hud,
    h('div', { class: 'play-grid' },
      h('div', { class: ['play-stage', m.config.body] }, outpost.layer, canvas, view3d.mount, outpost.overlay, els.overlay, view3d.toggle),
      h('div', { class: 'play-side' }, els.capcom, els.power),
      h('div', { class: 'play-left' }, els.res, els.rad),
      h('div', { class: 'play-mid' }, els.crew),
      h('div', { class: 'play-right' }, els.mods, els.log)),
  );
  draw();
  if (m.phase === 'event' && m.pendingEvent) showEvent(m);

  return () => {
    outpost.stop();
    scene?.stop();
    view3d.stop();
    document.removeEventListener('keydown', onKey);
    setTickerItems(null);
  };
}
