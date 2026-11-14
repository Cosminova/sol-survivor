// Sol Survivor 3D outpost: a walkable, game-like mission trainer that drives the existing engine.
// Public API: mountOutpost3D(container, options) -> { update, setPlayer, resize, dispose }, isWebGLAvailable().
import * as THREE from 'three';
import { createStage, detectQuality, isWebGLAvailable } from './scene.js';
import { createWorld } from './world.js';
import { createFollowCamera } from './camera.js';
import { createControls } from './controls.js';
import { createHud, el } from './hud.js';
import { createMinimap } from './minimap.js';
import { createModals, helpBody, controlsTable, factCard } from './menus.js';
import { createLabels } from './labels.js';
import { createAudio } from './audio.js';
import { createRadio } from './radio.js';
import { createPlayer } from './player.js';
import { playIntro } from './intro.js';
import { injectStyles, releaseStyles } from './hudStyles.js';
import { tuningFor, dayClock } from './gameLogic.js';
import { createSolState, stepSol, recordCollect } from './gameState.js';
import { normalizeProgress, rankFor } from './progression.js';
import { AIRLOCK } from './layout.js';
import { CAPCOM } from './facts.js';
import { ROLES } from '../engine/sim.js';
import { applyEvents, frameFeedback, emitProgress, cue } from './feedback.js';
import { currentPrompt, interact, updateHold, endSolFlow, playerCrew } from './interaction.js';

export { isWebGLAvailable };

const validMission = (m) => m && typeof m === 'object' && Array.isArray(m.crew) && m.crew.length > 0 && m.config && m.modules;

function fallback(container) {
  const note = el('div', { style: 'padding:24px;color:#fff;background:#111;font:16px system-ui' }, '3D view needs WebGL, which this device or browser does not support. Use the 2D dashboard instead.');
  container.append(note);
  return { update() {}, setPlayer() {}, resize() {}, dispose() { note.remove(); } };
}

