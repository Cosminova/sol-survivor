// Event card modal: story with glossary chips, "Real Science" panel with source, choices with effect previews,
// then an outcome screen so kids see the consequence of their decision.
import { h, richText, plainText } from '../../dom.js';
import { eventById } from '../../../data/eventCards.js';
import { moduleById } from '../../../data/modules.js';
import { fillTemplate, choiceAvailable } from '../../../engine/events.js';
import { termById } from '../../../data/glossary.js';
import { openModal } from '../../components/modal.js';
import { openTermPopover } from '../../components/termPopover.js';
import { sourceBadge } from '../../components/common.js';
import { speak, canSpeak } from '../../speech.js';
import { noteEventSeen } from './finish.js';
import { icon } from '../../icons.js';
import { isExpertView, realDataLabel, moreDetails } from '../../kid/view.js';
import { kidHint, dayWord, KID_MODULE_NAMES } from '../../kid/words.js';
import { kidEvent, KID_EVENT_ICONS } from '../../../data/kidText.js';

const sign = (v) => (v > 0 ? `+${v}` : `${v}`);

// Cadet view: the same effects in plain words (numbers kept, jargon dropped).
function kidEffectChips(effects = {}, cardId = null, mission = null) {
  const chips = [];
  const add = (cls, text) => chips.push(h('span', { class: ['badge', cls], dataset: { kind: cls === 'good' ? 'get' : 'cost' } }, text));
  const amount = (v, unit) => `${v > 0 ? 'Get' : 'Lose'} ${Math.abs(v)} ${unit}`;
  if (effects.o2) add(effects.o2 > 0 ? 'good' : 'danger', amount(effects.o2, 'kg of air'));
  if (effects.water) add(effects.water > 0 ? 'good' : 'danger', amount(effects.water, 'kg of water'));
  if (effects.food) add(effects.food > 0 ? 'good' : 'danger', amount(effects.food, 'kg of food'));
  if (effects.battery) add('good', 'Battery gets a boost');
  if (effects.spares) add(effects.spares > 0 ? 'good' : 'warn', effects.spares > 0 ? `Get ${effects.spares} spare kit${effects.spares > 1 ? 's' : ''}` : `Uses ${-effects.spares} spare kit${effects.spares < -1 ? 's' : ''}`);
  if (effects.science) add('good', amount(effects.science, 'science points'));
  if (effects.morale) add(effects.morale > 0 ? 'good' : 'warn', effects.morale > 0 ? 'Crew feels happier' : 'Crew feels a bit worse');
  if (effects.health) add(effects.health > 0 ? 'good' : 'danger', effects.health > 0 ? 'Crew gets healthier' : 'Crew health drops');
  if (effects.dose) add('danger', 'More radiation');
  if (effects.shelter === true) add('good', 'Blocks almost all the radiation');
  if (effects.shelter === 'partial') add('good', 'Blocks some radiation');
  // Engine rules that are not in the effects list: a sheltering crew does no work that day, and a crew that
  // keeps working in a solar storm takes the whole dose.
  if (effects.shelter) add('warn', 'No work or science today');
  if (cardId === 'sep_alert' && !effects.shelter) add('danger', 'Crew gets the full radiation');
  if (effects.dust < 0) add('good', 'Cleaner solar panels');
  if (effects.storm) add('warn', 'Dust storm: less solar power');
  // Only machines this base really has can be switched off (and save power).
  const off = effects.disable ? [].concat(effects.disable).filter((id) => !mission || id in mission.enabled) : [];
  if (off.length) add('good', 'Saves power');
  if (off.length) add('warn', `Turns off: ${off.map((id) => KID_MODULE_NAMES[id] ?? moduleById(id)?.name ?? id).join(', ')}`);
  if (effects.breakChance) add('warn', 'Risky: something might break');
  if (effects.repairAll) add('good', 'Fixes everything');
  if (effects.disableSols) add('warn', `No ${moduleById(effects.disableSols.id)?.name ?? effects.disableSols.id} for ${effects.disableSols.sols} days`);
  if (effects.blackout) add('warn', `No radio to Earth for ${effects.blackout} days`);
  if (effects.iceBonus) add('good', 'Ice drill makes more water');
  if (effects.greenhouseKw) add('warn', 'Greenhouse uses more power');
  if (effects.perchlorate) add('danger', 'Harvests cut in half');
  if (effects.shieldWork) add('good', 'Stronger shield');
  return chips;
}

