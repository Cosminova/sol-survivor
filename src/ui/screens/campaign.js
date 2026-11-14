// Campaign map: six chapters as a mission path (Moon -> Mars) with stars, locks and a briefing panel.
import '../../styles/campaign.css';
import { h, mount, richText } from '../dom.js';
import { CAMPAIGN } from '../../data/missions.js';
import { siteById } from '../../data/sites.js';
import { getState } from '../../state/store.js';
import { stars, didYouKnow, termButton, sourceBadge } from '../components/common.js';
import { openTermPopover } from '../components/termPopover.js';
import { speak, canSpeak } from '../speech.js';
import { play } from '../audio.js';

export const isUnlocked = (index, progress, settings) => index === 0
  || settings.unlockAll
  || Boolean(progress[CAMPAIGN[index - 1].id]?.won);

function node(ch, index, { progress, settings, selectedId, onSelect }) {
  const unlocked = isUnlocked(index, progress, settings);
  const earned = progress[ch.id]?.stars ?? 0;
  const selected = ch.id === selectedId;
  return h('li', { class: ['camp-node', ch.body, !unlocked && 'locked', selected && 'selected', earned > 0 && 'done'], style: { '--i': index } },
    h('button', {
      type: 'button',
      class: 'camp-node-btn',
      'aria-pressed': String(selected),
      'aria-label': `Chapter ${ch.chapter}: ${ch.title}. ${unlocked ? `${earned} of 3 stars` : 'Locked. Finish the previous chapter to unlock.'}`,
      onclick: () => onSelect(ch.id),
    },
    h('span', { class: 'camp-planet', 'aria-hidden': 'true' }, unlocked ? h('span', { class: 'camp-num' }, ch.chapter) : '🔒'),
    h('span', { class: 'camp-node-title' }, ch.title),
    h('span', { class: 'camp-node-body' }, ch.body === 'mars' ? 'Mars' : 'Moon'),
    ch.teaser ? h('span', { class: 'camp-node-teaser' }, ch.teaser) : null,
    stars(earned, 3, { size: '1rem' })));
}

function briefing(ch, index, { progress, settings }) {
  const site = siteById(ch.siteId);
  const unlocked = isUnlocked(index, progress, settings);
  const best = progress[ch.id];
  return h('article', { class: ['panel', 'camp-brief', ch.body], 'aria-live': 'polite' },
    h('div', { class: 'camp-brief-art', 'aria-hidden': 'true' }, h('span', { class: 'camp-brief-planet' })),
    h('span', { class: ['kicker', ch.body === 'mars' && 'mars'] }, `Chapter ${ch.chapter} · ${ch.body === 'mars' ? 'Mars' : 'The Moon'}`),
    h('h2', null, ch.title),
    ch.teaser ? h('p', { class: 'camp-teaser' }, ch.teaser) : null,
    h('div', { class: 'row camp-facts' },
      h('span', { class: 'badge' }, `📍 ${site?.name ?? ch.siteId}`),
      h('span', { class: 'badge' }, `🗓️ ${ch.targetSols} ${ch.body === 'mars' ? 'sols' : 'days'}`),
      h('span', { class: 'badge' }, `⚖️ ${ch.budgetKg.toLocaleString()} kg`),
      h('span', { class: 'badge' }, `🔬 Science goal ${ch.scienceGoal}`),
      ch.includeTransitDose ? h('span', { class: 'badge warn' }, '☢️ Arrives with cruise radiation') : null),
    h('p', { class: 'camp-lesson' }, h('strong', null, 'You will learn: '), ch.lesson),
    h('blockquote', { class: 'camp-story' }, richText(ch.intro, openTermPopover)),
    site?.blurb ? h('p', { class: 'muted' }, site.blurb) : null,
    ch.realWorld?.text ? h('aside', { class: 'camp-real' },
      h('strong', null, '🌍 In the real world'),
      h('p', null, ch.realWorld.text),
      sourceBadge(ch.realWorld.source, { label: 'Source' })) : null,
    best ? h('p', { class: 'muted' }, `Best: ${best.points} points · ${best.stars}★ · played ${best.plays}×`) : null,
    h('div', { class: 'row' },
      unlocked
        ? h('a', { class: 'btn btn-primary btn-lg', href: `#/loadout/${ch.id}`, onclick: () => play('click') }, '🧳 Pack the lander')
        : h('button', { type: 'button', class: 'btn btn-lg', disabled: true }, `🔒 Finish Chapter ${ch.chapter - 1} first`),
      canSpeak() ? h('button', { type: 'button', class: 'btn', onclick: () => speak(`${ch.title}. ${ch.intro}`, true) }, '🔊 Read briefing') : null));
}

export function render(root) {
  const { progress, settings, savedMission } = getState();
  const firstOpen = CAMPAIGN.findIndex((ch, i) => isUnlocked(i, progress, settings) && !progress[ch.id]?.won);
  let selectedId = CAMPAIGN[Math.max(0, firstOpen)].id;
  const pathEl = h('ol', { class: 'camp-path', 'aria-label': 'Campaign chapters' });
  const briefEl = h('div');

  const draw = () => {
    const ctx = { progress, settings, selectedId, onSelect: (id) => { selectedId = id; play('click'); draw(); } };
    mount(pathEl, CAMPAIGN.map((ch, i) => node(ch, i, ctx)));
    const index = CAMPAIGN.findIndex((c) => c.id === selectedId);
    mount(briefEl, briefing(CAMPAIGN[index], index, ctx));
  };
  draw();

  const total = CAMPAIGN.reduce((sum, ch) => sum + (progress[ch.id]?.stars ?? 0), 0);
  root.append(
    h('header', { class: 'screen-head' },
      h('div', null,
        h('span', { class: 'kicker' }, 'Mission Campaign'),
        h('h1', null, 'From the Moon to Mars'),
        h('p', null, 'Each chapter teaches one big ', termButton('trade-off', 'trade-off'), '. Win a chapter to unlock the next. Earn up to 3 stars: survive, hit the science goal, keep the crew healthy.')),
      h('div', { class: 'row' },
        h('span', { class: 'badge' }, `⭐ ${total} / ${CAMPAIGN.length * 3}`),
        savedMission?.status === 'active' ? h('a', { class: 'btn btn-cyan', href: '#/play' }, `▶ Resume ${savedMission.config.title}`) : null,
        h('a', { class: 'btn', href: '#/loadout/free-play' }, '🛠️ Free Play'))),
    h('div', { class: 'camp-map' }, h('div', { class: 'camp-stars', 'aria-hidden': 'true' }), pathEl),
    h('div', { class: 'camp-lower' }, briefEl, didYouKnow()),
  );
}
