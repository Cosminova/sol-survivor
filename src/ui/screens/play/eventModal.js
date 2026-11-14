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
import { isExpertView, realDataLabel } from '../../kid/view.js';
import { kidHint, dayWord } from '../../kid/words.js';

const sign = (v) => (v > 0 ? `+${v}` : `${v}`);

// Cadet view: the same effects in plain words (numbers kept, jargon dropped).
function kidEffectChips(effects = {}) {
  const chips = [];
  const add = (cls, text) => chips.push(h('span', { class: ['badge', cls] }, text));
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
  if (effects.dust < 0) add('good', 'Cleaner solar panels');
  if (effects.storm) add('warn', 'Dust storm: less solar power');
  if (effects.disable) add('warn', `Turns off: ${[].concat(effects.disable).map((id) => moduleById(id)?.name ?? id).join(', ')}`);
  if (effects.breakChance) add('warn', 'Risky: something might break');
  if (effects.repairAll) add('good', 'Fixes everything');
  return chips;
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

// openEventModal(mission, { onChoose(index) -> resolvedMission, onDone() })
export function openEventModal(mission, { onChoose, onDone }) {
  const card = eventById(mission.pendingEvent.id);
  if (!card) { onDone(); return; }
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
