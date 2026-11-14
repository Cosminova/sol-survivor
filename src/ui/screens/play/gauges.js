// Resource gauges with "sols left" forecasts, power balance, radiation dosimeter and history sparklines.
import { h } from '../../dom.js';
import { sparkline } from '../../charts.js';
import { termButton } from '../../components/common.js';
import { RADIATION } from '../../../data/constants.js';
import { effectiveShieldLevel } from '../../../engine/sim.js';
import { moduleById } from '../../../data/modules.js';
import { icon } from '../../icons.js';

const GAUGE_ICONS = { o2: 'bubbles', water: 'droplet', food: 'package', batteryKwh: 'battery', spares: 'wrench' };

const RESOURCES = [
  { key: 'o2', icon: '🫁', label: 'Oxygen', unit: 'kg', hex: '#7dd3fc', hist: 'o2', fc: 'o2', term: 'life-support' },
  { key: 'water', icon: '💧', label: 'Water', unit: 'kg', hex: '#60a5fa', hist: 'water', fc: 'water', term: 'eclss' },
  { key: 'food', icon: '🥫', label: 'Food', unit: 'kg', hex: '#a3e635', hist: 'food', fc: 'food', term: 'hydroponics' },
  { key: 'batteryKwh', icon: '🔋', label: 'Battery', unit: 'kWh', hex: '#fde047', hist: 'battery', fc: 'energy', term: 'battery' },
  { key: 'spares', icon: '🧰', label: 'Spare kits', unit: '', hex: '#c5d2de', hist: null, fc: null, term: 'redundancy' },
];

const fmt = (v) => (v >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toString());

function solsLeftBadge(f, remaining) {
  if (!f) return h('span', { class: 'badge' }, 'Forecast after Sol 1');
  if (!Number.isFinite(f.sols)) return h('span', { class: 'badge good' }, f.rate > 0 ? '▲ Growing' : '♾️ Stable');
  const level = f.sols <= 3 ? 'danger' : f.sols < remaining ? 'warn' : 'good';
  return h('span', { class: ['badge', level] }, `${f.sols} sol${f.sols === 1 ? '' : 's'} left`);
}

function gauge(res, m, fc) {
  const value = m.resources[res.key] ?? 0;
  const hist = res.hist ? m.history.map((x) => x[res.hist]) : [];
  let ref = Math.max(1, value, ...hist);
  if (res.key === 'batteryKwh') ref = m.capacity.batteryKwh;
  if (res.key === 'spares') ref = Math.max(1, m.modules.spares ?? 0);
  const pct = ref > 0 ? (100 * value) / ref : 0;
  const remaining = m.config.targetSols - m.sol;
  const f = res.fc && fc ? fc[res.fc] : null;
  const low = f && Number.isFinite(f.sols) && f.sols <= 3 && f.sols < remaining;
  return h('div', { class: ['gauge', low && 'low'], style: { '--g': res.hex } },
    h('div', { class: 'gauge-top' },
      h('span', { class: 'gauge-icon', 'aria-hidden': 'true' }, icon(GAUGE_ICONS[res.key], { size: 20 })),
      h('span', { class: 'gauge-label' }, termButton(res.term, res.label)),
      h('span', { class: 'gauge-value mono' }, fmt(value), h('small', null, ` ${res.unit}`))),
    h('div', { class: 'gauge-bar', role: 'meter', 'aria-label': `${res.label} level`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct) },
      h('span', { style: { width: `${Math.min(100, pct)}%` } })),
    h('div', { class: 'gauge-foot' },
      res.fc ? solsLeftBadge(f, remaining) : h('span', { class: 'badge' }, `${value} ready`),
      f && Number.isFinite(f.rate) ? h('span', { class: 'faint mono' }, `${f.rate >= 0 ? '+' : ''}${fmt(f.rate)}/sol`) : null),
    hist.length > 1 ? sparkline(hist, { color: res.hex, label: `${res.label} over time`, min: 0 }) : null);
}

export function resourcesPanel(m, fc) {
  return h('section', { class: 'panel play-resources', 'aria-label': 'Life support resources' },
    h('h2', { class: 'panel-title' }, icon('fuel', { size: 18 }), 'Life support', h('span', { class: 'spacer' }), termButton('bvad', 'How much do we need?')),
    h('div', { class: 'gauges' }, RESOURCES.map((r) => gauge(r, m, fc))));
}

