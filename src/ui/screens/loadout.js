// Pack the lander: choose modules and supplies within the mass budget, then launch.
import '../../styles/loadout.css';
import { h, mount, richText } from '../dom.js';
import { CAMPAIGN, missionById, freePlayConfig } from '../../data/missions.js';
import { modulesForBody, SUPPLIES } from '../../data/modules.js';
import { LIFE_SUPPORT } from '../../data/constants.js';
import { validateLoadout, createMission, DEFAULT_CREW } from '../../engine/sim.js';
import { randomMissionCode } from '../../engine/rng.js';
import { getState, setMission } from '../../state/store.js';
import { loadSimContext } from '../../state/nasaData.js';
import { navigate } from '../router.js';
import { openTermPopover } from '../components/termPopover.js';
import { toast } from '../components/common.js';
import { play } from '../audio.js';
import { massBar, moduleCard, supplySlider, validationList, needsPanel } from './loadout/parts.js';
import { freePlayPanel, difficultyPicker, codeField, crewFields } from './loadout/setup.js';
import { isUnlocked } from './campaign.js';
import { onLive } from '../../live/liveData.js';
import { liveSunCard } from '../live/liveSun.js';

const drafts = new Map();
const EMPTY = { modules: {}, supplies: { o2: 0, water: 0, food: 0 } };
const PER_DAY = { o2: LIFE_SUPPORT.o2KgPerCrewDay, water: LIFE_SUPPORT.waterKgPerCrewDay, food: LIFE_SUPPORT.foodKgPerCrewDay };

function initialDraft(missionId) {
  if (drafts.has(missionId)) return drafts.get(missionId);
  return {
    loadout: EMPTY,
    difficulty: 'cadet',
    code: randomMissionCode(),
    crew: DEFAULT_CREW,
    free: { body: 'mars', siteId: 'jezero', targetSols: 30, startDate: '2024-05-08', includeTransitDose: false },
  };
}

// worldId comes from the Cosminova sky picker (body is then the world's analog); Moon/Mars tabs leave it null.
const configFor = (missionId, draft) => (missionId === 'free-play'
  ? { ...freePlayConfig({ ...draft.free, difficulty: draft.difficulty }), worldId: draft.free.worldId ?? draft.free.body }
  : missionById(missionId));

// TODO(world-picker): once src/engine exports worldChallenge(world) / worldEffects(world), import them here and pass
// { challenge: worldChallenge, effects: worldEffects } so the sky picker's world cards fill their effects slot.
const WORLD_CARD_HOOKS = {};

