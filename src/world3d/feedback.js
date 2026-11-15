// Turns pure game events into juice: sounds + captions, CAPCOM radio, HUD alerts, particles,
// camera shake and the optional coordinator callbacks (onPenalty, onProgress, onHazard).
import { CAPCOM, STATION_INFO } from './facts.js';
import { CAPTIONS } from './audio.js';
import { O2_LOW, PENALTY } from './gameLogic.js';
import { makeRng, hashString } from './rng.js';
import { dayKey, daysText } from '../ui/kid/words.js';

const PENALTY_TEXT = { night: 'caught outside after dark', o2: 'ran out of suit oxygen', radiation: 'took a radiation dose', cold: 'got too cold' };

export function cue(rt, name) {
  rt.audio.sfx[name]?.();
  if (CAPTIONS[name]) rt.hud.setCaption(CAPTIONS[name]);
}

function screenOf(rt, p) {
  const v = rt.tmpV.set(p.x, p.y, p.z).project(rt.stage.camera);
  const r = rt.host.getBoundingClientRect();
  return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
}

function nameOf(rt, crewId) {
  return (rt.mission.crew.find((c) => c.id === crewId)?.name ?? 'Crew').split(' ')[0];
}

export function emitProgress(rt) {
  const p = rt.gs.progress;
  const key = `${p.xp}|${p.collected.length}|${p.objectivesDone}|${p.introSeen}|${p.bestCombo}`;
  if (key === rt.progressKey) return;
  rt.progressKey = key;
  rt.opts.onProgress?.({ xp: p.xp, rank: p.rank, collected: [...p.collected], objectivesDone: p.objectivesDone, introSeen: p.introSeen, bestCombo: p.bestCombo });
}

function onHazardWarn(rt, h) {
  const { radio, hud, world } = rt;
  if (h.type === 'sepStorm') {
    cue(rt, 'siren');
    radio.say(CAPCOM.stormWarn(Math.round(h.lead)), { tone: 'alert', priority: true });
  } else if (h.type === 'dustDevil') {
    world.parts.hazards.spawnDevil(h, rt.player.position());
    radio.say(CAPCOM.devil);
    cue(rt, 'wind');
  } else if (h.type === 'micrometeoroid') {
    rt.audio.sfx.whoosh();
    hud.setCaption('[high-pitched whistle]');
  } else if (h.type === 'dustStorm') {
    world.parts.hazards.startStormWall(h.lead);
    radio.say(CAPCOM.dustStorm, { tone: 'alert' });
    hud.setAlert('🌪️ Dust storm rolling in from the horizon!', 'info');
    rt.alertTimer = 8;
  }
}

function onHazardStart(rt, h) {
  const { radio, hud, world, opts } = rt;
  const p = world.parts;
  if (h.type === 'sepStorm') {
    rt.flashT = 1;
    hud.flash(0.5, '#ff9de2');
    cue(rt, 'siren');
    if (rt.lastOutside) radio.say(CAPCOM.stormHit, { tone: 'alert', priority: true });
    opts.onHazard?.({ type: 'sepStorm', phase: 'start', severity: h.severity });
  } else if (h.type === 'micrometeoroid') {
    const target = p.stations.anchor(h.moduleId, 1) ?? p.stations.anchor('habitat', 1);
    p.hazards.meteorStrike(target, () => {
      cue(rt, 'impact');
      rt.rig.shake(0.35);
      p.particles.burst(target, { count: 60, color: '#ffb36b', speed: 7, up: 4 });
      p.particles.dustCloud(target, { count: 30, speed: 4 });
      radio.say(CAPCOM.meteor(STATION_INFO[h.moduleId]?.name ?? h.moduleId), { tone: 'alert', priority: true });
      hud.toast(`☄️ ${STATION_INFO[h.moduleId]?.name ?? h.moduleId} hit! Repair it in time.`, 'bad');
      opts.onHazard?.({ type: 'micrometeoroid', phase: 'strike', moduleId: h.moduleId });
    });
  } else if (h.type === 'dustStorm') {
    hud.toast('🌪️ The dust storm is here. Panels will get dusty.', 'bad');
    opts.onHazard?.({ type: 'duststorm', phase: 'start' });
  } else if (h.type === 'lunarNight') {
    radio.say(CAPCOM.cold, { tone: 'alert' });
  } else if (h.type === 'dustStormActive') {
    radio.say('CAPCOM: Big dust storm today. Visibility is low, so stay close to base and watch your panels.', { tone: 'alert' });
  }
}

