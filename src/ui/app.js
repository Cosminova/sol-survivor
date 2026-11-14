// App shell: one store, one render function, one delegated event handler. Rebuilds the current screen from state.
import { prepareData, createMission, advanceSol, applyChoice, DEFAULT_START_DATE, QUICK_START_LOADOUT } from '../engine/mission.js';
import { randomMissionCode } from '../engine/rng.js';
import { sitesForBody } from '../data/sites.js';
import { modulesForBody } from '../data/modules.js';
import { renderDataLab, dataBadge } from './dataLab.js';
import { renderStart } from './screens/start.js';
import { renderPack } from './screens/pack.js';
import { renderMission } from './screens/mission.js';
import { renderDebrief } from './screens/debrief.js';
import { initGlossaryPopover, renderGlossaryList } from './components/glossaryPopover.js';
import { logEntriesFromSol } from './components/log.js';
import { escapeHtml } from './text.js';
import { mountScenes, sceneStats } from './scene/sceneHost.js';

const STORAGE_KEY = 'sol-survivor:v1';
const MAX_HISTORY = 400;

/** Quick-start loadout for a body, balanced by the engine so resources really run low (see docs/balance.md). */
export const defaultLoadout = (body = 'mars') => cloneLoadout(QUICK_START_LOADOUT?.[body] ?? QUICK_START_LOADOUT?.mars ?? { modules: {}, supplies: {} });
const DEFAULT_CREW = [
  { name: 'Ada', role: 'commander' },
  { name: 'Kai', role: 'engineer' },
  { name: 'Zuri', role: 'geologist' },
  { name: 'Leo', role: 'doctor' },
];

function cloneLoadout(l) {
  return { modules: { ...(l?.modules ?? {}) }, supplies: { ...(l?.supplies ?? {}) } };
}

function defaultSetup(body = 'mars') {
  return {
    body,
    siteId: sitesForBody(body)[0]?.id ?? null,
    lengthSols: 30,
    crew: DEFAULT_CREW.map((c) => ({ ...c })),
    code: randomMissionCode(),
    loadout: defaultLoadout(body),
  };
}

const store = {
  root: null,
  screen: 'start', // start | pack | mission | debrief
  tab: 'mission', // mission | datalab | glossary
  setup: defaultSetup(),
  mission: null,
  data: null,
  raw: { rems: null, donki: null, gallery: null },
  offline: false,
  loading: true,
  saved: null,
  history: [],
  stats: { maxDose: 0, minO2: null, cardsAnswered: [], shortfallSols: 0 },
  toast: null,
  error: null,
  pendingScroll: null,
};

/* ---------- persistence ---------- */
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 1, setup: store.setup, mission: store.mission, history: store.history, stats: store.stats, screen: store.screen }),
    );
  } catch {
    /* storage may be blocked; the game still works */
  }
}

/* ---------- stats tracked across the run ---------- */
function trackStats(state) {
  if (!state) return;
  const maxDose = Math.max(0, ...(state.crew ?? []).map((c) => c.doseMsv ?? 0));
  store.stats.maxDose = Math.max(store.stats.maxDose ?? 0, maxDose);
  const o2 = state.supplies?.o2Kg ?? 0;
  store.stats.minO2 = store.stats.minO2 == null ? o2 : Math.min(store.stats.minO2, o2);
  if ((state.power?.shortfallKwh ?? 0) > 0) store.stats.shortfallSols = (store.stats.shortfallSols ?? 0) + 1;
}

