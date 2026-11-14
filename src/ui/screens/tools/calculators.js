// Small calculators: Earth days ↔ sols, your weight on other worlds, your age in Mars years.
import { h, mount } from '../../dom.js';
import { sourceBadge, termButton } from '../../components/common.js';
import { earthDaysToSols, solsToEarthDays } from '../../../engine/marsTime.js';
import { MARS, MOON } from '../../../data/constants.js';
import { toolCard, readout, fmt, fmtDate, parseDateInput, toDateInput, DAY_MS } from './card.js';

const MARS_YEAR_DAYS = 686.9726;
const LUNAR_DAY_DAYS = MOON.synodicDays;
const SOL_EXTRA_MIN = (MARS.dayHours - 24) * 60;
const LB_PER_KG = 2.20462;
const EARTH_JUMP_CM = 40;

const clampNum = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

function numberField({ id, label, value, min = 0, max, step = 'any', onInput }) {
  return h('label', { class: 'field', for: id },
    h('span', null, label),
    h('input', { id, class: 'input tools-num', type: 'number', inputmode: 'decimal', min, max, step, value, oninput: onInput }));
}

export function solConverterCard() {
  const out = h('div', { class: 'tools-result', 'aria-live': 'polite' });
  const earth = numberField({ id: 'tools-earth-days', label: 'Earth days', value: 30, max: 100000, onInput: (e) => fromEarth(Number(e.target.value)) });
  const sols = numberField({ id: 'tools-sols', label: 'Mars sols', value: '', max: 100000, onInput: (e) => fromSols(Number(e.target.value)) });
  const earthInput = earth.querySelector('input');
  const solInput = sols.querySelector('input');

  const show = (days) => {
    const driftH = (days * SOL_EXTRA_MIN) / 60;
    mount(out, h('p', null,
      `Over ${fmt(days, 1)} Earth days, a Mars clock falls `, h('strong', null, `${fmt(driftH, 1)} hours`),
      driftH >= 48 ? ` (about ${fmt(driftH / 24)} whole days)` : '',
      ' behind an Earth clock. That’s why mission teams on “Mars time” shift their sleep about 40 minutes later every day!'));
  };
  const fromEarth = (days) => {
    const d = clampNum(days, 0, 100000);
    if (d == null) return mount(out, h('p', { class: 'muted' }, 'Type a number of days.'));
    solInput.value = String(Math.round(earthDaysToSols(d) * 100) / 100);
    return show(d);
  };
  const fromSols = (n) => {
    const sl = clampNum(n, 0, 100000);
    if (sl == null) return mount(out, h('p', { class: 'muted' }, 'Type a number of sols.'));
    const d = solsToEarthDays(sl);
    earthInput.value = String(Math.round(d * 100) / 100);
    return show(d);
  };
  const preset = (label, days) => h('button', { type: 'button', class: 'chip', onclick: () => { earthInput.value = String(days); fromEarth(days); } }, label);
  fromEarth(30);

  return toolCard({
    id: 'tools-sol', icon: '🔁', kicker: 'Converter', title: 'Earth days ↔ Mars sols',
    footer: [termButton('sol', 'sol'), termButton('mars-year', 'Mars year'), sourceBadge('mars-fact', { label: 'Data' })],
    children: [
      h('div', { class: 'tools-pair' }, earth, h('span', { class: 'tools-pair-sep', 'aria-hidden': 'true' }, '⇄'), sols),
      h('div', { class: 'row', role: 'group', 'aria-label': 'Quick picks' },
        preset('1 week', 7), preset('1 Earth year', 365.25), preset('1 Mars year', MARS_YEAR_DAYS), preset('Trip to Mars', 180)),
      out,
      h('p', { class: 'muted tools-small' }, 'A sol is one Mars day: 24 hours, 39 minutes and 35 seconds. Mars spins a little slower than Earth, so every sol is about 40 minutes longer than an Earth day.'),
    ],
  });
}

function unitToggle(getUnit, setUnit) {
  const group = h('div', { class: 'tools-seg', role: 'group', 'aria-label': 'Weight unit' });
  const draw = () => mount(group, ['kg', 'lb'].map((u) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(getUnit() === u),
    onclick: () => { setUnit(u); draw(); group.querySelector('[aria-pressed="true"]')?.focus(); },
  }, u === 'kg' ? 'Kilograms' : 'Pounds')));
  draw();
  return group;
}

function jumpBars(jumps) {
  const max = Math.max(...jumps.map((j) => j.cm));
  return h('div', { class: 'tools-jumps', role: 'img', 'aria-label': jumps.map((j) => `${j.name} ${fmt(j.cm)} centimetres`).join(', ') },
    jumps.map((j) => h('div', { class: 'tools-jump', style: { '--h': `${(j.cm / max) * 100}%`, '--c': j.color } },
      h('span', { class: 'tools-jump-val' }, `${fmt(j.cm)} cm`),
      h('span', { class: 'tools-jump-bar', 'aria-hidden': 'true' }, h('span', null, '🧑‍🚀')),
      h('span', { class: 'tools-jump-name' }, j.name))));
}