export function applyEvents(rt, events) {
  const { radio, hud, opts } = rt;
  for (const e of events) {
    switch (e.type) {
      case 'dusk':
        cue(rt, 'radio');
        radio.say(CAPCOM.dusk, { tone: 'alert', priority: true });
        hud.setAlert('🌇 Sunset soon: get back to the habitat!', 'info');
        rt.alertTimer = 8;
        rt.recall = true;
        break;
      case 'nightfall':
        radio.say(CAPCOM.nightfall, { priority: true });
        for (const m of rt.world.parts.crew.all()) {
          if (m.crew.id !== rt.playerId && !m.inside) opts.onPenalty?.({ crewId: m.crew.id, kind: 'night', amount: PENALTY.night });
        }
        rt.pendingAutoEnd = true;
        break;
      case 'o2Low':
        cue(rt, 'alarm');
        radio.say(CAPCOM.o2Low, { tone: 'alert', priority: true });
        break;
      case 'o2Out':
        radio.say(CAPCOM.o2Out, { tone: 'alert', priority: true });
        hud.flash(0.7, '#ff2a2a');
        rt.rig.shake(0.3);
        rt.player.teleportToAirlock();
        rt.cancelMinigame?.();
        rt.hold = null;
        break;
      case 'penalty':
        opts.onPenalty?.({ crewId: e.crewId, kind: e.kind, amount: e.amount });
        hud.toast(`⚠️ ${nameOf(rt, e.crewId)} ${PENALTY_TEXT[e.kind] ?? e.kind}`, 'bad');
        break;
      case 'hazardWarn': onHazardWarn(rt, e.hazard); break;
      case 'hazardStart': onHazardStart(rt, e.hazard); break;
      case 'hazardEnd':
        if (e.hazard.type === 'sepStorm') { radio.say('CAPCOM: Particle levels are dropping. All clear!'); hud.setAlert(null); }
        if (e.hazard.type === 'dustDevil') rt.world.parts.hazards.endDevil(e.hazard.id);
        break;
      case 'shelteredInTime':
        radio.say(CAPCOM.stormSafe, { priority: true });
        hud.toast('🛡️ Sheltered in time! +30 XP', 'good');
        break;
      case 'damageExpired':
        hud.toast(`💥 The ${STATION_INFO[e.moduleId]?.name ?? e.moduleId} failed. Assign someone to Maintain.`, 'bad');
        opts.onHazard?.({ type: 'micrometeoroid', phase: 'expired', moduleId: e.moduleId });
        break;
      case 'damageRepaired':
        radio.say(CAPCOM.meteorFixed);
        opts.onHazard?.({ type: 'micrometeoroid', phase: 'repaired', moduleId: e.moduleId });
        break;
      case 'xp': {
        const pos = rt.player.position();
        const s = screenOf(rt, { x: pos.x, y: pos.y + 2.2, z: pos.z });
        hud.floatText(`+${e.amount} XP`, s.x + (Math.random() - 0.5) * 40, s.y);
        if (e.amount >= 10) rt.audio.sfx.xp();
        break;
      }
      case 'levelUp': {
        hud.levelUp(e.rank);
        cue(rt, 'levelUp');
        radio.say(CAPCOM.levelUp(e.rank.label), { priority: true });
        const pos = rt.player.position();
        rt.world.parts.particles.burst({ x: pos.x, y: pos.y + 2, z: pos.z }, { count: 90, color: '#ffd23f', speed: 6, up: 5 });
        break;
      }
      case 'objectiveDone':
        hud.toast(`✓ Objective: ${e.label}`, 'good');
        rt.audio.sfx.success();
        if (e.id === 'assignAll') radio.say(daysText(CAPCOM.allAssigned, dayKey(rt.mission.config)));
        break;
      case 'allObjectives':
        hud.toast('🏆 All objectives complete! +50 XP', 'good');
        break;
      case 'combo':
        hud.toast(`🔥 Combo ×${e.combo}!`, 'good');
        break;
      default:
        break;
    }
  }
  if (events.length) emitProgress(rt);
}