// "You get" and "It costs" rows for one choice (Cadet view).
function getCostRows(effects, cardId, mission) {
  const chips = kidEffectChips(effects, cardId, mission);
  const gets = chips.filter((c) => c.dataset.kind === 'get');
  const costs = chips.filter((c) => c.dataset.kind === 'cost');
  const row = (label, cls, list) => (list.length ? h('span', { class: ['event-row', cls] }, h('span', { class: 'event-row-label' }, label), list) : null);
  if (!chips.length) return [h('span', { class: 'event-row' }, h('span', { class: 'badge' }, 'Nothing changes'))];
  return [row('You get', 'get', gets), row('It costs', 'cost', costs)];
}

const effectChips = (effects) => (isExpertView() ? expertEffectChips(effects) : kidEffectChips(effects));

function expertEffectChips(effects = {}) {
  const chips = [];
  const add = (cls, text) => chips.push(h('span', { class: ['badge', cls] }, text));
  if (effects.o2) add(effects.o2 > 0 ? 'good' : 'danger', `🫁 ${sign(effects.o2)} kg O₂`);
  if (effects.water) add(effects.water > 0 ? 'good' : 'danger', `💧 ${sign(effects.water)} kg water`);
  if (effects.food) add(effects.food > 0 ? 'good' : 'danger', `🥫 ${sign(effects.food)} kg food`);
  if (effects.battery) add('good', `🔋 ${sign(effects.battery)} kWh`);
  if (effects.spares) add(effects.spares > 0 ? 'good' : 'warn', `🧰 ${sign(effects.spares)} kits`);
  if (effects.science) add('good', `🔬 ${sign(effects.science)} science`);
  if (effects.morale) add(effects.morale > 0 ? 'good' : 'warn', `🙂 ${sign(effects.morale)} morale`);
  if (effects.health) add(effects.health > 0 ? 'good' : 'danger', `❤️ ${sign(effects.health)} health`);
  if (effects.dose) add('danger', `☢️ +${effects.dose} mSv`);
  if (effects.shelter === true) add('good', '🛡️ Shelter: blocks 95%');
  if (effects.shelter === 'partial') add('good', '🛡️ Partial cover');
  if (effects.dust < 0) add('good', '🧹 Cleaner panels');
  if (effects.storm) add('warn', `🌪️ Storm tau ${effects.storm.tau}`);
  if (effects.disable) add('warn', `⏻ Turns off ${[].concat(effects.disable).map((id) => moduleById(id)?.name ?? id).join(', ')}`);
  if (effects.breakChance) add('warn', `🎲 ${Math.round(effects.breakChance * 100)}% chance something breaks`);
  if (effects.repairAll) add('good', '🔧 Fixes everything');
  return chips;
}

function unavailableReason(choice) {
  const req = choice.requires ?? {};
  if (req.module) return `Needs a ${moduleById(req.module)?.name ?? req.module}`;
  if (req.spares) return `Needs ${req.spares} spare kit${req.spares > 1 ? 's' : ''}`;
  return 'Not available';
}

function sciencePanel(card, vars) {
  return h('aside', { class: 'event-science', 'aria-label': 'Real science' },
    h('h3', null, icon('flask', { size: 18 }), 'Real science'),
    h('p', null, richText(fillTemplate(card.science ?? '', vars), openTermPopover)),
    h('div', { class: 'row' },
      card.source === 'donki' && vars.eventDate ? realDataLabel(vars.eventDate, 'donki') : sourceBadge(card.source, { label: 'From NASA records' }),
      (card.terms ?? []).slice(0, 4).map((id) => (termById(id) ? h('button', { type: 'button', class: 'chip', onclick: (e) => openTermPopover(id, e.currentTarget) }, termById(id).term) : null))));
}

