import { describe, it, expect } from 'vitest';
import { createMission, setTask } from '../src/engine/sim.js';
import { CAMPAIGN } from '../src/data/missions.js';
import { buildLayout, padsFor, nearestStation, scatterPoints, layoutSignature, WORLD_LIMIT, AIRLOCK } from '../src/world3d/layout.js';
import { makeHeightfield } from '../src/world3d/heightfield.js';
import { polarGeometry } from '../src/world3d/terrain.js';
import { stationActions, promptText, verbFor } from '../src/world3d/actions.js';
import { dayClock, tuningFor, suitO2Step, doseRatePerHour, sunDirection, earthDirection, formatClock } from '../src/world3d/gameLogic.js';
import { rankFor, addXp, xpForTask, nextCombo, generateObjectives, applyObjective, normalizeProgress, remainingCollectibles } from '../src/world3d/progression.js';
import { scheduleHazards, hazardPhase } from '../src/world3d/hazards.js';
import { createSolState, stepSol, recordTaskResult, recordAssign, recordCollect, endSolState, solSummary } from '../src/world3d/gameState.js';
import * as mg from '../src/world3d/minigameScoring.js';
import { npcTarget, resolveCollisions, steer } from '../src/world3d/npcLogic.js';
import { makeRng } from '../src/world3d/rng.js';
import { GLOSSARY } from '../src/data/glossary.js';
import { STATION_INFO } from '../src/world3d/facts.js';

const mars = () => createMission({ config: CAMPAIGN[2], loadout: CAMPAIGN[2].recommended, code: 'DEMO3D' }, {});
const moon = () => createMission({ config: CAMPAIGN[0], loadout: CAMPAIGN[0].recommended, code: 'DEMO3D' }, {});
const bigLoadout = () => createMission({ config: CAMPAIGN[5], loadout: CAMPAIGN[5].recommended, code: 'BIG' }, {});

describe('world3d layout', () => {
  it('only builds stations for packed modules', () => {
    const layout = buildLayout(mars());
    const kinds = layout.stations.map((s) => s.kind);
    expect(kinds).toContain('habitat');
    expect(kinds).toContain('solar');
    expect(kinds).toContain('moxie');
    expect(kinds).not.toContain('greenhouse');
    expect(kinds).not.toContain('rover');
    expect(kinds).toContain('fission'); // Red Dust now recommends a fission backup for storm nights
    expect(layout.stations.find((s) => s.kind === 'solar').panels).toHaveLength(5);
    expect(kinds.filter((k) => k === 'outcrop')).toHaveLength(4);
  });

  it('is deterministic and keeps structures apart and inside the world', () => {
    const a = buildLayout(bigLoadout());
    const b = buildLayout(bigLoadout());
    expect(a).toEqual(b);
    const cs = a.colliders;
    for (let i = 0; i < cs.length; i += 1) {
      expect(Math.hypot(cs[i].x, cs[i].z)).toBeLessThan(WORLD_LIMIT);
      for (let j = i + 1; j < cs.length; j += 1) {
        expect(Math.hypot(cs[i].x - cs[j].x, cs[i].z - cs[j].z)).toBeGreaterThan(0.2);
      }
    }
  });

  it('finds the station whose work spot is in range', () => {
    const layout = buildLayout(mars());
    expect(nearestStation(layout, AIRLOCK.x, AIRLOCK.z).station.kind).toBe('habitat');
    expect(nearestStation(layout, 80, 80)).toBeNull();
    const pts = scatterPoints(layout, 7, 5);
    expect(pts.length).toBe(5);
    expect(layoutSignature(mars())).toBe(layoutSignature(mars()));
  });

  it('builds the ground facing up so it is drawn, not back-face culled (no space showing through)', () => {
    const hf = makeHeightfield({ seed: 7, body: 'moon' });
    const geo = polarGeometry(hf.heightAt, { segs: 24, r0: 1.2, rMax: 200 });
    const n = geo.attributes.normal;
    let up = 0;
    for (let i = 0; i < n.count; i += 1) if (n.getY(i) > 0.3) up += 1;
    expect(up).toBe(n.count);
  });

  it('flattens terrain under building pads', () => {
    const layout = buildLayout(mars());
    const hf = makeHeightfield({ seed: layout.seed, body: 'mars', pads: padsFor(layout) });
    expect(Math.abs(hf.heightAt(0, 0))).toBeLessThan(0.01);
    const solar = layout.stations.find((s) => s.kind === 'solar');
    expect(Math.abs(hf.heightAt(solar.panels[0].x, solar.panels[0].z))).toBeLessThan(0.3);
    expect(Number.isFinite(hf.heightAt(60, -40))).toBe(true);
  });
});

