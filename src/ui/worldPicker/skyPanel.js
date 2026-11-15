// "Cosminova sky" tab of the Free Play mission designer: look up at the real night sky from Earth, fly to a star
// or planet, pick a rocky world, then a landing site. Inspired by Cosminova (github.com/Cosminova/info).
import { h, mount, prefersReducedMotion, announce } from '../dom.js';
import { WORLDS, worldById } from '../../data/worlds.js';
import { OBSERVERS, observerById, skyTargets, worldsForTarget, whereInSky } from './targets.js';
import { worldCard, missingCard, siteList } from './cards.js';
import { skyStage, skyAvailable, skyScene, loadSkyAssets } from './skyHost.js';
import { eveningInstant, resolveSites } from './worldSites.js';

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Picker state that must survive the loadout rebuilding its panels on every change.
const ui = { view: 'sky', targetId: null, observerId: OBSERVERS[0].id, night: todayIso(), stars: null, loadError: null, flying: false, lastSkyKey: null };

const currentTargets = () => {
  const observer = observerById(ui.observerId);
  return skyTargets(WORLDS, eveningInstant(ui.night, observer), observer, ui.stars ?? []);
};

function targetButton(t, onFly) {
  const faint = t.kind === 'star' && !t.nakedEye;
  return h('li', null, h('button', {
    type: 'button', class: ['wp-target', t.gateway && 'is-gateway', t.id === ui.targetId && 'is-selected'], dataset: { target: t.id },
    onclick: () => onFly(t.id), onfocus: () => skyScene()?.lookAt(t.id),
  },
  h('span', { class: 'wp-target-name' }, t.name),
  h('span', { class: 'wp-target-where' }, whereInSky(t)),
  faint ? h('span', { class: 'wp-target-note' }, 'Too faint to see without a telescope. We marked it with a ring.') : null,
  t.gateway ? h('span', { class: 'wp-target-note' }, 'Gas giant. Visit its moons.') : null));
}

function targetList(targets, onFly) {
  const sol = targets.filter((t) => t.kind === 'body');
  const stars = targets.filter((t) => t.kind === 'star');
  return h('nav', { class: 'wp-targets', 'aria-label': 'Places you can fly to' },
    h('h3', { class: 'wp-targets-title' }, 'In our Solar System'),
    h('ul', { class: 'wp-target-list' }, sol.map((t) => targetButton(t, onFly))),
    h('h3', { class: 'wp-targets-title' }, 'Stars with rocky planets'),
    stars.length ? h('ul', { class: 'wp-target-list' }, stars.map((t) => targetButton(t, onFly)))
      : h('p', { class: 'muted' }, ui.stars ? 'No star systems yet.' : 'Loading the stars...'));
}

function skyControls(repaint) {
  return h('div', { class: 'wp-controls' },
    h('label', { class: 'field' },
      h('span', null, 'Where on Earth you stand'),
      h('select', {
        class: 'input', onchange: (e) => { ui.observerId = e.target.value; repaint(); },
      }, OBSERVERS.map((o) => h('option', { value: o.id, selected: o.id === ui.observerId }, o.name)))),
    h('label', { class: 'field' },
      h('span', null, 'Night of'),
      h('input', { class: 'input', type: 'date', min: '1900-01-01', max: '2049-12-31', value: ui.night, onchange: (e) => { ui.night = e.target.value || todayIso(); repaint(); } })));
}

function systemHeader(target) {
  if (target.kind === 'star') {
    const facts = [
      target.distanceLy ? `${Number(target.distanceLy).toFixed(2)} light-years away` : null,
      target.spectralType ? `a type ${target.spectralType} star` : null,
      target.teffK ? `about ${Math.round(target.teffK).toLocaleString('en-US')} K on the surface` : null,
    ].filter(Boolean).join(', ');
    return [
      h('h3', { class: 'wp-system-title', tabindex: '-1' }, `The ${target.name} system`),
      facts ? h('p', null, `${target.name} is ${facts}.`) : null,
      target.nakedEye ? null : h('p', { class: 'wp-note' }, 'This star is too faint to see with your eyes. Astronomers found it with telescopes.'),
    ];
  }
  return [
    h('h3', { class: 'wp-system-title', tabindex: '-1' }, target.gateway ? `The moons of ${target.name}` : target.name),
    h('p', null, target.blurb),
    target.gateway ? h('p', { class: 'wp-note' }, `${target.name} is a giant ball of gas with no ground to land on. Pick one of its moons instead.`) : null,
  ];
}

/**
 * @param {object} fp the free-play draft ({ body, siteId, worldId?, ... })
 * @param {(patch: object) => void} onChange
 * @param {{ challenge?: Function, effects?: Function }} [hooks] engine callbacks for the world cards
 */
