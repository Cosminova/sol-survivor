// Read-only views over the mission for the HUD: the mission status badge (NOMINAL / CAUTION, always
// paired with plain words) and the ticker readouts. Uses the advisor's forecast as-is; adds no game state.
import { h } from '../../dom.js';
import { seasonName, lightDelaySeconds } from '../../../engine/marsTime.js';
import { MOON, RADIATION } from '../../../data/constants.js';
import { KID_REASONS, dayWord, delayWords, skyWord, niceDate } from '../../kid/words.js';
import { isExpertView } from '../../kid/view.js';

const fmtDelay = (sec) => (sec < 60 ? `${sec.toFixed(1)} s` : `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`);
const FORECAST_LABELS = { o2: 'Oxygen', water: 'Water', food: 'Food', energy: 'Battery' };

// CAUTION when any resource forecast runs out before the mission ends (the same threshold the gauges and
// CAPCOM use for their warnings), or a dust storm, radiation storm or event card is active.
// reasons are the technical labels; plain holds the same reasons in Cadet-view words.
export function missionStatus(m, fc) {
  const remaining = m.config.targetSols - m.sol;
  const reasons = [];
  const plain = [];
  const add = (label, key) => { reasons.push(label); plain.push(KID_REASONS[key]); };
  if (fc) {
    for (const [key, label] of Object.entries(FORECAST_LABELS)) {
      if (fc[key] && fc[key].sols < remaining) add(`${label} low`, key);
    }
  }
  if (m.env?.storm) add('Dust storm', 'storm');
  if (m.today?.sep) add('Radiation storm', 'sep');
  if (m.phase === 'event') add('Event in progress', 'event');
  return { level: reasons.length ? 'caution' : 'nominal', reasons, plain };
}

// Cadet view: "ALL GOOD" / "WATCH OUT". Expert view: "NOMINAL" / "CAUTION" with the plain words beside it.
export function statusBadge(m, fc) {
  const { level, reasons, plain } = missionStatus(m, fc);
  const ok = level === 'nominal';
  const kidText = ok ? 'All good' : 'Watch out';
  const expert = isExpertView();
  const why = expert ? reasons : plain;
  return h('span', { class: 'status-wrap' },
    h('span', {
      class: ['status-badge', level],
      role: 'status',
      title: why.length ? why.join(' · ') : 'Everything is working well',
      'aria-label': `Mission status: ${kidText}${why.length ? `. ${why.join(', ')}` : ''}`,
    },
    h('span', { class: 'status-dot', 'aria-hidden': 'true' }),
    expert ? [ok ? 'Nominal' : 'Caution', h('span', { class: 'status-plain' }, kidText)] : kidText),
    why.length ? h('span', { class: 'status-why' }, `${why.slice(0, 2).join('. ')}.`) : null);
}

const daysLeft = (f, unit) => (!f ? 'no forecast yet' : Number.isFinite(f.sols) ? `${f.sols} ${unit} left` : 'steady');
const tone = (f, remaining) => (f && f.sols < remaining ? 'warn' : null);