describe('world3d actions', () => {
  it('maps stations to engine tasks and mini-games', () => {
    const m = mars();
    const layout = buildLayout(m);
    const by = (k) => layout.stations.find((s) => s.kind === k);
    expect(stationActions(by('solar'), m)[0]).toMatchObject({ taskId: 'maintain', minigame: 'wipe' });
    expect(stationActions(by('berm'), m)[0]).toMatchObject({ taskId: 'shield', minigame: 'shovel' });
    expect(stationActions(by('outcrop'), m)[0]).toMatchObject({ taskId: 'science', minigame: 'scan' });
    expect(stationActions(by('habitat'), m).map((a) => a.type)).toEqual(['endSol', 'task']);
    expect(stationActions(by('moxie'), m).some((a) => a.type === 'toggle')).toBe(true);
  });

  it('offers repair on broken or meteor-damaged modules', () => {
    const m = { ...mars(), broken: { solar: 1 } };
    const layout = buildLayout(m);
    const solar = layout.stations.find((s) => s.kind === 'solar');
    const [a] = stationActions(solar, m);
    expect(a).toMatchObject({ minigame: 'repair', repair: true });
    expect(verbFor(a)).toBe('repair');
    const moxie = layout.stations.find((s) => s.kind === 'moxie');
    expect(stationActions(moxie, mars(), { damaged: new Set(['moxie']) })[0].repair).toBe(true);
    expect(promptText(a, 'Ada Reyes')).toContain('Assign Ada to');
  });

  it('only links to glossary terms that exist', () => {
    const ids = new Set(GLOSSARY.map((g) => g.id));
    const missing = Object.values(STATION_INFO).map((i) => i.term).filter((t) => !ids.has(t));
    expect(missing).toEqual([]);
  });
});

describe('world3d game rules', () => {
  it('runs a day clock with dusk and nightfall', () => {
    expect(dayClock(0, 200).phase).toBe('dawn');
    expect(dayClock(100, 200).phase).toBe('day');
    expect(dayClock(170, 200).duskWarning).toBe(true);
    expect(dayClock(200, 200).nightfall).toBe(true);
    expect(formatClock(13.5)).toBe('13:30');
    expect(tuningFor('cadet').daySeconds).toBeGreaterThan(tuningFor('commander').daySeconds);
    expect(tuningFor('specialist', { daySeconds: 90 }).daySeconds).toBe(90);
  });

  it('drains suit oxygen outside and refills inside', () => {
    const out = suitO2Step(1, { dt: 10, outside: true, o2Seconds: 100 });
    expect(out).toBeCloseTo(0.9);
    expect(suitO2Step(out, { dt: 10, outside: true, o2Seconds: 100, running: true })).toBeLessThan(0.8);
    expect(suitO2Step(0.2, { dt: 1, outside: false, o2Seconds: 100 })).toBeGreaterThan(0.2);
  });

  it('makes radiation much worse outside during a solar storm', () => {
    const calm = doseRatePerHour({ body: 'mars', outside: true });
    const storm = doseRatePerHour({ body: 'mars', outside: true, sepSeverity: 'major' });
    const shelter = doseRatePerHour({ body: 'mars', outside: false, shelter: true, sepSeverity: 'major' });
    expect(storm).toBeGreaterThan(calm * 50);
    expect(shelter).toBeLessThan(storm * 0.1);
  });

  it('puts the noon sun high on Mars and keeps the polar lunar sun low', () => {
    expect(sunDirection(mars(), 0.45).elevationDeg).toBeGreaterThan(40);
    expect(sunDirection(mars(), 0).elevationDeg).toBeLessThan(15);
    const polar = sunDirection(moon(), 0.5).elevationDeg;
    expect(polar).toBeGreaterThan(0);
    expect(polar).toBeLessThan(10);
    expect(earthDirection({ lat: 0.67, lon: 23.47 }).elevationDeg).toBeGreaterThan(60);
  });
});

