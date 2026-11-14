// Loadout building blocks: mass budget bar, module cards, supply sliders, validation list.
import { h } from '../../dom.js';
import { termButton, sourceBadge } from '../../components/common.js';

const CATEGORY_LABEL = { power: '⚡ Power', life: '🫁 Life support', isru: '⛏️ Living off the land', safety: '🛡️ Safety', science: '🔬 Science' };

export function massBar(result) {
  const pct = (100 * result.massKg) / result.budgetKg;
  const over = result.massKg > result.budgetKg;
  const left = result.budgetKg - result.massKg;
  return h('div', { class: ['lo-mass', over && 'over'] },
    h('div', { class: 'row between' },
      h('span', { class: 'lo-mass-label' }, '⚖️ Lander mass'),
      h('span', { class: 'mono lo-mass-num' }, `${result.massKg.toLocaleString()} / ${result.budgetKg.toLocaleString()} kg`)),
    h('div', {
      class: 'lo-mass-track',
      role: 'meter',
      'aria-label': 'Lander mass used',
      'aria-valuemin': 0,
      'aria-valuemax': result.budgetKg,
      'aria-valuenow': result.massKg,
    }, h('span', { style: { width: `${Math.min(100, pct)}%` } })),
    h('p', { class: 'lo-mass-left' }, over ? `🚫 ${Math.abs(left).toLocaleString()} kg too heavy!` : `${left.toLocaleString()} kg of room left`, ' · ', termButton('payload', 'Why a mass budget?')));
}

function stepper({ id, value, max, label, onChange }) {
  return h('div', { class: 'lo-stepper', role: 'group', 'aria-label': `${label} count` },
    h('button', { id: `${id}-dec`, type: 'button', class: 'btn btn-icon', 'aria-label': `Remove one ${label}`, disabled: value <= 0, onclick: () => onChange(value - 1) }, '−'),
    h('output', { class: 'mono lo-count', 'aria-live': 'polite' }, String(value)),
    h('button', { id: `${id}-inc`, type: 'button', class: 'btn btn-icon', 'aria-label': `Add one ${label}`, disabled: value >= max, onclick: () => onChange(value + 1) }, '+'));
}

export function moduleCard(mod, count, onChange) {
  const stats = [
    `${mod.massKg.toLocaleString()} kg`,
    mod.kw > 0 ? `uses ${mod.kw} kW` : null,
    mod.outputKw ? `makes ${mod.outputKw} kW` : null,
    mod.storageKwh ? `stores ${mod.storageKwh} kWh` : null,
    mod.o2Kg ? `+${mod.o2Kg} kg O₂/sol` : null,
    mod.waterKg ? `+${mod.waterKg} kg water/sol` : null,
  ].filter(Boolean);
  return h('article', { class: ['lo-module', count > 0 && 'packed', `cat-${mod.category}`] },
    h('div', { class: 'lo-module-head' },
      h('span', { class: 'lo-module-icon', 'aria-hidden': 'true' }, mod.icon),
      h('div', null, h('h3', null, mod.name), h('span', { class: 'lo-module-cat' }, CATEGORY_LABEL[mod.category] ?? mod.category))),
    h('p', { class: 'lo-module-blurb' }, mod.blurb),
    h('div', { class: 'lo-module-stats' }, stats.map((st) => h('span', { class: 'badge' }, st))),
    h('div', { class: 'row between lo-module-foot' },
      h('div', { class: 'row' }, mod.term ? termButton(mod.term, 'What is it?') : null),
      stepper({ id: `mod-${mod.id}`, value: count, max: mod.max, label: mod.name, onChange })));
}

export function supplySlider(sup, value, crewDayKg, onChange) {
  const id = `sup-${sup.id}`;
  const crewDays = crewDayKg > 0 ? Math.floor(value / crewDayKg) : 0;
  const note = h('span', { class: 'faint lo-supply-note' });
  const amount = h('span', { class: 'mono' });
  const paint = (v) => {
    const days = crewDayKg > 0 ? Math.floor(v / crewDayKg) : 0;
    amount.textContent = `${v.toLocaleString()} kg`;
    note.textContent = `≈ ${days} crew-days · weighs ${Math.round(v * sup.packMass).toLocaleString()} kg packed`;
  };
  paint(value);
  return h('div', { class: 'lo-supply' },
    h('label', { for: id, class: 'row between' }, h('span', null, h('span', { 'aria-hidden': 'true' }, `${sup.icon} `), sup.name), amount),
    h('input', {
      id, type: 'range', min: 0, max: 2000, step: 25, value,
      'aria-valuetext': `${value} kilograms, about ${crewDays} crew-days`,
      oninput: (e) => paint(Number(e.target.value)),
      onchange: (e) => onChange(Number(e.target.value)),
    }),
    note);
}

export function validationList(result) {
  if (result.ok && !result.warnings.length) {
    return h('div', { class: 'lo-valid ok', role: 'status' }, '✅ Flight check passed. Ready to launch!');
  }
  return h('div', { class: 'lo-valid', role: 'status', 'aria-live': 'polite' },
    result.errors.map((e) => h('p', { class: 'lo-err' }, '🚫 ', e)),
    result.warnings.map((w) => h('p', { class: 'lo-warn' }, '⚠️ ', w)),
    result.ok ? h('p', { class: 'lo-okish' }, '✅ You can launch, but read the warnings!') : null);
}

export function needsPanel(needs) {
  return h('div', { class: 'lo-needs' },
    h('span', { class: 'faint' }, 'Crew of 4 needs for the whole mission (', termButton('bvad', 'NASA BVAD'), '):'),
    h('div', { class: 'row' },
      h('span', { class: 'badge' }, `🫁 ${needs.o2} kg O₂`),
      h('span', { class: 'badge' }, `💧 ${needs.water} kg water`),
      h('span', { class: 'badge' }, `🥫 ${needs.food} kg food`)),
    sourceBadge('bvad', { label: 'Data' }));
}