export function powerPanel(m, power) {
  const gen = power.generatedKwh;
  const demand = power.demandKwh;
  const max = Math.max(gen, demand, 1);
  const balance = gen - demand;
  const off = Object.keys(m.modifiers?.offline ?? {}).map((id) => moduleById(id)?.name).filter(Boolean);
  const pctOf = (v) => `${(100 * Math.max(0, v)) / max}%`;
  return h('section', { class: 'panel play-power', 'aria-label': 'Power balance' },
    h('h2', { class: 'panel-title' }, icon('zap', { size: 18 }), 'Power balance (next sol)', h('span', { class: 'spacer' }), termButton('kwh', 'kWh?')),
    h('div', { class: 'pbar' },
      h('span', { class: 'pbar-label' }, 'Make'),
      h('div', { class: 'pbar-track' },
        h('span', { class: 'pbar-solar', style: { width: pctOf(power.solarKwh) }, title: `Solar ${power.solarKwh} kWh` }),
        h('span', { class: 'pbar-fission', style: { width: pctOf(power.fissionKwh) }, title: `Nuclear ${power.fissionKwh} kWh` })),
      h('span', { class: 'mono' }, `${Math.round(gen)} kWh`)),
    h('div', { class: 'pbar' },
      h('span', { class: 'pbar-label' }, 'Use'),
      h('div', { class: 'pbar-track' },
        h('span', { class: 'pbar-heat', style: { width: pctOf(power.baseKwh) }, title: `Heaters & habitat ${power.baseKwh} kWh` }),
        h('span', { class: 'pbar-load', style: { width: pctOf(demand - power.baseKwh) }, title: 'Machines' })),
      h('span', { class: 'mono' }, `${Math.round(demand)} kWh`)),
    h('p', { class: ['pbar-verdict', balance >= 0 ? 'ok' : 'short'] },
      icon(balance >= 0 ? 'check' : 'alert', { size: 18 }), balance >= 0 ? `✅ +${Math.round(balance)} kWh spare` : `⚠️ ${Math.round(-balance)} kWh short: the battery must cover it`),
    h('div', { class: 'row pbar-legend' },
      h('span', { class: 'key solar' }, 'Solar'), h('span', { class: 'key fission' }, 'Nuclear'), h('span', { class: 'key heat' }, 'Heat & habitat'), h('span', { class: 'key load' }, 'Machines')),
    power.shed.length ? h('p', { class: 'badge warn' }, `Not enough power for: ${power.shed.map((id) => moduleById(id)?.name).join(', ')}`) : null,
    off.length ? h('p', { class: 'faint' }, `Offline for repairs: ${off.join(', ')}`) : null);
}

export function dosimeter(m) {
  const avg = m.crew.reduce((s, c) => s + c.doseMsv, 0) / m.crew.length;
  const transit = m.crew[0]?.transitDoseMsv ?? 0;
  const pct = (100 * avg) / RADIATION.careerLimitMsv;
  const today = m.lastReport?.doseToday ?? 0;
  const level = effectiveShieldLevel(m);
  const hist = m.history.map((x) => x.doseToday);
  return h('section', { class: ['panel', 'play-rad', m.today?.sep && 'alert'], 'aria-label': 'Radiation dosimeter' },
    h('h2', { class: 'panel-title mars' }, icon('atom', { size: 18 }), 'Radiation dosimeter', h('span', { class: 'spacer' }), termButton('sievert', 'mSv?')),
    h('div', { class: 'rad-row' },
      h('div', { class: 'rad-dial', style: { '--pct': Math.min(100, pct) }, role: 'meter', 'aria-label': 'Average crew dose versus career limit', 'aria-valuemin': 0, 'aria-valuemax': RADIATION.careerLimitMsv, 'aria-valuenow': Math.round(avg) },
        h('span', { class: 'mono' }, Math.round(avg)), h('small', null, 'mSv')),
      h('div', { class: 'stack-sm' },
        h('span', null, 'Today: ', h('strong', { class: 'mono' }, `${today} mSv`), h('span', { class: 'faint' }, ` ≈ ${Math.round(today / RADIATION.chestXrayMsv)} chest X-rays`)),
        h('span', null, 'Career limit: ', h('strong', { class: 'mono' }, `${RADIATION.careerLimitMsv} mSv`), ' ', termButton('dose-limit', 'why?')),
        transit > 0 ? h('span', { class: 'faint' }, `Includes ${transit} mSv from the trip to Mars`) : null,
        h('span', { class: 'shield-pips' }, 'Shielding ', h('span', { class: 'sr-only' }, `level ${level} of 3`), [0, 1, 2].map((i) => h('i', { class: i < level ? 'on' : '', 'aria-hidden': 'true' })), ' ', termButton('radiation-shielding', '?')))),
    hist.length > 1 ? sparkline(hist, { color: '#f472b6', label: 'Daily dose over time', min: 0 }) : null);
}