export function weightCard() {
  let unit = 'kg';
  let weight = 40;
  const out = h('div', { class: 'tools-result', 'aria-live': 'polite' });
  const field = numberField({ id: 'tools-weight', label: 'Your weight on Earth', value: weight, max: 500, onInput: (e) => { weight = Number(e.target.value); update(); } });

  const update = () => {
    const w = clampNum(weight, 0, 1000);
    if (!w) return mount(out, h('p', { class: 'muted' }, 'Type your weight to see it on Mars and the Moon.'));
    const worlds = [
      { name: '🌍 Earth', g: 1, color: '#60a5fa' },
      { name: '🔴 Mars', g: MARS.gravity, color: '#ff7a3d' },
      { name: '🌕 Moon', g: MOON.gravity, color: '#cfd8ea' },
    ];
    return mount(out,
      h('div', { class: 'tools-readouts' }, worlds.map((x) => readout(x.name, `${fmt(w * x.g, 1)} ${unit}`, { tone: x.g === 1 ? null : 'gold' }))),
      h('p', { class: 'tools-small' }, `If you can jump ${EARTH_JUMP_CM} cm high on Earth, the same push sends you this high:`),
      jumpBars(worlds.map((x) => ({ ...x, name: x.name, cm: EARTH_JUMP_CM / x.g }))),
      h('p', { class: 'muted tools-small' }, 'Your mass (how much “stuff” you are made of) stays the same. A scale reads less because weaker gravity pulls on you less.'));
  };
  update();

  return toolCard({
    id: 'tools-weight', icon: '⚖️', kicker: 'Gravity calculator', title: 'Your weight on Mars & the Moon', tone: 'mars',
    footer: [termButton('gravity', 'gravity'), termButton('low-gravity', 'low gravity'), sourceBadge('planet-fact', { label: 'Data' })],
    children: [
      h('div', { class: 'tools-pair' }, field, unitToggle(() => unit, (u) => { unit = u; update(); })),
      out,
    ],
  });
}

function nextMarsBirthday(birth, now) {
  const yearsLived = (now - birth) / DAY_MS / MARS_YEAR_DAYS;
  const next = new Date(birth.getTime() + Math.ceil(yearsLived + 1e-9) * MARS_YEAR_DAYS * DAY_MS);
  return { date: next, inDays: Math.ceil((next - now) / DAY_MS), turning: Math.ceil(yearsLived + 1e-9) };
}

function ageResults(birth, now) {
  const days = (now - birth) / DAY_MS;
  const marsYears = days / MARS_YEAR_DAYS;
  const next = nextMarsBirthday(birth, now);
  return [
    h('div', { class: 'tools-age-hero' },
      h('span', null, 'On Mars you would be'),
      h('strong', null, fmt(marsYears, 2)),
      h('span', null, 'Mars years old')),
    h('div', { class: 'tools-readouts' },
      readout('Earth years', fmt(days / 365.25, 2)),
      readout('Days lived', fmt(Math.floor(days))),
      readout('Sols lived', fmt(Math.floor(earthDaysToSols(days)))),
      readout('Moon days (sunrise to sunrise)', fmt(days / LUNAR_DAY_DAYS, 1))),
    h('p', { class: 'tools-small' }, '🎂 Your next Mars birthday: ', h('strong', null, fmtDate(next.date)),
      ` (turning ${next.turning}, in ${fmt(next.inDays)} days).`),
  ];
}

export function ageCard() {
  const today = new Date();
  const out = h('div', { class: 'tools-result', 'aria-live': 'polite' });
  const input = h('input', { id: 'tools-birthday', class: 'input', type: 'date', max: toDateInput(today), min: '1900-01-01', value: '2014-06-01' });

  const update = () => {
    const birth = parseDateInput(input.value);
    if (!birth) return mount(out, h('p', { class: 'muted' }, 'Pick your birthday to begin.'));
    if (birth > today) return mount(out, h('p', { class: 'muted' }, 'That date is in the future. Time travel is not on the mission plan!'));
    if (birth.getUTCFullYear() < 1900) return mount(out, h('p', { class: 'muted' }, 'Please pick a date after 1900.'));
    return mount(out, ageResults(birth, today));
  };
  input.addEventListener('input', update);
  input.addEventListener('change', update);
  update();

  return toolCard({
    id: 'tools-age', icon: '🎂', kicker: 'Birthday calculator', title: 'Your age in Mars years', tone: 'violet',
    footer: [termButton('mars-year', 'Mars year'), termButton('lunar-day', 'lunar day'), sourceBadge('mars-fact', { label: 'Data' })],
    children: [
      h('label', { class: 'field', for: 'tools-birthday' }, h('span', null, 'Your birthday'), input),
      out,
      h('p', { class: 'muted tools-small' }, 'Mars takes 687 Earth days to go around the Sun once, so Mars birthdays come about every 1 year and 10 months.'),
    ],
  });
}
