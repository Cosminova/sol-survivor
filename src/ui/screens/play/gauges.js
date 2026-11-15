// Resource gauges with "sols left" forecasts, power balance, radiation dosimeter and history sparklines.
// Cadet view folds all of that into three big gauges (Air, Power, Shielding); the full panels stay one
// tap away under "More details" and are shown directly in Expert view.
import { h } from '../../dom.js';
import { sparkline } from '../../charts.js';
import { termButton } from '../../components/common.js';
import { RADIATION } from '../../../data/constants.js';
import { effectiveShieldLevel } from '../../../engine/sim.js';
import { moduleById } from '../../../data/modules.js';
import { icon } from '../../icons.js';
import { computePower } from '../../../engine/sim.js';
import { isExpertView, moreDetails } from '../../kid/view.js';
import { lastsText, lastsLevel, worstLevel, LEVEL_WORD, dayWord, dayKey } from '../../kid/words.js';

const GAUGE_ICONS = { o2: 'bubbles', water: 'droplet', food: 'package', batteryKwh: 'battery', spares: 'wrench' };

const RESOURCES = [
  { key: 'o2', icon: '🫁', label: 'Oxygen', unit: 'kg', hex: '#7dd3fc', hist: 'o2', fc: 'o2', term: 'life-support' },
  { key: 'water', icon: '💧', label: 'Water', unit: 'kg', hex: '#60a5fa', hist: 'water', fc: 'water', term: 'eclss' },
  { key: 'food', icon: '🥫', label: 'Food', unit: 'kg', hex: '#a3e635', hist: 'food', fc: 'food', term: 'hydroponics' },
  { key: 'batteryKwh', icon: '🔋', label: 'Battery', unit: 'kWh', hex: '#fde047', hist: 'battery', fc: 'energy', term: 'battery' },
  { key: 'spares', icon: '🧰', label: 'Spare kits', unit: '', hex: '#c5d2de', hist: null, fc: null, term: 'redundancy' },
];

const fmt = (v) => (v >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toString());

function solsLeftBadge(f, remaining, key) {
  if (!f) return h('span', { class: 'badge' }, `Forecast after ${dayWord(key, { cap: true })} 1`);
  if (!Number.isFinite(f.sols)) return h('span', { class: 'badge good' }, f.rate > 0 ? '▲ Growing' : '♾️ Stable');
  const level = f.sols <= 3 ? 'danger' : f.sols < remaining ? 'warn' : 'good';
  return h('span', { class: ['badge', level] }, `${f.sols} ${dayWord(key, { plural: f.sols !== 1 })} left`);
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
      res.fc ? solsLeftBadge(f, remaining, dayKey(m.config)) : h('span', { class: 'badge' }, `${value} ready`),
      f && Number.isFinite(f.rate) ? h('span', { class: 'faint mono' }, `${f.rate >= 0 ? '+' : ''}${fmt(f.rate)}/${dayWord(dayKey(m.config))}`) : null),
    hist.length > 1 ? sparkline(hist, { color: res.hex, label: `${res.label} over time`, min: 0 }) : null);
}

export function expertResources(m, fc) {
  return h('section', { class: 'panel play-resources', 'aria-label': 'Life support resources' },
    h('h2', { class: 'panel-title' }, icon('fuel', { size: 18 }), 'Life support', h('span', { class: 'spacer' }), termButton('bvad', 'How much do we need?')),
    h('div', { class: 'gauges' }, RESOURCES.map((r) => gauge(r, m, fc))));
}