/* ---------- data loading ---------- */
async function fetchJson(name) {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadData() {
  const results = await Promise.allSettled(['rems.json', 'donki.json', 'gallery.json'].map(fetchJson));
  const [rems, donki, gallery] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  store.raw = { rems, donki, gallery };
  store.offline = !rems || !donki;
  try {
    store.data = store.offline ? null : prepareData({ rems, donki });
  } catch {
    store.data = null;
    store.offline = true;
  }
}

/* ---------- mission helpers ---------- */
function startMission(loadout) {
  const s = store.setup;
  const code = (s.code || randomMissionCode()).toUpperCase().trim();
  s.code = code;
  const crew = s.crew.filter((c) => c.name?.trim()).slice(0, 4);
  if (crew.length < 2) {
    store.error = 'You need at least 2 crew members with names.';
    return;
  }
  try {
    store.mission = createMission(
      { body: s.body, siteId: s.siteId, crew, loadout: cloneLoadout(loadout), seed: code, lengthSols: s.lengthSols, startDate: DEFAULT_START_DATE },
      store.data,
    );
    store.history = logEntriesFromSol(store.mission.sol ?? 0, store.mission.lastSol);
    store.stats = { maxDose: 0, minO2: null, cardsAnswered: [], shortfallSols: 0 };
    trackStats(store.mission);
    store.toast = null;
    store.error = null;
    store.screen = 'mission';
    store.tab = 'mission';
  } catch (err) {
    store.error = `Could not start the mission: ${err?.message ?? err}`;
  }
}

function afterEngineStep(next, prev) {
  if (!next || next === prev) return;
  store.mission = next;
  if ((next.sol ?? 0) !== (prev?.sol ?? 0)) {
    store.history = [...logEntriesFromSol(next.sol ?? 0, next.lastSol).reverse(), ...store.history].slice(0, MAX_HISTORY);
    store.toast = null;
  }
  trackStats(next);
}

function sanitizeLoadout(body) {
  const allowed = new Set(modulesForBody(body).map((m) => m.id));
  const modules = Object.fromEntries(Object.entries(store.setup.loadout.modules).filter(([id]) => allowed.has(id)));
  store.setup.loadout = { modules, supplies: { ...store.setup.loadout.supplies } };
}

/* ---------- actions ---------- */
const actions = {
  'set-body': (el) => {
    const body = el.dataset.body === 'moon' ? 'moon' : 'mars';
    store.setup.body = body;
    if (!sitesForBody(body).some((s) => s.id === store.setup.siteId)) store.setup.siteId = sitesForBody(body)[0]?.id ?? null;
    sanitizeLoadout(body);
  },
  'set-site': (el) => { store.setup.siteId = el.dataset.site; },
  'set-length': (el) => { store.setup.lengthSols = Number(el.dataset.length) === 60 ? 60 : 30; },
  'add-crew': () => {
    if (store.setup.crew.length >= 4) return;
    const spare = DEFAULT_CREW.find((d) => !store.setup.crew.some((c) => c.name === d.name)) ?? { name: 'Nova', role: 'botanist' };
    store.setup.crew.push({ ...spare });
  },
  'remove-crew': (el) => {
    if (store.setup.crew.length <= 2) return;
    store.setup.crew.splice(Number(el.dataset.index), 1);
  },
  'new-code': () => { store.setup.code = randomMissionCode(); },
  quickstart: () => { store.setup.loadout = defaultLoadout(store.setup.body); sanitizeLoadout(store.setup.body); startMission(store.setup.loadout); },
  'go-pack': () => { sanitizeLoadout(store.setup.body); store.screen = 'pack'; },
  'go-start': () => { store.screen = 'start'; },
  continue: () => {
    const saved = store.saved;
    if (!saved?.mission) return;
    store.mission = saved.mission;
    store.history = Array.isArray(saved.history) ? saved.history : [];
    store.stats = saved.stats ?? { maxDose: 0, minO2: null, cardsAnswered: [], shortfallSols: 0 };
    if (saved.setup) store.setup = { ...defaultSetup(saved.setup.body), ...saved.setup, loadout: saved.setup.loadout ? cloneLoadout(saved.setup.loadout) : defaultLoadout(saved.setup.body) };
    store.screen = saved.mission.status?.over ? 'debrief' : 'mission';
    store.tab = 'mission';
  },
  'pack-inc': (el) => changeCount(el, +1),
  'pack-dec': (el) => changeCount(el, -1),
  launch: () => startMission(store.setup.loadout),
  'next-sol': () => {
    const prev = store.mission;
    if (!prev || prev.pendingCard || prev.status?.over) return;
    try {
      afterEngineStep(advanceSol(prev, store.data), prev);
    } catch (err) {
      store.error = `The engine hit a problem on this sol: ${err?.message ?? err}`;
    }
    if (store.mission?.status?.over) store.screen = 'debrief';
  },
  choose: (el) => {
    const prev = store.mission;
    const idx = Number(el.dataset.index);
    if (!prev?.pendingCard) return;
    const card = prev.pendingCard;
    const choice = card.choices?.[idx];
    try {
      const next = applyChoice(prev, idx, store.data);
      if (next !== prev) {
        store.stats.cardsAnswered = [...(store.stats.cardsAnswered ?? []), card.id];
        store.toast = choice?.outcome ?? 'Done.';
        store.history = [{ sol: prev.sol ?? 0, kind: 'info', text: `${card.title ?? 'Event'}: ${choice?.label ?? ''}`, source: card.source }, ...store.history].slice(0, MAX_HISTORY);
        afterEngineStep(next, prev);
        if (next.status?.over) store.screen = 'debrief';
      }
    } catch (err) {
      store.error = `Could not apply that choice: ${err?.message ?? err}`;
    }
  },
  'dismiss-toast': () => { store.toast = null; },
  'dismiss-error': () => { store.error = null; },
  'go-debrief': () => { store.screen = 'debrief'; },
  abandon: () => {
    if (!window.confirm('Quit this mission and go back to the start screen? Your progress will be lost.')) return;
    store.mission = null;
    store.history = [];
    store.screen = 'start';
  },
  replay: () => {
    const m = store.mission;
    if (m) {
      store.setup.code = m.code ?? store.setup.code;
      store.setup.body = m.body ?? store.setup.body;
      store.setup.siteId = m.site?.id ?? store.setup.siteId;
      store.setup.lengthSols = m.lengthSols ?? store.setup.lengthSols;
    }
    startMission(store.setup.loadout);
  },
  'new-mission': () => { store.mission = null; store.history = []; store.setup.code = randomMissionCode(); store.screen = 'start'; },
  'share-code': async (el) => {
    const code = store.mission?.code ?? store.setup.code;
    const text = `Play Sol Survivor with mission code ${code}. Same weather, same storms. Can you beat my score?`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else if (navigator.share) await navigator.share({ title: 'Sol Survivor', text });
      else throw new Error('no clipboard');
      el.textContent = 'Copied!';
      setTimeout(render, 1500);
      return false; // skip immediate re-render so the label shows
    } catch {
      window.prompt('Copy this mission code:', code);
    }
  },
  tab: (el) => {
    store.tab = el.dataset.tab;
    if (store.tab === 'mission' && store.screen === 'mission' && !store.mission) store.screen = 'start';
  },
};

