// Cadet view: three big picture meters (Air, Power, Shield). Each shows a picture, a name and ONE word
// (Good / Low / Danger) with an icon. The numbers stay hidden until the meter is tapped.
import { h, s } from '../../dom.js';
import { icon } from '../../icons.js';
import { METER_WORD } from '../../kid/plans.js';
import { dayWord } from '../../kid/words.js';

const LEVEL_ICON = { good: 'check', low: 'alert', danger: 'alert' };
const fmt = (v) => (v >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toString());

const svg = (...children) => s('svg', { class: 'kid-meter-art', viewBox: '0 0 64 80', 'aria-hidden': 'true', focusable: 'false' }, ...children);

// An oxygen tank that fills from the bottom.
function tankArt(pct) {
  const top = 16;
  const height = 56;
  const fill = Math.max(0, Math.min(100, pct)) * height / 100;
  return svg(
    s('defs', null, s('clipPath', { id: 'kid-tank-clip' }, s('rect', { x: 17, y: top, width: 30, height, rx: 15 }))),
    s('rect', { class: 'art-part', x: 26, y: 4, width: 12, height: 9 }),
    s('rect', { class: 'art-part', x: 22, y: 11, width: 20, height: 5 }),
    s('rect', { class: 'art-fill', x: 17, y: top + height - fill, width: 30, height: fill, 'clip-path': 'url(#kid-tank-clip)' }),
    s('rect', { class: 'art-line', x: 17, y: top, width: 30, height, rx: 15 }),
    s('circle', { class: 'art-bubble', cx: 27, cy: 60, r: 2.5 }),
    s('circle', { class: 'art-bubble', cx: 36, cy: 52, r: 1.8 }),
    s('circle', { class: 'art-bubble', cx: 30, cy: 44, r: 1.4 }));
}

// A battery with four cells.
function batteryArt(cells) {
  return svg(
    s('rect', { class: 'art-part', x: 24, y: 4, width: 16, height: 7 }),
    s('rect', { class: 'art-line', x: 13, y: 11, width: 38, height: 64, rx: 3 }),
    [0, 1, 2, 3].map((i) => s('rect', { class: i < cells ? 'art-fill' : 'art-empty', x: 18, y: 59 - i * 14.5, width: 28, height: 11.5 })));
}

// A shield cut into three bands, lit from the bottom up.
function shieldArt(segments) {
  const outline = 'M32 5 L55 13 V37 C55 55 44 67 32 75 C20 67 9 55 9 37 V13 Z';
  const bands = [[52, 24], [30, 22], [4, 26]];
  return svg(
    s('defs', null, s('clipPath', { id: 'kid-shield-clip' }, s('path', { d: outline }))),
    s('g', { 'clip-path': 'url(#kid-shield-clip)' },
      bands.map(([y, hgt], i) => s('rect', { class: i < segments ? 'art-fill' : 'art-empty', x: 6, y: y + 1, width: 52, height: hgt - 2 }))),
    s('path', { class: 'art-line', d: outline }));
}

const days = (n, body) => (Number.isFinite(n) ? `about ${n} ${dayWord(body, { plural: n !== 1 })} left` : 'not running out');

function airDetail(st, body) {
  return h('ul', { class: 'kid-meter-facts' }, st.supplies.map((sup) => h('li', { class: sup.level },
    h('strong', null, `${sup.name}: `), `${fmt(sup.amount)} ${sup.unit}, ${days(sup.days, body)}`)));
}

function powerDetail(st, sim) {
  const p = sim?.after.lastReport.power;
  return h('ul', { class: 'kid-meter-facts' },
    h('li', null, h('strong', null, 'Battery: '), st.hasBattery ? `${st.pct}% full (${fmt(st.batteryKwh)} of ${fmt(st.capKwh)} kWh)` : 'none on this mission'),
    p ? h('li', null, h('strong', null, 'Tomorrow: '), `makes ${Math.round(p.generatedKwh)} kWh, needs ${Math.round(p.demandKwh)} kWh`) : null,
    st.cold ? h('li', { class: 'danger' }, 'Not enough power to keep the base warm.') : null);
}

function shieldDetail(st) {
  return h('ul', { class: 'kid-meter-facts' },
    h('li', null, h('strong', null, 'Shield: '), `level ${st.segments} of ${st.max}`),
    st.segments < st.max ? h('li', null, h('strong', null, 'Next level: '), `${fmt(st.work)} of ${st.perLevel} work days done`) : null,
    h('li', null, h('strong', null, 'Radiation so far: '), `${fmt(st.dose)} of ${st.limit} mSv (the safe limit)`),
    st.storm ? h('li', { class: 'danger' }, 'A solar storm is hitting the base today.') : null);
}

function meter({ id, name, level, art, word, detail, open, onToggle }) {
  const label = word ?? METER_WORD[level];
  return h('div', { class: ['kid-meter-wrap', open && 'open'] },
    h('button', {
      type: 'button',
      id: `meter-${id}`,
      class: ['kid-meter', `kid-meter-${id}`, level],
      'aria-expanded': String(Boolean(open)),
      'aria-controls': `meter-${id}-detail`,
      onclick: () => onToggle(id),
    },
    art,
    h('span', { class: 'kid-meter-name' }, name),
    h('span', { class: 'kid-meter-state' }, icon(LEVEL_ICON[level], { size: 18 }), label),
    h('span', { class: 'sr-only' }, open ? '. Hide the numbers.' : '. Show the numbers.')),
    h('div', { id: `meter-${id}-detail`, class: 'kid-meter-detail', hidden: !open, role: 'region', 'aria-label': `${name} numbers` }, open ? detail() : null));
}

/**
 * @param {object} mission
 * @param {ReturnType<import('../../kid/plans.js').meterStates>} states
 * @param {{ sim: object|null, open: string|null, onToggle: (id: string) => void }} opts
 */
export function metersPanel(mission, states, { sim, open, onToggle }) {
  const body = mission.config.body;
  const { air, power, shield } = states;
  const cells = power.hasBattery ? Math.ceil(power.pct / 25) : power.cold ? 0 : power.shed.length ? 2 : 4;
  return h('section', { class: 'kid-meters', 'aria-label': 'Air, power and shield' },
    meter({ id: 'air', name: 'Air', level: air.level, art: tankArt(air.o2Pct), word: air.cause ? `${METER_WORD[air.level]}: ${air.cause.toLowerCase()}` : null, detail: () => airDetail(air, body), open: open === 'air', onToggle }),
    meter({ id: 'power', name: 'Power', level: power.level, art: batteryArt(cells), detail: () => powerDetail(power, sim), open: open === 'power', onToggle }),
    meter({ id: 'shield', name: 'Shield', level: shield.level, art: shieldArt(shield.segments), detail: () => shieldDetail(shield), open: open === 'shield', onToggle }));
}
