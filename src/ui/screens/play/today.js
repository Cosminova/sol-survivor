// Cadet view: the one decision of the day. Big picture cards (each shows what you GET and what it COSTS),
// a small preview of what the choice does to the three meters, the power switchboard when power is short,
// and one big Next day button. Every number comes from the engine preview in src/ui/kid/plans.js.
import { h } from '../../dom.js';
import { icon, MODULE_ICONS } from '../../icons.js';
import { MODULES } from '../../../data/modules.js';
import { SHIELDING } from '../../../data/constants.js';
import { availablePlans, planChips, planById } from '../../kid/plans.js';
import { KID_MODULE_NAMES, KID_MODULE_GIVES, dayWord } from '../../kid/words.js';

const fmt = (v) => (Math.round(Math.abs(v) * 10) / 10).toString();

const chip = (kind, { icon: name, text }) => h('span', { class: ['plan-chip', kind] },
  h('span', { class: 'plan-chip-sign', 'aria-hidden': 'true' }, kind === 'get' ? '+' : '−'),
  icon(name, { size: 16 }), h('span', null, text));

function planCard(plan, { sim, inside, selected, locked, tired, onPlan }) {
  const { gets, costs } = planChips(plan.id, sim, inside);
  return h('button', {
    type: 'button',
    id: `plan-${plan.id}`,
    class: ['plan-card', `plan-${plan.id}`, selected && 'selected'],
    'aria-pressed': String(selected),
    disabled: locked,
    onclick: () => onPlan(plan.id),
  },
  h('span', { class: 'plan-card-art', 'aria-hidden': 'true' }, icon(plan.icon, { size: 40 })),
  h('span', { class: 'plan-card-title' }, plan.title),
  selected ? h('span', { class: 'plan-card-tick' }, icon('check', { size: 16 }), h('span', null, 'Chosen')) : null,
  tired && plan.id === 'fix' ? h('span', { class: 'plan-card-flag' }, icon('bed', { size: 16 }), 'Crew is tired') : null,
  h('span', { class: 'plan-card-chips' },
    h('span', { class: 'sr-only' }, 'You get: '),
    h('span', { class: 'plan-chips' }, gets.map((g) => chip('get', g))),
    h('span', { class: 'sr-only' }, 'It costs: '),
    h('span', { class: 'plan-chips' }, costs.map((c) => chip('cost', c)))));
}

// One line of the preview: a meter name, an up/down/steady mark with words, and the exact change.
function effect(name, iconName, delta, text, { goodWhenUp = true } = {}) {
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
  const tone = dir === 'same' ? 'same' : (dir === 'up') === goodWhenUp ? 'good' : 'bad';
  const word = dir === 'up' ? 'goes up' : dir === 'down' ? 'goes down' : 'stays the same';
  return h('li', { class: ['plan-effect', tone] },
    icon(iconName, { size: 20 }),
    h('span', { class: 'plan-effect-name' }, name),
    h('span', { class: ['plan-arrow', dir], 'aria-hidden': 'true' }),
    h('span', { class: 'sr-only' }, ` ${word}: `),
    h('span', { class: 'plan-effect-num' }, text));
}

function preview(mission, sim, planId) {
  if (!sim) return null;
  const plan = planById(planId);
  const hasBattery = mission.capacity.batteryKwh > 0;
  const shieldPct = Math.round((100 * sim.shieldWork) / SHIELDING.bermWorkPerLevel);
  const powerText = sim.cold ? 'too little to stay warm' : sim.shed.length ? 'not enough for every machine'
    : hasBattery ? (sim.batteryPct === 0 ? 'battery stays the same' : `battery ${fmt(sim.batteryPct)}% ${sim.batteryPct > 0 ? 'fuller' : 'emptier'}`) : 'enough';
  const powerDelta = sim.cold || sim.shed.length ? -1 : hasBattery ? sim.batteryPct : 0;
  return h('div', { id: 'plan-preview', class: 'plan-preview', role: 'status' },
    h('p', { class: 'plan-preview-title' }, plan ? `${plan.short}: what should happen next` : 'Mixed jobs: what should happen next'),
    h('ul', { class: 'plan-effects' },
      effect('Air', 'bubbles', sim.air, `${fmt(sim.air)} kg ${sim.air < 0 ? 'used' : 'more'}`),
      effect('Power', 'zap', powerDelta, powerText),
      effect('Shield', 'shield', sim.shieldWork, sim.shieldWork > 0 ? `${shieldPct}% of a new level` : 'no change'),
      effect('Science', 'flask', sim.science, sim.science > 0 ? `${fmt(sim.science)} points` : 'none')));
}

