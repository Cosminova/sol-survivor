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

const sign = (v) => (v > 0 ? `+${v}` : `${v}`);

function effectChips(effects = {}) {
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
    h('h3', null, '🔬 Real Science'),
    h('p', null, richText(fillTemplate(card.science ?? '', vars), openTermPopover)),
    h('div', { class: 'row' },
      sourceBadge(card.source, { label: 'Archived NASA data' }),
      (card.terms ?? []).slice(0, 4).map((id) => (termById(id) ? h('button', { type: 'button', class: 'chip', onclick: (e) => openTermPopover(id, e.currentTarget) }, `📖 ${termById(id).term}`) : null))));
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
            h('p', { class: 'event-choice-made' }, `You chose: ${choice.label}`),
            h('p', { class: 'event-outcome-text' }, choice.outcome),
            h('div', { class: 'row' }, effectChips(choice.effects))),
          sciencePanel(card, vars),
          h('button', { type: 'button', class: 'btn btn-primary btn-lg', 'data-autofocus': true, onclick: close }, `Continue Sol ${resolved?.sol ?? mission.sol} ▶`));
        speak(choice.outcome);
        wrap.querySelector('[data-autofocus]')?.focus();
      };
      wrap.append(
        h('p', { class: 'event-text' }, richText(body, openTermPopover)),
        canSpeak() ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => speak(`${title}. ${plainText(body)}`, true) }, '🔊 Read aloud') : null,
        sciencePanel(card, vars),
        h('h3', { class: 'event-q' }, 'What do you do, Commander?'),
        h('div', { class: 'event-choices' }, card.choices.map((choice, i, all) => {
          const ok = choiceAvailable(mission, choice);
          // Focus the first choice the crew can actually take; a disabled button cannot hold focus.
          const firstOk = all.findIndex((c) => choiceAvailable(mission, c));
          return h('button', {
            type: 'button',
            class: ['event-choice', !ok && 'locked'],
            disabled: !ok,
            'data-autofocus': i === firstOk ? true : null,
            onclick: () => showOutcome(choice, onChoose(i)),
          },
          h('span', { class: 'event-choice-label' }, h('span', { class: 'event-choice-key', 'aria-hidden': 'true' }, String.fromCharCode(65 + i)), choice.label),
          ok ? h('span', { class: 'row' }, effectChips(choice.effects)) : h('span', { class: 'badge danger' }, `🔒 ${unavailableReason(choice)}`));
        })));
      return wrap;
    },
  });
}