// Per-frame alerts: storm countdown, low-oxygen vignette + heartbeat, dust devils over the panels.
export function frameFeedback(rt, dt, { outside }) {
  const { gs, hud, world } = rt;
  const p = world.parts;
  const sep = gs.hazards.find((h) => h.type === 'sepStorm' && h.status === 'warning');
  if (sep) {
    const left = Math.max(0, Math.ceil(sep.at * gs.tuning.daySeconds - gs.elapsed));
    hud.setAlert(`☢ SOLAR STORM in ${left} s: get inside the habitat${p.layout.stations.some((s) => s.kind === 'shelter') ? ' or storm shelter' : ''}!`, 'danger');
    if (left !== rt.lastCount) { rt.lastCount = left; if (left <= 10) rt.audio.sfx.tick(); }
  } else if (gs.sepActive) {
    hud.setAlert(outside ? '☢ SOLAR STORM: you are outside! Get to cover!' : '🛡️ Solar storm passing. You are safe inside.', outside ? 'danger' : 'info');
  } else if (rt.alertTimer > 0) {
    rt.alertTimer -= dt;
    if (rt.alertTimer <= 0 && !rt.awaitingNextSol) hud.setAlert(null);
  }
  const o2 = gs.o2[rt.playerId] ?? 1;
  rt.beat = (rt.beat ?? 0) - dt;
  if (outside && o2 < O2_LOW) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    hud.setVignette(0.35 + 0.35 * pulse * (rt.reducedMotion ? 0.3 : 1));
    if (rt.beat <= 0) { cue(rt, 'heartbeat'); rt.beat = o2 < 0.1 ? 0.55 : 0.9; }
    rt.alarmT = (rt.alarmT ?? 0) - dt;
    if (rt.alarmT <= 0) { rt.audio.sfx.alarm(); rt.alarmT = 3; }
  } else {
    hud.setVignette(gs.sepActive && outside ? 0.35 : 0);
  }
  rt.audio.setBreathing(outside && !rt.audio.muted, o2 < O2_LOW ? 1.8 : 1);

  // Dust devils crossing the solar field: sometimes they coat panels, sometimes they clean them (like Spirit's).
  const solar = p.layout.stations.find((s) => s.kind === 'solar');
  if (solar) {
    for (const d of p.hazards.devilPositions()) {
      const key = `${Math.round(d.x / 30)}`;
      if (Math.hypot(d.x - solar.x, d.z - solar.z) < 9 && !rt.devilHits.has(key)) {
        rt.devilHits.add(key);
        const cleaned = makeRng(hashString(`${rt.mission.code}:${gs.sol}:${rt.devilHits.size}`)).chance(0.4);
        rt.radio.say(cleaned ? CAPCOM.devilClean : CAPCOM.devilDust);
        if (cleaned) solar.panels.forEach((_, i) => p.stations.wipePanel(i, 1));
        rt.opts.onHazard?.({ type: 'dustDevil', phase: 'panels', effect: cleaned ? 'cleaned' : 'dusted' });
      }
    }
  }
}