export function expertPower(m, power) {
  const gen = power.generatedKwh;
  const demand = power.demandKwh;
  const max = Math.max(gen, demand, 1);
  const balance = gen - demand;
  const off = Object.keys(m.modifiers?.offline ?? {}).map((id) => moduleById(id)?.name).filter(Boolean);
  const pctOf = (v) => `${(100 * Math.max(0, v)) / max}%`;
  return h('section', { class: 'panel play-power', 'aria-label': 'Tomorrow’s power' },
    h('h2', { class: 'panel-title' }, icon('zap', { size: 18 }), 'Tomorrow’s power', h('span', { class: 'spacer' }), termButton('kwh', 'What is a kWh?')),
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

export function expertDosimeter(m) {
  const avg = m.crew.reduce((s, c) => s + c.doseMsv, 0) / m.crew.length;
  const transit = m.crew[0]?.transitDoseMsv ?? 0;
  const pct = (100 * avg) / RADIATION.careerLimitMsv;
  const today = m.lastReport?.doseToday ?? 0;
  const level = effectiveShieldLevel(m);
  const hist = m.history.map((x) => x.doseToday);
  return h('section', { class: ['panel', 'play-rad', m.today?.sep && 'alert'], 'aria-label': 'Radiation dosimeter' },
    h('h2', { class: 'panel-title mars' }, icon('atom', { size: 18 }), 'Radiation dosimeter', h('span', { class: 'spacer' }), termButton('sievert', 'What is mSv?')),
    h('div', { class: 'rad-row' },
      h('div', { class: 'rad-dial', style: { '--pct': Math.min(100, pct) }, role: 'meter', 'aria-label': 'Average crew dose versus career limit', 'aria-valuemin': 0, 'aria-valuemax': RADIATION.careerLimitMsv, 'aria-valuenow': Math.round(avg) },
        h('span', { class: 'mono' }, Math.round(avg)), h('small', null, 'mSv')),
      h('div', { class: 'stack-sm' },
        h('span', null, 'Today: ', h('strong', { class: 'mono' }, `${today} mSv`), h('span', { class: 'faint' }, ` ≈ ${Math.round(today / RADIATION.chestXrayMsv)} chest X-rays`)),
        h('span', null, 'Career limit: ', h('strong', { class: 'mono' }, `${RADIATION.careerLimitMsv} mSv`), ' ', termButton('dose-limit', 'Why a limit?')),
        transit > 0 ? h('span', { class: 'faint' }, `Includes ${transit} mSv from the trip to Mars`) : null,
        h('span', { class: 'shield-pips' }, 'Shielding ', h('span', { class: 'sr-only' }, `level ${level} of 3`), [0, 1, 2].map((i) => h('i', { class: i < level ? 'on' : '', 'aria-hidden': 'true' })), ' ', termButton('radiation-shielding', 'What is shielding?')))),
    hist.length > 1 ? sparkline(hist, { color: '#f472b6', label: 'Daily dose over time', min: 0 }) : null);
}

// ---- Cadet view: three big gauges ---------------------------------------------------------------

const LEVEL_ICON = { good: 'check', watch: 'alert', danger: 'alert' };

const levelPill = (level) => h('span', { class: ['kid-level', level] }, icon(LEVEL_ICON[level], { size: 18 }), LEVEL_WORD[level]);

function bar(pct, label, { mark = null } = {}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return h('div', { class: 'kid-bar', role: 'meter', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(clamped) },
    h('span', { class: 'kid-bar-fill', style: { width: `${clamped}%` } }),
    mark != null ? h('i', { class: 'kid-bar-mark', style: { left: `${Math.max(0, Math.min(100, mark))}%` }, 'aria-hidden': 'true' }) : null);
}

function tankPct(m, key, histKey) {
  const value = m.resources[key] ?? 0;
  const ref = Math.max(1, value, ...m.history.map((x) => x[histKey]));
  return (100 * value) / ref;
}

function shortLeft(f, remaining, body) {
  if (!f) return 'Ready';
  if (!Number.isFinite(f.sols) || f.sols >= remaining) return 'Plenty';
  if (f.sols <= 0) return 'Empty';
  return `${f.sols} ${dayWord(body, { plural: f.sols !== 1 })} left`;
}

function card({ id, name, term, iconName, level, color }, ...children) {
  return h('article', { class: ['kid-gauge', `kid-gauge-${id}`, level], style: { '--g': color }, 'aria-labelledby': `kid-gauge-${id}-title` },
    h('div', { class: 'kid-gauge-head' },
      h('span', { class: 'kid-gauge-icon', 'aria-hidden': 'true' }, icon(iconName, { size: 30 })),
      h('h3', { id: `kid-gauge-${id}-title`, class: 'kid-gauge-name' }, name),
      levelPill(level)),
    ...children.filter((c) => !(c instanceof HTMLElement && c.classList.contains('kid-more'))),
    h('div', { class: 'kid-gauge-foot' },
      term ? h('p', { class: 'kid-gauge-term' }, termButton(term.id, term.label)) : null,
      ...children.filter((c) => c instanceof HTMLElement && c.classList.contains('kid-more'))));
}

function airGauge(m, fc) {
  const remaining = m.config.targetSols - m.sol;
  const body = dayKey(m.config);
  const parts = [
    { key: 'o2', label: 'Air', f: fc?.o2 },
    { key: 'water', label: 'Water', f: fc?.water },
    { key: 'food', label: 'Food', f: fc?.food },
  ].map((p) => ({ ...p, level: lastsLevel(p.f, remaining) }));
  const level = worstLevel(...parts.map((p) => p.level));
  const worst = parts.find((p) => p.level === level && level !== 'good');
  const sub = (p, iconName, hist) => h('li', { class: ['kid-sub', p.level] },
    h('span', { class: 'kid-sub-name' }, icon(iconName, { size: 18 }), p.label),
    bar(tankPct(m, p.key, hist), `${p.label} tank level`),
    h('span', { class: 'kid-sub-text' }, shortLeft(p.f, remaining, body)));
  return card({ id: 'air', name: 'Air', iconName: 'bubbles', level, color: 'var(--o2)', term: { id: 'life-support', label: 'What is life support?' } },
    h('div', { class: ['kid-main-bar', parts[0].level] }, bar(tankPct(m, 'o2', 'o2'), 'Oxygen tank level')),
    h('p', { class: 'kid-gauge-text' }, worst ? `${worst.label}: ${lastsText(worst.f, remaining, body)}` : lastsText(fc?.o2, remaining, body)),
    h('ul', { class: 'kid-subs', 'aria-label': 'Water and food' }, sub(parts[1], 'droplet', 'water'), sub(parts[2], 'package', 'food')),
    moreDetails('air', 'More details', expertResources(m, fc)));
}

function powerGauge(m, fc, power) {
  const remaining = m.config.targetSols - m.sol;
  const cap = m.capacity.batteryKwh;
  const pct = cap > 0 ? (100 * m.resources.batteryKwh) / cap : 0;
  const gen = power.generatedKwh;
  const use = power.demandKwh;
  const max = Math.max(gen, use, 1);
  const making = gen >= use;
  const cold = m.lastReport?.power && m.lastReport.power.thermalOk === false;
  const level = cold ? 'danger' : worstLevel(lastsLevel(fc?.energy, remaining), power.shed.length ? 'watch' : 'good');
  return card({ id: 'power', name: 'Power', iconName: 'zap', level, color: 'var(--power)', term: { id: 'battery', label: 'Why a battery?' } },
    bar(pct, 'Battery level'),
    h('p', { class: 'kid-gauge-text' }, cap > 0 ? `Battery is ${Math.round(pct)}% full.` : 'No battery on this mission.'),
    h('div', { class: ['kid-balance', making ? 'ok' : 'short'] },
      h('div', { class: 'kid-balance-bar', role: 'img', 'aria-label': `We make ${Math.round(gen)} and we use ${Math.round(use)} kilowatt-hours a day` },
        h('span', { class: 'kid-balance-make', style: { width: `${(100 * gen) / max}%` } }),
        h('i', { class: 'kid-balance-use', style: { left: `${(100 * use) / max}%` } })),
      h('p', { class: 'kid-balance-key' }, h('span', { class: 'kid-key make' }, 'We make'), h('span', { class: 'kid-key use' }, 'We use')),
      h('p', { class: 'kid-balance-text' }, icon(making ? 'check' : 'alert', { size: 18 }),
        making ? 'Making more than we use.' : 'Using more than we make. The battery fills the gap.')),
    power.shed.length ? h('p', { class: 'kid-gauge-warn' }, `Not enough power for: ${power.shed.map((id) => moduleById(id)?.name).join(', ')}.`) : null,
    moreDetails('power', 'More details', expertPower(m, power)));
}

function shieldGauge(m) {
  const shield = effectiveShieldLevel(m);
  const avg = m.crew.reduce((sum, c) => sum + c.doseMsv, 0) / m.crew.length;
  const pct = (100 * avg) / RADIATION.careerLimitMsv;
  const today = m.lastReport?.doseToday ?? 0;
  const xrays = Math.round(today / RADIATION.chestXrayMsv);
  const level = pct >= 100 ? 'danger' : pct > 85 || m.today?.sep ? 'watch' : 'good';
  const shieldText = shield <= 0 ? 'No shield yet. Give someone the Build shield job.'
    : shield >= 3 ? 'Shield level 3 of 3. As strong as it gets!'
      : `Shield level ${shield} of 3. Keep building!`;
  return card({ id: 'shield', name: 'Shielding', iconName: 'shield', level, color: 'var(--rad)', term: { id: 'radiation-shielding', label: 'What is shielding?' } },
    h('div', { class: 'kid-pips', role: 'img', 'aria-label': `Shield level ${shield} of 3` }, [0, 1, 2].map((i) => h('i', { class: i < shield ? 'on' : '' }))),
    h('p', { class: 'kid-gauge-text' }, shieldText),
    h('div', { class: 'kid-dose' },
      h('p', { class: 'kid-dose-line' }, m.today?.sep ? 'Solar storm today! ' : '', m.lastReport
        ? `Radiation today: like ${xrays} chest X-ray${xrays === 1 ? '' : 's'}.`
        : 'Radiation: we will measure it after the first day.'),
      bar(pct, 'Crew radiation compared with the safe limit'),
      h('p', { class: 'kid-dose-total' }, `Crew total: ${Math.round(avg)} of ${RADIATION.careerLimitMsv} `, termButton('sievert', 'mSv'), ' (the safe limit).')),
    moreDetails('rad', 'More details', expertDosimeter(m)));
}

function cadetGauges(m, fc) {
  const power = computePower(m);
  return h('section', { class: 'kid-gauges', 'aria-label': 'Air, power and shielding' },
    airGauge(m, fc), powerGauge(m, fc, power), shieldGauge(m));
}

export const resourcesPanel = (m, fc) => (isExpertView() ? expertResources(m, fc) : cadetGauges(m, fc));
export const powerPanel = (m, power) => (isExpertView() ? expertPower(m, power) : null);
export const dosimeter = (m) => (isExpertView() ? expertDosimeter(m) : null);