// Cadet view: a plain "words to know" box built from the card's own glossary terms.
function wordsToKnow(card) {
  const items = (card.terms ?? []).filter((id) => termById(id) && kidHint(id)).slice(0, 2);
  if (!items.length) return null;
  return h('aside', { class: 'event-words', 'aria-label': 'Words to know' },
    h('h3', null, icon('book', { size: 18 }), 'Words to know'),
    h('ul', null, items.map((id) => h('li', null, kidHint(id)))));
}

// Cadet view: a short title, one plain sentence, and big choices that show what you get and what it costs.
// The card's full story, real science and word list are one tap away under "More about this".
function openKidEventModal(mission, card, { onChoose, onDone, onPicked }) {
  const vars = mission.pendingEvent.vars ?? {};
  const kid = kidEvent(card.id);
  const title = fillTemplate(kid?.title ?? card.title, vars);
  const line = fillTemplate(kid?.line ?? plainText(card.body), vars);
  const body = fillTemplate(card.body, vars);
  const labelOf = (i) => fillTemplate(kid?.choices?.[i] ?? card.choices[i].label, vars);
  const unit = mission.config.body === 'mars' ? 'day' : dayWord(mission.config.body);
  speak(`${title}. ${line}`);
  noteEventSeen(card.id);
  const firstAvailable = card.choices.findIndex((c) => choiceAvailable(mission, c));

  openModal({
    title,
    wide: true,
    dismissible: false,
    className: `event-modal kid-event event-${card.id}`,
    onClose: onDone,
    content: (close) => {
      const wrap = h('div', { class: 'event-body' });
      const showOutcome = (i, resolved) => {
        const choice = card.choices[i];
        wrap.replaceChildren(
          h('div', { class: 'event-outcome', role: 'status' },
            h('p', { class: 'event-choice-made' }, `You chose: ${labelOf(i)}.`),
            h('p', { class: 'event-outcome-text' }, choice.outcome),
            h('div', { class: 'event-rows' }, getCostRows(choice.effects, card.id, mission))),
          h('button', { type: 'button', class: 'btn btn-primary btn-lg btn-caps', 'data-autofocus': true, onclick: close }, `Keep going with ${unit} ${resolved?.sol ?? mission.sol}`, icon('arrow-right', { size: 18 })));
        speak(choice.outcome);
        wrap.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
        wrap.closest('.modal')?.scrollTo({ top: 0 });
        onPicked?.(i);
      };
      wrap.append(...[
        h('div', { class: 'kid-event-story' },
          h('span', { class: 'kid-event-art', 'aria-hidden': 'true' }, icon(KID_EVENT_ICONS[card.id] ?? 'alert', { size: 56 })),
          h('p', { class: 'event-text' }, line)),
        card.source === 'donki' && vars.eventDate ? h('p', { class: 'kid-event-real' }, realDataLabel(vars.eventDate, 'donki', 'This storm really happened')) : null,
        h('h3', { class: 'event-q' }, card.choices.length > 1 ? 'What do you do?' : 'Nice!'),
        h('div', { class: 'event-choices' }, card.choices.map((choice, i) => {
          const ok = choiceAvailable(mission, choice);
          return h('button', {
            type: 'button',
            class: ['event-choice', 'kid-choice', !ok && 'locked'],
            disabled: !ok,
            'data-autofocus': i === firstAvailable ? true : null,
            onclick: () => showOutcome(i, onChoose(i)),
          },
          h('span', { class: 'event-choice-label' }, labelOf(i)),
          ok ? h('span', { class: 'event-rows' }, getCostRows(choice.effects, card.id, mission)) : h('span', { class: 'badge danger' }, icon('lock', { size: 14 }), unavailableReason(choice)));
        })),
        moreDetails(`event-${card.id}`, 'More about this',
          h('p', { class: 'event-full' }, richText(body, openTermPopover)),
          canSpeak() ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => speak(`${title}. ${plainText(body)}`, true) }, icon('volume', { size: 18 }), 'Read aloud') : null,
          sciencePanel(card, vars),
          wordsToKnow(card)),
      ].filter(Boolean));
      return wrap;
    },
  });
}