describe('world3d progression', () => {
  it('ranks up with XP and rewards combos', () => {
    expect(rankFor(0).rank.id).toBe('cadet');
    expect(rankFor(1500).rank.id).toBe('flightDirector');
    const { progress, leveledUp } = addXp(normalizeProgress({ xp: 190 }), 20);
    expect(leveledUp.id).toBe('specialist');
    expect(progress.rank).toBe('specialist');
    expect(xpForTask(1, 5)).toBeGreaterThan(xpForTask(1, 0));
    expect(nextCombo(3, 0.4)).toBe(0);
    expect(normalizeProgress(null).xp).toBe(0);
  });

  it('builds a sol checklist with assign + return and tracks completion', () => {
    const m = mars();
    const objs = generateObjectives(m, buildLayout(m), { seed: 3 });
    expect(objs[0].id).toBe('assignAll');
    expect(objs.at(-1).id).toBe('return');
    expect(objs.length).toBeLessThanOrEqual(5);
    const { objectives, completed } = applyObjective(objs, 'return');
    expect(completed).toEqual(['return']);
    expect(objectives.at(-1).done).toBe(true);
    expect(remainingCollectibles('moon', ['patch-apollo11']).every((c) => c.body !== 'mars')).toBe(true);
  });
});

describe('world3d hazards', () => {
  it('is seeded by mission code and sol', () => {
    const m = { ...mars(), sol: 4 };
    expect(scheduleHazards(m, tuningFor('specialist'))).toEqual(scheduleHazards(m, tuningFor('specialist')));
  });

  it('schedules a solar storm only when DONKI says so, and lunar night cold', () => {
    const quiet = scheduleHazards({ ...mars(), sol: 2 }, tuningFor('cadet'));
    expect(quiet.some((h) => h.type === 'sepStorm')).toBe(false);
    const stormy = scheduleHazards({ ...mars(), sol: 2, today: { sep: { severity: 'major' } } }, tuningFor('cadet'));
    expect(stormy.find((h) => h.type === 'sepStorm').severity).toBe('major');
    const night = scheduleHazards({ ...moon(), env: { ...moon().env, lit: false } }, tuningFor('cadet'));
    expect(night.some((h) => h.type === 'lunarNight')).toBe(true);
    expect(night.some((h) => h.type === 'dustDevil')).toBe(false);
  });

  it('reports warning, active and done phases', () => {
    const h = { at: 0.5, lead: 10, duration: 0.1 };
    expect(hazardPhase(h, 80, 200)).toBe('pending');
    expect(hazardPhase(h, 95, 200)).toBe('warning');
    expect(hazardPhase(h, 105, 200)).toBe('active');
    expect(hazardPhase(h, 125, 200)).toBe('done');
  });
});

describe('world3d sol state', () => {
  const setup = (mission = mars(), opts = {}) => {
    const layout = buildLayout(mission);
    return createSolState({ mission, tuning: tuningFor('specialist', opts), progress: null, layout, playerId: 'c1' });
  };

  it('fires dusk then nightfall with a penalty if caught outside', () => {
    let s = setup(mars(), { daySeconds: 40 });
    const seen = [];
    for (let i = 0; i < 200; i += 1) {
      const r = stepSol(s, { dt: 0.25, outside: true, refilling: false, sheltered: false, playerId: 'c1' });
      s = r.state;
      seen.push(...r.events.map((e) => e.type));
    }
    expect(seen).toContain('dusk');
    expect(seen).toContain('nightfall');
    expect(seen).toContain('penalty');
  });

  it('runs out of oxygen, warns first, and resets the tank', () => {
    let s = setup();
    s = { ...s, o2: { ...s.o2, c1: 0.26 } };
    const types = [];
    for (let i = 0; i < 400 && !types.includes('o2Out'); i += 1) {
      const r = stepSol(s, { dt: 0.25, outside: true, playerId: 'c1' });
      s = r.state;
      types.push(...r.events.map((e) => e.type));
    }
    expect(types.indexOf('o2Low')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('o2Low')).toBeLessThan(types.indexOf('o2Out'));
    expect(s.o2.c1).toBe(0.5);
  });

  it('rewards sheltering before a solar storm', () => {
    const m = { ...mars(), today: { sep: { severity: 'moderate' } } };
    let s = setup(m, { daySeconds: 60 });
    const types = [];
    for (let i = 0; i < 240; i += 1) {
      const r = stepSol(s, { dt: 0.25, outside: false, sheltered: true, inShelter: true, playerId: 'c1' });
      s = r.state;
      types.push(...r.events.map((e) => e.type));
    }
    expect(types).toContain('hazardWarn');
    expect(types).toContain('shelteredInTime');
    expect(s.objectives.find((o) => o.id === 'shelter').done).toBe(true);
  });

  it('grants XP, combos, assignments, artifacts and a summary', () => {
    let s = setup();
    for (const id of ['c1', 'c2', 'c3', 'c4']) s = recordAssign(s, id).state;
    expect(s.objectives.find((o) => o.id === 'assignAll').done).toBe(true);
    let r = recordTaskResult(s, { verb: 'sample', quality: 0.9 });
    r = recordTaskResult(r.state, { verb: 'clean', quality: 0.95 });
    expect(r.state.combo).toBe(2);
    r = recordCollect(r.state, 'part-oppy');
    expect(r.state.progress.collected).toContain('part-oppy');
    expect(recordCollect(r.state, 'part-oppy').events).toEqual([]);
    const end = endSolState(r.state, { inside: true });
    expect(end.state.ended).toBe(true);
    const sum = solSummary(end.state);
    expect(sum.samples).toBe(1);
    expect(sum.xp).toBeGreaterThan(50);
  });

  it('clears a micrometeoroid timer when repaired', () => {
    let s = { ...setup(), damaged: { moxie: 30 } };
    const r = recordTaskResult(s, { verb: 'repair', quality: 1, moduleId: 'moxie' });
    expect(r.state.damaged).toEqual({});
    expect(r.events.map((e) => e.type)).toContain('damageRepaired');
    s = stepSol({ ...s, damaged: { moxie: 0.1 } }, { dt: 0.2, outside: true, playerId: 'c1' });
    expect(s.events.map((e) => e.type)).toContain('damageExpired');
  });
});