// Machines a young player may switch off to save power. Life support (recycler, air maker) stays in Mission details.
const switchable = (mission) => MODULES.filter((mod) => mod.id in mission.enabled && (mod.priority ?? 9) > 1);

function switchboard(mission, sim, { locked, onToggle }) {
  const mods = switchable(mission);
  const short = Boolean(sim?.shed.length || sim?.cold);
  const anyOff = mods.some((mod) => !mission.enabled[mod.id]);
  if (!mods.length || (!short && !anyOff)) return null;
  return h('section', { id: 'kid-switchboard', class: ['kid-switchboard', short ? 'short' : 'ok'], 'aria-label': 'Power switches' },
    h('p', { class: 'kid-switchboard-title' }, icon('zap', { size: 20 }),
      short ? 'Not enough power tonight. Pick what to switch off:' : 'Enough power now. Switched off machines stay off.'),
    h('div', { class: 'kid-switches' }, mods.map((mod) => {
      const on = Boolean(mission.enabled[mod.id]);
      const name = KID_MODULE_NAMES[mod.id] ?? mod.name;
      return h('button', {
        type: 'button',
        id: `switch-${mod.id}`,
        class: ['kid-switch', on ? 'on' : 'off'],
        role: 'switch',
        'aria-checked': String(on),
        'aria-label': `${name}. ${KID_MODULE_GIVES[mod.id] ?? ''}.`,
        disabled: locked,
        onclick: () => onToggle(mod.id),
      },
      icon(MODULE_ICONS[mod.id] ?? 'power', { size: 26 }),
      h('span', { class: 'kid-switch-name' }, name),
      h('span', { class: 'kid-switch-gives' }, KID_MODULE_GIVES[mod.id] ?? ''),
      h('span', { class: 'kid-switch-state' }, on ? 'On' : 'Off'));
    })));
}

/**
 * @param {object} mission
 * @param {{ sims: Record<string, object|null>, sim: object|null, selected: string|null, busy: boolean,
 *           onPlan: (id: string) => void, onNext: () => void, onToggle: (id: string) => void }} opts
 */
export function todayPanel(mission, { sims, sim, selected, busy, onPlan, onNext, onToggle }) {
  const active = mission.status === 'active';
  const locked = !active || mission.phase === 'event' || busy;
  const plans = availablePlans(mission);
  const tired = mission.crew.some((c) => c.health <= 30 || c.morale < 35);
  const unit = dayWord(mission.config.body);
  return h('section', { id: 'kid-today', class: 'kid-today', 'aria-labelledby': 'kid-today-title' },
    h('h2', { id: 'kid-today-title', class: 'kid-today-title' }, 'Today', h('span', null, active ? 'Pick one plan for your crew.' : 'The mission is over.')),
    h('div', { class: ['plan-cards', `n${plans.length}`], role: 'group', 'aria-label': 'Plans for today' },
      plans.map((plan) => planCard(plan, { sim: sims[plan.id], inside: sims.fix, selected: selected === plan.id, locked, tired, onPlan }))),
    active ? preview(mission, sim, selected) : null,
    active ? switchboard(mission, sim, { locked, onToggle }) : null,
    h('button', { type: 'button', id: 'next-sol', class: 'btn btn-primary btn-lg btn-caps kid-next', disabled: !active || busy, onclick: onNext, 'aria-keyshortcuts': 'N' },
      icon('play', { size: 22 }), active ? `Next ${unit === 'sol' ? 'day' : unit}` : 'Mission over'));
}