function changeCount(el, delta) {
  const { kind, id } = el.dataset;
  const l = store.setup.loadout;
  if (kind === 'module') {
    const max = modulesForBody(store.setup.body).find((m) => m.id === id)?.max ?? 9;
    l.modules[id] = Math.max(0, Math.min(max, (l.modules[id] ?? 0) + delta));
    if (l.modules[id] === 0) delete l.modules[id];
  } else {
    l.supplies[id] = Math.max(0, Math.min(40, (l.supplies[id] ?? 0) + delta));
  }
}

/* ---------- rendering ---------- */
function topbar() {
  const tabs = [
    ['mission', store.screen === 'mission' ? 'Mission' : 'Game'],
    ['datalab', 'Data Lab'],
    ['glossary', 'Glossary'],
  ];
  return `<header class="topbar">
    <span class="brand">Sol Survivor</span>
    <nav class="tabs" role="tablist" aria-label="Sections">
      ${tabs.map(([id, label]) => `<button type="button" role="tab" class="btn" aria-selected="${store.tab === id}" data-action="tab" data-tab="${id}">${label}</button>`).join('')}
    </nav>
  </header>`;
}

function renderDataLabTab(container) {
  const host = document.createElement('div');
  host.className = 'stack';
  host.innerHTML = `<h1>Data Lab</h1><p class="muted">Every number in the game comes from these archived NASA sources. Nothing here is live; it was downloaded once so the game works offline.</p>`;
  const lab = document.createElement('div');
  host.appendChild(lab);
  container.appendChild(host);
  try {
    renderDataLab(lab, { rems: store.raw.rems, donki: store.raw.donki, gallery: store.raw.gallery, state: store.mission });
  } catch (err) {
    lab.innerHTML = `<p class="notice danger">The Data Lab could not load: ${escapeHtml(err?.message ?? err)}</p>`;
  }
}