describe('world3d mini-game scoring', () => {
  it('scores each mini-game in 0..1', () => {
    expect(mg.wipeQuality(0.95)).toBe(1);
    expect(mg.wipeQuality(0.2)).toBe(0);
    const zone = mg.shovelZone(1);
    expect(mg.shovelHit(0.5, zone)).toBe(1);
    expect(mg.shovelHit(0.05, zone)).toBe(0);
    expect(mg.needlePos(0, 1)).toBe(0);
    expect(mg.needlePos(1, 1)).toBeCloseTo(1);
    const band = mg.waterBand(0);
    expect(mg.waterScore(0.55, band)).toBe(1);
    expect(mg.waterScore(0.98, band)).toBeLessThan(0.3);
    expect(mg.harvestScore([1, 2], [1, 2])).toBe(1);
    expect(mg.harvestScore([0], [1, 2])).toBe(0);
    expect(mg.scanRadius('geologist')).toBeGreaterThan(mg.scanRadius('engineer'));
    expect(mg.scanLocked({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 }, 0.05)).toBe(true);
    expect(mg.wireQuality(0, 5, 15)).toBe(1);
  });

  it('builds a wire puzzle that is never already solved', () => {
    for (let i = 0; i < 20; i += 1) {
      const p = mg.makeWirePuzzle(makeRng(i), 4);
      expect([...p.left].sort()).toEqual([...p.right].sort());
      expect(p.left.every((id, j) => id === p.right[j])).toBe(false);
    }
  });

  it('jams the drill when it overheats', () => {
    let s = mg.drillStart();
    for (let i = 0; i < 40; i += 1) s = mg.drillStep(s, { drilling: true, dt: 0.1 });
    expect(s.overheats).toBeGreaterThan(0);
    let careful = mg.drillStart();
    for (let i = 0; i < 400; i += 1) careful = mg.drillStep(careful, { drilling: careful.heat < 0.7, dt: 0.05 });
    expect(careful.depth).toBe(1);
    expect(careful.overheats).toBe(0);
  });
});

describe('world3d NPC logic', () => {
  it('sends crew to the station for their task, resting crew inside', () => {
    const m = setTask(mars(), 'c2', 'rest');
    const layout = buildLayout(m);
    const c1 = m.crew.find((c) => c.id === 'c1');
    expect(npcTarget(c1, layout, m, { index: 0 }).stationId).toMatch(/outcrop/);
    expect(npcTarget(m.crew.find((c) => c.id === 'c2'), layout, m).inside).toBe(true);
    expect(npcTarget(c1, layout, m, { recall: true }).inside).toBe(true);
  });

  it('pushes out of structures and walks around them', () => {
    const colliders = [{ x: 0, z: 0, r: 2 }];
    const p = resolveCollisions({ x: 0.5, z: 0 }, colliders);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(2.44);
    let pos = { x: 0, z: -6 };
    for (let i = 0; i < 600; i += 1) {
      const r = steer(pos, { x: 0.2, z: 6 }, colliders, { dt: 1 / 30 });
      pos = { x: r.x, z: r.z };
      expect(Math.hypot(pos.x, pos.z)).toBeGreaterThan(2.3);
      if (r.arrived) break;
    }
    expect(Math.hypot(pos.x - 0.2, pos.z - 6)).toBeLessThan(0.5);
  });
});