export function render(root, { params, query }) {
  const missionId = params[0] ?? 'artemis-dawn';
  if (missionId !== 'free-play' && !missionById(missionId)) {
    navigate('campaign');
    return undefined;
  }
  const index = CAMPAIGN.findIndex((c) => c.id === missionId);
  const { progress, settings } = getState();
  if (index > 0 && !isUnlocked(index, progress, settings)) {
    toast('That chapter is still locked. Finish the one before it first!', { icon: 'lock' });
    navigate('campaign');
    return undefined;
  }

  let draft = initialDraft(missionId);
  // "Play now" from the home page: start with Mission Control's recommended loadout already packed
  // (the same thing the "Use recommended" button does), so a new player only has to press Launch.
  const quick = query?.quick === '1' && Boolean(missionById(missionId)?.recommended);
  if (quick && !drafts.has(missionId)) draft = { ...draft, loadout: missionById(missionId).recommended };
  const setDraft = (patch) => {
    draft = { ...draft, ...patch };
    drafts.set(missionId, draft);
    draw();
  };
  const setModules = (id, n) => setDraft({ loadout: { ...draft.loadout, modules: { ...draft.loadout.modules, [id]: n } } });
  const setSupply = (id, kg) => setDraft({ loadout: { ...draft.loadout, supplies: { ...draft.loadout.supplies, [id]: kg } } });

  const head = h('header', { class: 'screen-head' });
  const left = h('div', { class: 'lo-main' });
  const side = h('aside', { class: 'lo-side', 'aria-label': 'Flight check' });
  // Pre-launch briefing: the real Sun today, from the live NASA data layer.
  const sunSlot = h('div', { class: 'lo-sun' }, liveSunCard(null, { compact: true }));
  const briefing = h('section', { class: 'panel lo-briefing', 'aria-labelledby': 'lo-briefing-title' },
    h('h2', { id: 'lo-briefing-title', class: 'panel-title' }, 'Before you launch: the real Sun today'),
    h('p', { class: 'kid-lead' }, 'Mission planners check the Sun before every launch. A stormy Sun means more radiation.'),
    sunSlot);
  const stopLive = onLive((live) => { if (sunSlot.isConnected) sunSlot.replaceChildren(liveSunCard(live, { compact: true })); });

  async function launch(config) {
    try {
      const ctx = await loadSimContext();
      const mission = createMission({ config, loadout: draft.loadout, difficulty: draft.difficulty, code: draft.code, crew: draft.crew }, ctx);
      setMission(mission);
      play('win');
      navigate('play');
    } catch (err) {
      console.error('[loadout] launch failed', err);
      toast(`The launch did not work. Please try again. (${err.message})`, { icon: 'alert' });
    }
  }

  function draw() {
    const config = configFor(missionId, draft);
    const result = validateLoadout(config, draft.loadout, draft.difficulty);
    const modules = modulesForBody(config.body);
    const scrollY = window.scrollY;
    const focusedId = document.activeElement?.id;

    mount(head,
      h('div', null,
        h('span', { class: ['kicker', config.body === 'mars' && 'mars'] }, missionId === 'free-play' ? 'Free Play' : `Chapter ${config.chapter} · ${config.title}`),
        h('h1', null, 'Pack the lander'),
        h('p', null, richText('Pick the machines and supplies your crew needs to stay safe for the whole mission. A rocket can only lift so much, so stay under the [[payload|weight limit]].', openTermPopover)),
        quick ? h('div', { class: 'kid-quick', role: 'status' },
          h('p', null, 'Mission Control already packed a good lander for you. Press Launch mission to start, or scroll down to change anything you like.'),
          h('button', { type: 'button', id: 'quick-launch', class: 'btn btn-primary btn-lg btn-caps', disabled: !result.ok, onclick: () => launch(config) }, 'Launch mission')) : null),
      h('div', { class: 'row' },
        config.recommended ? h('button', { type: 'button', class: 'btn btn-cyan', onclick: () => { setDraft({ loadout: config.recommended }); toast('Mission Control packed the lander for you.', { icon: 'check' }); } }, 'Use recommended') : null,
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => setDraft({ loadout: EMPTY }) }, 'Empty lander'),
        h('a', { class: 'btn btn-ghost', href: '#/campaign' }, 'Back to missions')));

    mount(left,
      missionId === 'free-play' ? freePlayPanel(draft.free, (patch) => setDraft({ free: { ...draft.free, ...patch } }), WORLD_CARD_HOOKS) : null,
      h('section', { class: 'panel' },
        h('h2', { class: 'panel-title' }, 'Machines'),
        h('div', { class: 'lo-modules' }, modules.map((mod) => moduleCard(mod, draft.loadout.modules[mod.id] ?? 0, (n) => { play('click'); setModules(mod.id, n); })))),
      h('section', { class: 'panel' },
        h('h2', { class: 'panel-title' }, 'Supplies from Earth'),
        needsPanel(result.needs),
        h('div', { class: 'lo-supplies' }, SUPPLIES.map((sup) => supplySlider(sup, draft.loadout.supplies[sup.id] ?? 0, PER_DAY[sup.id] * 4, (kg) => setSupply(sup.id, kg))))));

    mount(side,
      h('div', { class: 'panel lo-check' },
        h('h2', { class: 'panel-title mars' }, 'Flight check'),
        massBar(result),
        validationList(result),
        difficultyPicker(draft.difficulty, (difficulty) => setDraft({ difficulty })),
        codeField(draft.code, (code) => setDraft({ code })),
        crewFields(draft.crew, (crew) => setDraft({ crew })),
        h('button', { type: 'button', class: 'btn btn-primary btn-lg lo-launch', disabled: !result.ok, onclick: () => launch(config) }, result.ok ? 'Launch mission' : 'Fix the red notes to launch')));
    window.scrollTo({ top: scrollY });
    if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
  }

  draw();
  root.append(head, briefing, h('div', { class: 'lo-layout' }, left, side));
  return () => stopLive?.();
}