function mountBadges(container) {
  for (const slot of container.querySelectorAll('[data-badge]')) {
    const id = slot.dataset.badge;
    if (!id) { slot.remove(); continue; }
    try {
      const el = dataBadge(id);
      if (el instanceof Node) slot.replaceWith(el);
      else slot.textContent = '';
    } catch {
      slot.innerHTML = `<span class="pill">Source: ${escapeHtml(id)}</span>`;
    }
  }
}

export function render() {
  const root = store.root;
  if (!root) return;
  if (store.loading) {
    root.innerHTML = `<div class="loading"><h1>Sol Survivor</h1><p>Loading archived NASA data…</p></div>`;
    return;
  }
  const hadModal = !!root.querySelector('[data-modal]');
  let body = '';
  if (store.tab === 'glossary') {
    body = `<h1>Glossary</h1><p class="muted">Tap any underlined word in the game to see these. Short answers first; "Tell me more" for the details.</p>${renderGlossaryList()}`;
  } else if (store.tab === 'datalab') {
    body = '<div data-datalab-host></div>';
  } else if (store.screen === 'start') body = renderStart(store);
  else if (store.screen === 'pack') body = renderPack(store);
  else if (store.screen === 'mission') body = renderMission(store);
  else if (store.screen === 'debrief') body = renderDebrief(store);

  const errorHtml = store.error
    ? `<div class="notice danger row between" role="alert"><span>${escapeHtml(store.error)}</span><button type="button" class="btn small" data-action="dismiss-error">OK</button></div>`
    : '';
  root.innerHTML = `${topbar()}${errorHtml}<main>${body}</main>`;
  if (store.tab === 'datalab') renderDataLabTab(root.querySelector('[data-datalab-host]'));
  mountBadges(root);
  mountScenes(root, store); // persistent 3D canvases re-attach into their [data-scene] slots

  if (store.pendingScroll) {
    const target = document.getElementById(store.pendingScroll);
    store.pendingScroll = null;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const modal = root.querySelector('[data-modal]');
  if (modal && !hadModal) (modal.querySelector('.choice:not(:disabled)') ?? modal.querySelector('button:not(:disabled)'))?.focus();
  if (!store.loading) persist();
}

/* ---------- events ---------- */
function onClick(ev) {
  const target = ev.target instanceof Element ? ev.target.closest('[data-action]') : null;
  if (!target || !store.root?.contains(target)) return;
  const fn = actions[target.dataset.action];
  if (!fn) return;
  ev.preventDefault();
  const result = fn(target);
  if (result === false) return;
  if (result instanceof Promise) result.then((r) => { if (r !== false) render(); });
  else render();
}

function onInput(ev) {
  const el = ev.target;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
  const field = el.dataset.field;
  if (!field) return;
  const idx = Number(el.dataset.index);
  if (field === 'crew-name' && store.setup.crew[idx]) store.setup.crew[idx].name = el.value.slice(0, 16);
  else if (field === 'crew-role' && store.setup.crew[idx]) store.setup.crew[idx].role = el.value;
  else if (field === 'code') {
    const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    store.setup.code = v;
    if (el.value !== v) el.value = v;
  }
  persist();
}

/* ---------- boot ---------- */
export async function boot(root) {
  store.root = root;
  store.saved = loadSaved();
  render();
  initGlossaryPopover();
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('select-site', (ev) => {
    const siteId = ev?.detail?.siteId;
    if (!siteId || !sitesForBody(store.setup.body).some((s) => s.id === siteId)) return;
    store.setup.siteId = siteId;
    render();
  });
  if (import.meta.env?.DEV) window.__solSurvivorSceneStats = sceneStats;
  document.addEventListener('open-source', (ev) => {
    const id = ev?.detail?.sourceId;
    store.tab = 'datalab';
    store.pendingScroll = id ? `source-${id}` : null;
    render();
  });

  await loadData();
  if (store.saved?.setup) {
    const s = store.saved.setup;
    store.setup = { ...defaultSetup(s.body ?? 'mars'), ...s, loadout: s.loadout ? cloneLoadout(s.loadout) : defaultLoadout(s.body ?? 'mars'), code: randomMissionCode() };
    if (!Array.isArray(store.setup.crew) || store.setup.crew.length < 2) store.setup.crew = DEFAULT_CREW.map((c) => ({ ...c }));
  }
  store.loading = false;
  render();
}
