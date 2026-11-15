// Mission Control. Cadet view (the default): the 3D outpost is the hero and ONE sidebar holds the three
// picture meters, today's plan and the Next day button. Expert view: the full flight-control HUD with gauges,
// crew, CAPCOM and log. Both drive the same engine and the same sol loop.
import '../../styles/play.css';
import '../../styles/outpost3d.css';
import { h, mount, announce, prefersReducedMotion } from '../dom.js';
import { beginSol, resolveEvent, runSol, setTask, toggleModule, computePower, isOnEva, createMission } from '../../engine/sim.js';
import { forecast, advise } from '../../engine/advisor.js';
import { getState, setMission, subscribe } from '../../state/store.js';
import { loadSimContext } from '../../state/nasaData.js';
import { TUTORIAL } from '../../data/missions.js';
import { onLive } from '../../live/liveData.js';
import { createScene } from '../scene.js';
import { createOutpostBackdrop } from '../outpost3d/host.js';
import { navigate } from '../router.js';
import { play } from '../audio.js';
import { didYouKnow, toast } from '../components/common.js';
import { openCrewPopup, openCrewList, closeCrewPopup } from '../components/crewPopup.js';
import { showEffect, clearEffects } from '../components/effectPopup.js';
import { hud, sceneOverlay } from './play/hud.js';
import { resourcesPanel, powerPanel, dosimeter } from './play/gauges.js';
import { crewPanel } from './play/crew.js';
import { capcomPanel, modulesPanel, logPanel } from './play/side.js';
import { openEventModal } from './play/eventModal.js';
import { finishMission } from './play/finish.js';
import { viewToggle } from './play/view3d.js';
import { telemetryItems } from './play/status.js';
import { metersPanel } from './play/meters.js';
import { todayPanel, nextButton } from './play/today.js';
import { walkCues, walkCueCard, NEW_DAY_REMINDER_DAYS } from '../kid/walkCues.js';
import { sideHead, sideTools } from './play/sidebar.js';
import { createDrawer, drawerContent } from './play/drawer.js';
import { setTickerItems } from '../components/ticker.js';
import { icon } from '../icons.js';
import { isExpertView, setForceCadet } from '../kid/view.js';
import { applyPlan, availablePlans, currentPlan, planById, previewPlan, simulateNextDay, meterStates } from '../kid/plans.js';
import { dayEffects } from '../kid/effects.js';
import { createTutorial, openRecap, TUTORIAL_ROUTE } from '../tutorial/tutorial.js';

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