// openEventModal(mission, { onChoose(index) -> resolvedMission, onDone(), onPicked?(index) })
export function openEventModal(mission, { onChoose, onDone, onPicked }) {
  const card = eventById(mission.pendingEvent.id);
  if (!card) { onDone(); return; }
  if (!isExpertView()) { openKidEventModal(mission, card, { onChoose, onDone, onPicked }); return; }
  const vars = mission.pendingEvent.vars ?? {};
  const title = fillTemplate(card.title, vars);
  const body = fillTemplate(card.body, vars);
  speak(`${title}. ${body}`);
  noteEventSeen(card.id);
  const expert = isExpertView();
  const unit = dayWord(mission.config.body, { cap: true });

  openModal({
    title: `${card.icon} ${title}`,
    wide: true,
    dismissible: false,
    className: `event-modal event-${card.id}`,
    onClose: onDone,
    content: (close) => {
      const wrap = h('div', { class: 'event-body' });
      const showOutcome = (choice, resolved) => {
        wrap.replaceChildren(
          h('div', { class: 'event-outcome', role: 'status' },
            h('p', { class: 'event-choice-made' }, `You chose: ${choice.label}.`),
            h('p', { class: 'event-outcome-text' }, choice.outcome),
            h('div', { class: 'row' }, effectChips(choice.effects))),
          sciencePanel(card, vars),
          h('button', { type: 'button', class: 'btn btn-primary btn-lg', 'data-autofocus': true, onclick: close }, `Keep going with ${unit} ${resolved?.sol ?? mission.sol}`, icon('arrow-right', { size: 18 })));
        speak(choice.outcome);
        wrap.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
        wrap.closest('.modal')?.scrollTo({ top: 0 });
      };
      wrap.append(...[
        h('p', { class: 'event-text' }, richText(body, openTermPopover)),
        expert ? null : h('p', { class: 'event-help' }, 'Tap a blue word to see what it means.'),
        expert ? null : wordsToKnow(card),
        canSpeak() ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => speak(`${title}. ${plainText(body)}`, true) }, icon('volume', { size: 18 }), 'Read aloud') : null,
        sciencePanel(card, vars),
        h('h3', { class: 'event-q' }, 'What do you do, Commander?'),
        expert ? null : h('p', { class: 'event-help' }, 'Pick one. The small labels show what each choice does.'),
        h('div', { class: 'event-choices' }, card.choices.map((choice, i) => {
          // Autofocus the first choice the player can actually pick (a locked first choice would stall focus).
          const firstAvailable = card.choices.findIndex((c) => choiceAvailable(mission, c));
          const ok = choiceAvailable(mission, choice);
          return h('button', {
            type: 'button',
            class: ['event-choice', !ok && 'locked'],
            disabled: !ok,
            'data-autofocus': i === firstAvailable ? true : null,
            onclick: () => showOutcome(choice, onChoose(i)),
          },
          h('span', { class: 'event-choice-label' }, h('span', { class: 'event-choice-key', 'aria-hidden': 'true' }, String.fromCharCode(65 + i)), choice.label),
          ok ? h('span', { class: 'row' }, effectChips(choice.effects)) : h('span', { class: 'badge danger' }, icon('lock', { size: 14 }), unavailableReason(choice)));
        })),
      ].filter(Boolean));
      return wrap;
    },
  });
}