export function telemetryItems(m, fc) {
  const e = m.env;
  const mars = m.config.body === 'mars';
  const expert = isExpertView();
  const remaining = m.config.targetSols - m.sol;
  const cap = m.capacity?.batteryKwh ?? 0;
  const avgDose = m.crew.reduce((sum, c) => sum + c.doseMsv, 0) / Math.max(1, m.crew.length);
  const delay = mars ? lightDelaySeconds(new Date(e.dateMs)) : MOON.lightSeconds;
  const { level } = missionStatus(m, fc);
  const ok = level === 'nominal';
  const unit = dayWord(m.config.body, { plural: true });
  const date = new Date(e.dateMs).toISOString().slice(0, 10);
  const battery = cap > 0 ? `${Math.round((100 * m.resources.batteryKwh) / cap)}%${expert ? ` · ${Math.round(m.resources.batteryKwh)} kWh` : ' full'}` : 'none';
  const blackout = m.modifiers?.blackout > 0;

  if (!expert) {
    const items = [
      { label: 'Status', value: ok ? 'All good' : 'Watch out', tone: ok ? 'good' : 'warn' },
      { label: mars ? 'Mars day (sol)' : 'Day', value: `${m.sol} of ${m.config.targetSols}` },
      { label: 'Date on Earth', value: niceDate(date) },
    ];
    if (mars) {
      items.push(
        { label: 'Season', value: seasonName(e.ls, m.site.lat >= 0) },
        { label: 'Sky', value: skyWord(e, m), tone: e.storm || e.tau >= 2 ? 'warn' : null },
        { label: 'Outside', value: `${e.minC}° to ${e.maxC}°C` });
    } else {
      items.push(
        { label: 'Sunlight', value: e.lit ? 'Sun is up' : 'Night, no sunlight', tone: e.lit ? null : 'warn' },
        { label: 'Outside', value: `${e.avgC}°C` });
    }
    items.push(
      { label: 'Radio to Earth', value: blackout ? `no contact for ${m.modifiers.blackout} ${unit}` : `takes ${delayWords(delay)}`, tone: blackout ? 'warn' : null },
      { label: 'Battery', value: battery, tone: tone(fc?.energy, remaining) },
      { label: 'Air', value: daysLeft(fc?.o2, unit), tone: tone(fc?.o2, remaining) },
      { label: 'Water', value: daysLeft(fc?.water, unit), tone: tone(fc?.water, remaining) },
      { label: 'Food', value: daysLeft(fc?.food, unit), tone: tone(fc?.food, remaining) },
      { label: 'Crew radiation', value: `${Math.round(avgDose)} of ${RADIATION.careerLimitMsv} (safe limit)`, tone: m.today?.sep ? 'warn' : null });
    return items;
  }

  const items = [
    { label: 'Status', value: ok ? 'NOMINAL (all good)' : 'CAUTION (watch out)', tone: ok ? 'good' : 'warn' },
    { label: mars ? 'Sol' : 'Day', value: `${m.sol} / ${m.config.targetSols}` },
    { label: 'Earth date', value: date },
  ];
  if (mars) {
    items.push(
      { label: 'Season', value: `Ls ${Math.round(e.ls)}° ${seasonName(e.ls, m.site.lat >= 0)}` },
      { label: 'Dust tau', value: `${e.tau}${e.storm ? ` · storm ${e.storm.solsLeft} sols` : ''}`, tone: e.storm || e.tau >= 2 ? 'warn' : null },
      { label: 'Temperature', value: `${e.minC}° to ${e.maxC}°C` },
      { label: 'Pressure', value: `${e.pressurePa} Pa` });
  } else {
    items.push(
      { label: 'Sunlight', value: e.lit ? 'Lunar day' : 'Lunar night', tone: e.lit ? null : 'warn' },
      { label: 'Temperature', value: `${e.avgC}°C` },
      { label: 'Pressure', value: '0 Pa (no air)' });
  }
  items.push(
    { label: 'Light delay', value: blackout ? `no contact ${m.modifiers.blackout} sols` : fmtDelay(delay), tone: blackout ? 'warn' : null },
    { label: 'Battery', value: battery, tone: tone(fc?.energy, remaining) },
    { label: 'Oxygen', value: daysLeft(fc?.o2, 'sols'), tone: tone(fc?.o2, remaining) },
    { label: 'Water', value: daysLeft(fc?.water, 'sols'), tone: tone(fc?.water, remaining) },
    { label: 'Food', value: daysLeft(fc?.food, 'sols'), tone: tone(fc?.food, remaining) },
    { label: 'Crew dose', value: `${Math.round(avgDose)} / ${RADIATION.careerLimitMsv} mSv`, tone: m.today?.sep ? 'warn' : null });
  return items;
}