export function render(root, route) {
  // Training runs the real engine on a mission that lives only in memory: it is never saved or scored,
  // so a mission already in progress is left alone.
  const tutorialMode = route?.query?.tutorial === '1';
  let m = tutorialMode
    ? createMission({ config: TUTORIAL, loadout: TUTORIAL.loadout, difficulty: 'cadet', code: TUTORIAL.code })
    : getState().savedMission;
  if (!m) { noMission(root); return undefined; }
  root.classList.add('view-wide');
  setForceCadet(tutorialMode);

  let ctx = null;
  let busy = false;
  let stopped = false;
  const ctxReady = loadSimContext().then((c) => { ctx = c; return c; });
  // Backdrop: the orbiting 3D outpost by default. The painted 2D map is built only while "Map 2D" is showing
  // (or when WebGL is missing), so just one of the two ever renders.
  const canvas = h('canvas', { class: 'scene-canvas', hidden: true });
  let scene = null;
  const outpost = createOutpostBackdrop({ reducedMotion: prefersReducedMotion, onUnavailable: () => view3d.outpostUnavailable() });
  let walkedSol = -1; // the last day the player opened Walk 3D, for the "jobs outside" cues
  const walkedToday = () => walkedSol === m.sol || view3d.mode() === 'walk';
  const onMode = (mode) => {
    if (mode === 'walk' && walkedSol !== m.sol) { walkedSol = m.sol; if (els.hud.isConnected) draw(); }
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
  const els = Object.fromEntries(['hud', 'overlay', 'res', 'power', 'rad', 'crew', 'capcom', 'mods', 'log', 'head', 'meters', 'today', 'walk', 'next', 'tools'].map((k) => [k, h('div', { class: `slot-${k}` })]));
  const commit = (next) => { m = next; if (!tutorialMode) setMission(m); draw(); };
  const onTask = (crewId, task) => { play('click'); commit(setTask(m, crewId, task)); document.getElementById(`task-${crewId}-${task}`)?.focus(); };
  const onToggle = (id) => {
    play('click');
    commit(toggleModule(m, id));
    (document.getElementById(`mod-switch-${id}`) ?? document.getElementById(`switch-${id}`))?.focus();
    tutorial?.emit('switch', id);
  };
  const view3d = viewToggle({ onMode, getMission: () => m, commit, onTask, onToggle, onEndSol: () => nextSol(), tours: !tutorialMode });

  // ---- Cadet view state: which meter shows its numbers, the phone plan sheet, the drawer, the live Sun ----
  let openMeter = null;
  let sheetOpen = true;
  let live = null;
  const drawer = createDrawer();
  const stopLive = onLive((next) => { live = next; if (!stopped && els.hud.isConnected) draw(); });
  const onMeter = (id) => {
    openMeter = openMeter === id ? null : id;
    draw();
    document.getElementById(`meter-${id}`)?.focus();
    if (openMeter) tutorial?.emit('meter', id);
  };
  const onPlan = (id) => {
    play('click');
    openMeter = null; // make room for the plan preview
    commit(applyPlan(m, id));
    document.getElementById(`plan-${id}`)?.focus();
    announce(`Plan chosen: ${planById(id)?.title ?? id}.`);
    tutorial?.emit('plan', id);
  };
  const onSheet = () => { sheetOpen = !sheetOpen; draw(); document.getElementById('sheet-toggle')?.focus(); };
  const onCrew = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openCrewList(m, { anchor: { x: r.left + r.width / 2, y: r.top - 8 } });
  };
  // Name tags in the 3D walk view ask for one astronaut's stats (see src/world3d).
  const onCrewSelect = (e) => {
    const { crewId, anchor } = e.detail ?? {};
    if (crewId) openCrewPopup(crewId, m, { anchor });
  };
  document.addEventListener('sol:crew-select', onCrewSelect);

  const restartTutorial = () => navigate(`${TUTORIAL_ROUTE}&r=${Date.now()}`);
  const showRecap = () => openRecap({
    onAction: (what) => {
      if (what === 'mission') navigate('loadout/artemis-dawn?quick=1');
      else if (what === 'again') restartTutorial();
      else navigate('home');
    },
  });
  const tutorial = tutorialMode ? createTutorial({
    onSkip: () => toast('Tutorial skipped. Press Tutorial to see it again.', { icon: 'lightbulb' }),
    onComplete: showRecap,
  }) : null;

  function afterRun(before) {
    const today = m.log.filter((l) => l.sol === m.sol);
    if (today.some((l) => l.type === 'danger' || l.type === 'fail')) play('bad');
    announce(`${m.config.body === 'mars' ? 'Sol' : 'Day'} ${m.sol} complete. ${advise(m)[0]?.text ?? ''}`);
    // Big results of the day as one popup (Cadet view; the coach does the talking during training).
    // When the mission has just ended, the end-of-mission card says it all.
    if (m.status !== 'active') clearEffects();
    else if (!isExpertView() && !tutorial?.active()) showEffect(dayEffects(before, m, ctx ?? {}));
    tutorial?.emit('day-end');
    if (tutorialMode) {
      if (m.status !== 'active') { if (tutorial.active()) tutorial.emit('mission-over'); else showRecap(); }
      return;
    }
    if (m.status !== 'active' && !alreadyFinished(m)) {
      finishMission(m);
      play(m.status === 'won' ? 'win' : 'bad');
      draw();
      requestAnimationFrame(() => els.overlay.querySelector('[data-autofocus]')?.focus());
    }
  }

  function showEvent(withEvent, before) {
    play('alert');
    outpost.setDimmed(true);
    closeCrewPopup({ restoreFocus: false });
    return new Promise((resolve) => {
      openEventModal(withEvent, {
        onChoose: (i) => { commit(resolveEvent(m, i)); return m; },
        onPicked: () => tutorial?.emit('event-pick'),
        onDone: () => {
          if (m.phase !== 'event') {
            commit(runSol(m));
            afterRun(before);
          }
          outpost.setDimmed(false);
          resolve(true);
          document.getElementById('next-sol')?.focus();
          tutorial?.emit('event-close');
        },
      });
      tutorial?.emit('event-open');
    });
  }

  // First few days only: a nudge that today's jobs can be done by hand in Walk 3D.
  function remindWalk() {
    if (tutorialMode || m.status !== 'active' || m.sol > NEW_DAY_REMINDER_DAYS || view3d.mode() === 'walk') return;
    toast('New day! Jobs are waiting outside. Open Walk 3D to do them yourself.', { icon: 'rover' });
  }

  async function nextSol() {
    if (busy || m.status !== 'active') return false;
    busy = true;
    draw();
    try {
      await ctxReady;
      const before = m;
      const started = beginSol(m, ctx ?? {});
      commit(started);
      play('sol');
      if (started.phase === 'event') return await showEvent(started, before);
      commit(runSol(started));
      afterRun(before);
      remindWalk();
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

  // Expert view: the full flight-control HUD, exactly as before.
  function drawExpert(power, fc) {
    mount(els.hud, hud(m, { onNext: nextSol, onRun: runFive, busy, fc }));
    mount(els.res, resourcesPanel(m, fc));
    mount(els.power, powerPanel(m, power));
    mount(els.rad, dosimeter(m));
    mount(els.crew, crewPanel(m, onTask));
    mount(els.capcom, capcomPanel(advise(m), m.config.body));
    mount(els.mods, modulesPanel(m, power, onToggle));
    mount(els.log, logPanel(m));
    for (const key of ['head', 'meters', 'today', 'next', 'tools']) mount(els[key]);
    drawer.close();
    clearEffects();
  }

  // Cadet view: the outpost, three picture meters and one decision. Previews run the engine on a copy.
  function drawCadet(power) {
    const simCtx = ctx ?? {};
    const sim = simulateNextDay(m, simCtx);
    const sims = Object.fromEntries(availablePlans(m).map((p) => [p.id, previewPlan(m, p.id, simCtx)]));
    if (!('fix' in sims)) sims.fix = previewPlan(m, 'fix', simCtx);
    for (const key of ['hud', 'res', 'power', 'rad', 'crew', 'capcom', 'mods', 'log']) mount(els[key]);
    mount(els.head, sideHead(m, { live, sheetOpen, onSheet }));
    mount(els.meters, metersPanel(m, meterStates(m, sim), { sim, open: openMeter, onToggle: onMeter }));
    mount(els.today, todayPanel(m, { sims, sim, selected: currentPlan(m), busy, onPlan, onToggle }));
    mount(els.walk, tutorialMode ? null : walkCueCard(walkCues(m, { visitedToday: walkedToday() }), { onGo: () => view3d.show('walk') }));
    mount(els.next, nextButton(m, { busy, onNext: nextSol }));
    mount(els.tools, sideTools({ tutorial: tutorialMode, onCrew, onDetails: () => { drawer.open(); draw(); }, onTutorial: restartTutorial }));
    if (drawer.isOpen()) drawer.render(drawerContent(m, { power, onToggle }));
  }

  function draw() {
    const power = computePower(m);
    const fc = forecast(m);
    const expert = isExpertView();
    grid.className = `play-grid ${expert ? 'is-expert' : 'is-cadet'}${sheetOpen ? '' : ' sheet-closed'}`;
    if (expert) drawExpert(power, fc); else drawCadet(power);
    mount(els.overlay, sceneOverlay(m, { onDebrief: () => navigate('debrief'), training: tutorialMode }));
    outpost.update(m, describe(m));
    scene?.update(m, describe(m));
    view3d.update(m);
    const cues = walkCues(m, { visitedToday: walkedToday() });
    view3d.cueWalk(!tutorialMode && cues.show && view3d.mode() !== 'walk', cues.urgent[0] ?? cues.bonus);
    setTickerItems(telemetryItems(m, fc));
  }

  const onKey = (e) => {
    if (e.key !== 'n' && e.key !== 'N') return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-backdrop, .coach, .crew-pop') || drawer.isOpen()) return;
    e.preventDefault();
    nextSol();
  };
  document.addEventListener('keydown', onKey);
  // Cadet view / Expert view: the panel renderers read settings.expertView; redraw when it flips.
  let expertView = getState().settings.expertView;
  const stopViewWatch = subscribe((st) => {
    if (!els.hud.isConnected) { stopViewWatch(); return; }
    if (st.settings.expertView !== expertView) { expertView = st.settings.expertView; draw(); }
  });

  const grid = h('div', { class: 'play-grid' },
    h('div', { class: ['play-stage', m.config.body] }, outpost.layer, canvas, view3d.mount, outpost.overlay, els.overlay, view3d.toggle),
    h('aside', { class: 'kid-side', 'aria-label': 'Mission controls' },
      h('div', { class: 'kid-side-scroll' }, els.head, els.meters, els.today),
      h('div', { class: 'kid-side-foot' }, els.walk, els.next, els.tools)),
    h('div', { class: 'play-side' }, els.capcom, els.power),
    h('div', { class: 'play-left' }, els.res, els.rad),
    h('div', { class: 'play-mid' }, els.crew),
    h('div', { class: 'play-right' }, els.mods, els.log));
  root.append(els.hud, grid, drawer.el);
  draw();
  // The saved-game context (Mars weather, real storm dates) sharpens the previews once it has loaded.
  ctxReady.then(() => { if (!stopped && els.hud.isConnected) draw(); }).catch(() => {});
  if (m.phase === 'event' && m.pendingEvent) showEvent(m, m);
  if (tutorial) requestAnimationFrame(() => { if (!stopped) tutorial.start(); });

  return () => {
    stopped = true;
    tutorial?.stop();
    stopLive?.();
    drawer.stop();
    closeCrewPopup({ restoreFocus: false });
    clearEffects();
    setForceCadet(false);
    document.removeEventListener('sol:crew-select', onCrewSelect);
    outpost.stop();
    scene?.stop();
    view3d.stop();
    document.removeEventListener('keydown', onKey);
    setTickerItems(null);
  };
}
