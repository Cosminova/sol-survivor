// Standalone dev harness for the 3D outpost (world3d.html). Wires the world to the real engine.
// Query params: mission=jezero|shackleton|tranquility|gale|arcadia|utopia, sol=N (fast-forward),
// sep=minor|moderate|major, storm=1, night=1, dust=0..0.9, broken=moduleId, day=SECONDS,
// difficulty=, assist=1, intro=0|1, quality=low|high, xp=N, muted=1, read=1, reset=1.
import { mountOutpost3D, isWebGLAvailable } from './index.js';
import { createMission, setTask, toggleModule, beginSol, resolveEvent, runSol } from '../engine/sim.js';
import { choiceAvailable } from '../engine/events.js';
import { eventById } from '../data/eventCards.js';
import { CAMPAIGN } from '../data/missions.js';
import { buildWeatherIndex } from '../engine/environment.js';
import { classifySepEvents } from '../engine/spaceWeather.js';

const MISSIONS = { shackleton: 0, tranquility: 1, jezero: 2, mars: 2, moon: 0, gale: 3, arcadia: 4, utopia: 5 };
const STORE = 'w3d-harness-progress';
const q = new URLSearchParams(location.search);

async function loadCtx() {
  const get = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [rems, donki] = await Promise.all([get('./data/rems.json'), get('./data/donki.json')]);
  return { weatherIndex: rems ? buildWeatherIndex(rems) : null, seps: donki ? classifySepEvents(donki) : [] };
}

function playSol(mission, ctx) {
  let m = beginSol(mission, ctx);
  if (m.phase === 'event') {
    const card = eventById(m.pendingEvent.id);
    const idx = card ? Math.max(0, card.choices.findIndex((c) => choiceAvailable(m, c))) : 0;
    m = resolveEvent(m, idx);
  }
  return runSol(m);
}

function applyOverrides(m) {
  let out = m;
  if (q.get('sep')) out = { ...out, today: { ...out.today, sep: { severity: q.get('sep'), id: 'harness' } } };
  if (q.get('storm')) out = { ...out, env: { ...out.env, storm: { tau: 4, solsLeft: 5 }, tau: 4.5, dust: Math.max(out.env.dust, 0.35) } };
  if (q.get('night')) out = { ...out, env: { ...out.env, lit: false } };
  if (q.get('dust')) out = { ...out, env: { ...out.env, dust: Number(q.get('dust')) } };
  if (q.get('broken')) out = { ...out, broken: { ...out.broken, [q.get('broken')]: 1 } };
  return out;
}

function loadProgress() {
  if (q.get('reset')) localStorage.removeItem(STORE);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    if (q.get('xp')) return { ...(saved ?? {}), xp: Number(q.get('xp')), introSeen: q.get('intro') !== '1' };
    return saved;
  } catch {
    return null;
  }
}

async function main() {
  const root = document.getElementById('w3d');
  if (!isWebGLAvailable()) {
    root.textContent = 'WebGL is not available in this browser.';
    return;
  }
  const ctx = await loadCtx();
  const config = CAMPAIGN[MISSIONS[q.get('mission') ?? 'jezero'] ?? 2];
  let mission = createMission({ config, loadout: config.recommended, code: 'DEMO3D' }, ctx);
  const ff = Number(q.get('sol') ?? 0);
  for (let i = 0; i < ff && mission.status === 'active'; i += 1) mission = playSol(mission, ctx);
  mission = applyOverrides(mission);

  const log = (...a) => console.info('[world3d]', ...a);
  const crewMap = (fn) => { mission = { ...mission, crew: mission.crew.map(fn) }; };

  const api = mountOutpost3D(root, {
    mission,
    playerCrewId: 'c1',
    difficulty: q.get('difficulty') ?? undefined,
    daySeconds: q.get('day') ? Number(q.get('day')) : undefined,
    assist: q.get('assist') === '1',
    quality: q.get('quality') ?? undefined,
    muted: q.get('muted') === '1',
    readAloud: q.get('read') === '1',
    intro: q.get('intro') === '0' ? false : q.get('intro') === '1' ? true : undefined,
    progress: loadProgress(),
    onAssignTask(crewId, taskId) {
      mission = setTask(mission, crewId, taskId);
      api.update(mission);
    },
    onToggleModule(id) {
      mission = toggleModule(mission, id);
      api.update(mission);
    },
    onEndSol() {
      mission = applyOverrides(playSol(mission, ctx));
      log('sol', mission.sol, mission.status, mission.lastReport);
      api.update(mission);
    },
    onTaskResult(r) {
      log('task result', r);
      if (r.quality >= 0.8) crewMap((c) => (c.id === r.crewId ? { ...c, morale: Math.min(100, c.morale + 2) } : c));
    },
    onPenalty(p) {
      log('penalty', p);
      crewMap((c) => {
        if (c.id !== p.crewId) return c;
        return p.kind === 'radiation' ? { ...c, doseMsv: c.doseMsv + p.amount } : { ...c, health: Math.max(1, c.health - p.amount) };
      });
      api.update(mission);
    },
    onHazard(h) {
      log('hazard', h);
      if (h.type === 'micrometeoroid' && h.phase === 'expired') {
        mission = { ...mission, broken: { ...mission.broken, [h.moduleId]: (mission.broken[h.moduleId] ?? 0) + 1 } };
        api.update(mission);
      }
    },
    onProgress(p) {
      localStorage.setItem(STORE, JSON.stringify(p));
    },
    onOpenTerm: (id) => log('open glossary term', id),
    onExit: () => { location.href = './'; },
  });
  window.__w3d = { api, get mission() { return mission; } };
}

main().catch((err) => {
  console.error('[world3d] harness failed', err);
  document.getElementById('w3d').textContent = `3D harness failed: ${err.message}`;
});