export function skyPanel(fp, onChange, hooks = {}) {
  const root = h('div', { class: 'wp-panel' });
  const status = h('p', { class: 'wp-status', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'wp-body' });
  const webgl = skyAvailable();

  const syncScene = (targets) => {
    const scene = skyScene();
    if (!scene || !ui.stars) return;
    const key = `${ui.observerId}|${ui.night}`;
    if (key === ui.lastSkyKey && scene.targets.length === targets.length) return;
    ui.lastSkyKey = key;
    const observer = observerById(ui.observerId);
    scene.update({ date: eveningInstant(ui.night, observer), observer, targets, selectedId: ui.targetId });
    // open facing something clickable: a ringed star if one is up, else the first body above the horizon
    const up = targets.filter((t) => t.aboveHorizon);
    const first = up.find((t) => t.kind === 'star') ?? up[0];
    if (ui.targetId) scene.lookAt(ui.targetId);
    else if (first) scene.frameTarget(first.id);
    scene.renderer?.domElement.setAttribute('aria-label', `The night sky over ${observer.short}. Drag to look around. Use the list of places to fly with the keyboard.`);
  };

  async function fly(id) {
    if (ui.flying) return;
    const target = currentTargets().find((t) => t.id === id);
    if (!target) return;
    ui.targetId = id;
    ui.flying = true;
    status.textContent = `Flying to ${target.name}...`;
    try {
      await skyScene()?.flyTo(id, { reducedMotion: prefersReducedMotion() });
    } finally {
      ui.flying = false;
    }
    ui.view = 'system';
    skyScene()?.setPaused(true);
    status.textContent = '';
    announce(`Arrived at ${target.name}.`);
    paint();
    root.querySelector('.wp-system-title')?.focus();
  }

  function backToSky() {
    ui.view = 'sky';
    const scene = skyScene();
    scene?.resetView();
    scene?.setPaused(false);
    if (ui.targetId) scene?.lookAt(ui.targetId);
    paint();
    root.querySelector(`.wp-target[data-target="${CSS.escape(ui.targetId ?? '')}"]`)?.focus();
  }

  const chooseWorld = (world) => {
    const { sites } = resolveSites(world);
    onChange({ picker: 'sky', body: world.analog, worldId: world.id, siteId: sites[0]?.id ?? fp.siteId });
  };

  function systemView(target) {
    const { worlds, missing } = worldsForTarget(target, WORLDS);
    const chosen = worlds.find((w) => w.id === fp.worldId) ?? null;
    const sites = chosen ? resolveSites(chosen) : null;
    return h('section', { class: 'wp-system', 'aria-label': `Worlds at ${target.name}` },
      h('div', { class: 'wp-system-head' },
        h('div', null, systemHeader(target)),
        h('button', { type: 'button', class: 'btn btn-ghost wp-back', onclick: backToSky }, 'Back to the night sky')),
      h('div', { class: 'wp-cards' },
        worlds.map((w) => worldCard(w, { onChoose: chooseWorld, selected: w.id === fp.worldId, challenge: hooks.challenge, effects: hooks.effects })),
        missing.map(missingCard)),
      chosen ? h('div', { class: 'wp-site-step' },
        h('h3', null, `Pick a landing site on ${chosen.name}`),
        siteList({ world: chosen, sites: sites.sites, selectedId: fp.siteId, practice: sites.practice, onSelect: (siteId) => onChange({ picker: 'sky', siteId }) })) : null);
  }

  function chosenStrip() {
    const world = fp.worldId ? worldById(fp.worldId) : null;
    if (!world) return null;
    return h('p', { class: 'wp-chosen' }, `Your world: ${world.name}. Fly to it again to change the landing site.`);
  }

  function paint() {
    const targets = currentTargets();
    const target = targets.find((t) => t.id === ui.targetId);
    const inSystem = ui.view === 'system' && target;
    stage.hidden = Boolean(inSystem);
    if (inSystem) {
      mount(body, systemView(target));
      return;
    }
    mount(body,
      chosenStrip(),
      skyControls(() => { ui.lastSkyKey = null; paint(); }),
      ui.loadError ? h('p', { class: 'wp-note' }, 'The star map could not load. You can still fly with the list below.') : null,
      targetList(targets, fly));
    syncScene(targets);
  }

  const stage = h('div', { class: 'wp-stage' },
    webgl ? skyStage({
      onPick: fly,
      onReady: () => { ui.lastSkyKey = null; if (ui.view === 'sky') syncScene(currentTargets()); else skyScene()?.setPaused(true); },
      onFail: () => { stage.replaceChildren(h('p', { class: 'wp-note' }, 'This browser cannot draw the 3D sky. Use the list of places below.')); },
    }) : h('p', { class: 'wp-note' }, 'This browser cannot draw the 3D sky. Use the list of places below.'),
    h('p', { class: 'wp-stage-hint', 'aria-hidden': 'true' }, 'Drag to look around. Tap a ring or a planet to fly there.'));

  root.append(
    h('p', { class: 'kid-lead wp-lead' }, 'You are standing outside on Earth at night. Look up! The rings mark stars that have rocky planets. The bright dots are planets and the Moon.'),
    stage, status, body,
    h('p', { class: 'wp-credit' },
      'Inspired by Cosminova. Stars: Yale Bright Star and Hipparcos data via the HYG database and d3-celestial. Planet places: JPL approximate orbital elements. Moon: Meeus, Astronomical Algorithms.'));

  if (!ui.stars) {
    loadSkyAssets().then(({ stars }) => { ui.stars = stars; ui.lastSkyKey = null; if (root.isConnected) paint(); })
      .catch((err) => { console.error('[worldPicker] star catalogue failed', err); ui.loadError = err; if (root.isConnected) paint(); });
  }
  paint();
  return root;
}