export function mountOutpost3D(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('mountOutpost3D: container must be an HTMLElement');
  if (!validMission(options.mission)) throw new TypeError('mountOutpost3D: options.mission must be a Sol Survivor mission');
  if (!isWebGLAvailable()) return fallback(container);

  injectStyles();
  const host = el('div', { class: 'w3d-host', style: 'width:100%;height:100%' });
  container.append(host);
  const reducedMotion = Boolean(options.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  host.dataset.motion = reducedMotion ? 'reduced' : 'full';
  const quality = options.quality === 'low' || options.quality === 'high' ? options.quality : detectQuality(container);
  const touch = matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;

  const stage = createStage(host, { quality });
  const labels = createLabels(host);
  const audio = createAudio({ muted: Boolean(options.muted) });
  const rt = {
    opts: options, host, stage, audio, reducedMotion,
    mission: options.mission,
    playerId: options.playerCrewId ?? options.mission.crew.find((c) => c.role === 'commander')?.id ?? options.mission.crew[0].id,
    assist: Boolean(options.assist),
    tuning: tuningFor(options.difficulty ?? options.mission.config?.difficulty ?? 'cadet', { daySeconds: options.daySeconds, assist: Boolean(options.assist) }),
    time: 0, hold: null, tmpV: new THREE.Vector3(), devilHits: new Set(), alertTimer: 0, flashT: 0,
    lastOutside: false, introPlaying: false, paused: false,
  };

  const hud = createHud(host, {
    touch,
    onSelectCrew: (id) => setPlayer(id),
    onButton: (name) => onAction(name),
    onWhy: (term) => options.onOpenTerm?.(term),
  });
  rt.hud = hud;
  const controls = createControls(host, stage.renderer.domElement, { onAction: (a, arg) => onAction(a, arg) });
  if (touch) {
    controls.attachJoystick(hud.joy, hud.knob);
    hud.act.addEventListener('pointerdown', (e) => { e.preventDefault(); onAction('interact'); });
  }
  rt.controls = controls;
  rt.modals = createModals(hud.layer, controls, { onOpen: () => { rt.paused = true; }, onClose: () => { rt.paused = false; } });
  rt.radio = createRadio(hud.radio, { readAloud: Boolean(options.readAloud), onChirp: () => cue(rt, 'radio') });
  const minimap = createMinimap(hud.map);
  const world = createWorld(stage, { high: stage.high, reducedMotion, labels });
  rt.world = world;
  world.ensure(rt.mission);
  const rig = createFollowCamera(stage.camera, { heightAt: (x, z) => world.parts.heightAt(x, z), colliders: world.parts.colliders, reducedMotion });
  rt.rig = rig;
  const player = createPlayer({ world, rig, audio });
  rt.player = player;
  hud.setMuted(audio.muted);
  rt.gs = { progress: normalizeProgress(options.progress) };

  function beginSol() {
    const p = world.parts;
    rt.gs = createSolState({ mission: rt.mission, tuning: rt.tuning, progress: rt.gs.progress, layout: p.layout, playerId: rt.playerId });
    Object.assign(rt, { ending: false, awaitingNextSol: false, recall: false, pendingAutoEnd: false, hold: null, sheltering: false, devilHits: new Set() });
    hud.setAlert(null);
    p.stations.resetDay();
    p.collectibles.spawn({ code: rt.mission.code, sol: rt.mission.sol, collected: rt.gs.progress.collected });
    p.crew.sync(rt.mission);
    p.crew.all().forEach((m) => { m.inside = m.crew.id !== rt.playerId; m.alpha = 0; });
    player.setMember(p.crew.get(rt.playerId));
    player.setHidden(false);
    player.teleportToAirlock();
    rt.radio.say(CAPCOM.welcome(playerCrew(rt).name.split(' ')[0]));
    if (rt.mission.status && rt.mission.status !== 'active') showMissionOver();
  }

  function showMissionOver() {
    const won = rt.mission.status === 'won';
    rt.modals.open({
      title: won ? '🏆 Mission complete!' : '🚨 Mission over',
      body: [el('p', null, won ? 'Your crew made it. Mission Control is celebrating!' : 'The crew had to evacuate. Every mission teaches us something. Try again!')],
      buttons: options.onExit ? [{ label: 'Back to dashboard', primary: true, onClick: () => options.onExit() }] : [{ label: 'Look around', primary: true }],
      dismiss: () => {},
    });
  }

  function setPlayer(crewId) {
    const p = world.parts;
    const m = p.crew.get(crewId);
    if (!m || crewId === rt.playerId || rt.modals.isOpen()) return;
    if (player.inRover) player.exitRover();
    player.setHidden(false);
    rt.playerId = crewId;
    p.crew.bringOutside(m);
    player.setMember(m);
    rt.hold = null;
    hud.toast(`Now controlling ${m.crew.name.split(' ')[0]} (${ROLES[m.crew.role]?.label ?? m.crew.role}): ${ROLES[m.crew.role]?.bonus ?? ''}`);
  }

  function openPause() {
    if (rt.modals.isOpen()) return;
    const buttons = [
      { label: audio.muted ? '🔊 Sound on' : '🔇 Sound off', onClick: () => { toggleMute(); openPause(); } },
      { label: rt.assist ? '🎯 Easy mode: ON' : '🎯 Easy mode: OFF', onClick: () => { rt.assist = !rt.assist; rt.tuning = tuningFor(options.difficulty ?? rt.mission.config?.difficulty ?? 'cadet', { daySeconds: options.daySeconds, assist: rt.assist }); rt.gs = { ...rt.gs, tuning: rt.tuning }; openPause(); } },
      { label: 'Controls', onClick: () => rt.modals.open({ title: 'Controls', body: controlsTable(), buttons: [{ label: 'Back', primary: true, onClick: openPause }], dismiss: openPause }) },
    ];
    if (options.onExit) buttons.push({ label: '⬅ Back to 2D dashboard', onClick: () => options.onExit() });
    buttons.push({ label: '▶ Resume', primary: true });
    rt.modals.open({ title: '⏸ Paused', body: [el('p', null, `Rank: ${rankFor(rt.gs.progress.xp).rank.label} · ${rt.gs.progress.xp} XP · Artifacts: ${rt.gs.progress.collected.length}`)], buttons, dismiss: () => {} });
  }

  function toggleMute() {
    audio.setMuted(!audio.muted);
    hud.setMuted(audio.muted);
  }

  function onAction(action, arg) {
    if (rt.introPlaying) { if (['interact', 'pause', 'skipIntro'].includes(action)) rt.intro?.skip(); return; }
    audio.unlock();
    const crew = rt.mission.crew;
    if (action === 'interact') interact(rt);
    else if (action === 'pause') openPause();
    else if (action === 'help') rt.modals.open({ title: '❓ How to play', body: helpBody(world.parts.body), buttons: [{ label: 'Got it!', primary: true }], dismiss: () => {} });
    else if (action === 'mute') toggleMute();
    else if (action === 'why') { const pr = currentPrompt(rt); if (pr?.why) options.onOpenTerm?.(pr.why.term); }
    else if (action === 'select' && crew[arg]) setPlayer(crew[arg].id);
    else if (action === 'switch') {
      const i = crew.findIndex((c) => c.id === rt.playerId);
      setPlayer(crew[(i + (arg ?? 1) + crew.length) % crew.length].id);
    }
  }

  function zones() {
    const pos = player.position();
    const p = world.parts;
    const airlock = Math.hypot(pos.x - AIRLOCK.x, pos.z - AIRLOCK.z) < 2.6;
    const shelter = p.layout.stations.find((s) => s.kind === 'shelter');
    const inShelter = Boolean(shelter && Math.hypot(pos.x - shelter.spots[0].x, pos.z - shelter.spots[0].z) < 2.6);
    const hidden = player.hidden;
    const inRover = player.inRover;
    return { outside: !hidden && !inRover && !airlock && !inShelter, refilling: airlock || inRover || hidden, sheltered: hidden || airlock || inShelter, inShelter, inRover };
  }

  function step(dt, input) {
    const p = world.parts;
    const z0 = zones();
    const pos0 = player.position();
    const push = p.hazards.devilPushAt(pos0.x, pos0.z);
    if (rt.workTimer > 0) rt.workTimer -= dt;
    player.update(dt, input, { frozen: Boolean(rt.hold), push, reducedMotion, night: rt.night, work: rt.hold ? 'repair' : rt.workTimer > 0 ? rt.lastWorkVerb : null });
    if (Math.hypot(push.x, push.z) > 0.5 && Math.random() < dt * 2) rig.shake(0.08);
    const r = stepSol(rt.gs, { dt, ...z0, running: input.run && Math.hypot(input.x, input.y) > 0.2, playerId: rt.playerId });
    rt.gs = r.state;
    rt.lastOutside = z0.outside;
    applyEvents(rt, r.events);
    updateHold(rt, dt);
    const picked = p.collectibles.update(rt.time, player.position());
    if (picked) {
      const res = recordCollect(rt.gs, picked.id);
      rt.gs = res.state;
      applyEvents(rt, res.events);
      cue(rt, 'pickup');
      rt.modals.open({ title: '✨ Artifact found!', body: factCard({ icon: picked.icon, title: picked.name, text: picked.fact }), buttons: [{ label: 'Add to collection', primary: true }], dismiss: () => {} });
    }
    p.crew.update({ dt, mission: rt.mission, playerId: rt.playerId, recall: rt.recall, damaged: rt.gs.damaged, gravity: player.gravity(), reducedMotion, night: rt.night });
    frameFeedback(rt, dt, z0);
    if (rt.pendingAutoEnd && !rt.modals.isOpen()) { rt.pendingAutoEnd = false; endSolFlow(rt, { auto: true }); }
    return z0;
  }

  let hudT = 0;
  let labelT = 0;
  function refreshHud(z) {
    const p = world.parts;
    const clock = dayClock(rt.gs.elapsed, rt.tuning.daySeconds);
    hud.setSol({ sol: rt.mission.sol, site: rt.mission.site?.name ?? '', hours: clock.hours, t: clock.t, body: p.body });
    hud.setObjectives(rt.gs.objectives);
    const rk = rankFor(rt.gs.progress.xp);
    hud.setRank({ rank: rk.rank, xp: rt.gs.progress.xp, progress: rk.progress, next: rk.next, combo: rt.gs.combo });
    hud.setRoster(rt.mission.crew, rt.playerId);
    hud.setSuit({ o2: rt.gs.o2[rt.playerId] ?? 1, dose: rt.gs.dose, rate: rt.gs.doseRate ?? 0, outside: z.outside, inRover: z.inRover, cold: rt.gs.cold });
    hud.setPrompt(rt.modals.isOpen() ? null : currentPrompt(rt));
    const pos = player.position();
    minimap.draw({
      layout: p.layout, player: pos, heading: player.heading, damaged: rt.gs.damaged, broken: rt.mission.broken ?? {},
      npcs: p.crew.all().filter((m) => m.crew.id !== rt.playerId).map((m) => ({ x: m.pos.x, z: m.pos.z, inside: m.inside, color: '#7fe3ff' })),
      collectibles: p.collectibles.positions(), devils: p.hazards.devilPositions(),
    });
  }

  let raf = 0;
  let last = performance.now();
  let lastZones = { outside: false, inRover: false };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (stage.isLost() || !host.isConnected) return;
    rt.time += dt;
    const input = controls.read();
    const p = world.parts;
    const paused = rt.paused || rt.introPlaying || document.hidden || rt.ending;
    if (!paused) lastZones = step(dt, input);
    else p.crew.update({ dt: 0, mission: rt.mission, playerId: rt.playerId, recall: rt.recall, damaged: rt.gs.damaged, gravity: player.gravity(), reducedMotion, night: rt.night });
    rt.radio.update(dt);
    rt.flashT = Math.max(0, rt.flashT - dt * 0.8);
    const clock = dayClock(rt.gs.elapsed, rt.tuning.daySeconds);
    const env = world.updateEnvironment({ mission: rt.mission, t: clock.t, stormActive: rt.gs.stormActive || p.hazards.stormArrived(), flash: rt.flashT, focus: player.position(), dt });
    rt.night = env.night;
    p.stations.update({ mission: rt.mission, sunDir: env.sun, night: env.night, time: rt.time, dt, damaged: rt.gs.damaged });
    p.particles.update(dt, { camera: stage.camera });
    p.hazards.update(dt, { time: rt.time, focus: player.position() });
    rig.update(dt, player.position(), paused && !rt.introPlaying ? {} : input.look);
    hudT -= dt;
    if (hudT <= 0) { refreshHud(lastZones); hudT = 0.1; }
    labelT -= dt;
    if (labelT <= 0) {
      const pos = player.position();
      for (const l of p.stationLabels) {
        const near = Math.hypot(l.station.x - pos.x, l.station.z - pos.z) < 16;
        const alert = (rt.mission.broken?.[l.station.moduleId] ?? 0) > 0 || rt.gs.damaged[l.station.moduleId] != null;
        l.show(near || alert);
        l.obj.element.dataset.alert = String(alert);
      }
      labelT = 0.25;
    }
    stage.renderer.render(stage.scene, stage.camera);
    labels.render(stage.scene, stage.camera);
  }

  function resize() {
    const w = host.clientWidth || container.clientWidth;
    const h = host.clientHeight || container.clientHeight;
    stage.setSize(w, h);
    labels.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  beginSol();
  const wantIntro = options.intro !== false && !rt.gs.progress.introSeen && (rt.mission.sol === 0 || options.intro === true);
  if (wantIntro) {
    rt.introPlaying = true;
    rt.intro = playIntro({
      world, rig, hud, audio, reducedMotion,
      title: `${rt.mission.config?.title ?? 'Sol Survivor'} · ${rt.mission.site?.name ?? ''}`,
      getPlayerFocus: () => player.position(),
      onDone: () => {
        rt.introPlaying = false;
        rt.gs = { ...rt.gs, progress: { ...rt.gs.progress, introSeen: true } };
        rig.lookBehind(0);
        emitProgress(rt);
        hud.toast('Press H for controls. Walk to a station and press E!', 'good');
      },
    });
  } else {
    hud.toast('Press H for controls. Walk to a station and press E!', 'good');
  }
  raf = requestAnimationFrame(frame);

  function update(mission) {
    if (!validMission(mission)) return;
    const prevSol = rt.mission.sol;
    const prevSig = world.parts;
    rt.mission = mission;
    const p = world.ensure(mission);
    if (p !== prevSig) {
      rig.setColliders(p.colliders);
      rt.gs = { ...rt.gs, sol: -1 };
    }
    p.crew.sync(mission);
    if (!mission.crew.some((c) => c.id === rt.playerId)) rt.playerId = mission.crew[0].id;
    if (mission.sol !== prevSol || rt.gs.sol !== mission.sol) {
      rt.modals.close();
      beginSol();
    } else if (mission.status && mission.status !== 'active' && !rt.modals.isOpen()) {
      showMissionOver();
    }
  }

  let disposed = false;
  return {
    update,
    setPlayer,
    resize,
    debug: () => rt, // dev/test hook (harness + browser checks)
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(rt.autoEndTimer);
      ro.disconnect();
      rt.cancelMinigame?.();
      rt.modals.close();
      controls.dispose();
      rt.radio.dispose();
      audio.dispose();
      world.dispose();
      labels.dispose();
      hud.dispose();
      stage.dispose();
      host.remove();
      releaseStyles();
    },
  };
}
