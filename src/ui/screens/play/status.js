// Read-only views over the mission for the HUD: the NOMINAL / CAUTION status badge and the telemetry
// ticker readouts. Uses the advisor's forecast as-is; adds no game state.
import { h } from '../../dom.js';
import { seasonName, lightDelaySeconds } from '../../../engine/marsTime.js';
import { MOON, RADIATION } from '../../../data/constants.js';

const fmtDelay = (sec) => (sec < 60 ? `${sec.toFixed(1)} s` : `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`);
const FORECAST_LABELS = { o2: 'Oxygen', water: 'Water', food: 'Food', energy: 'Battery' };

// CAUTION when any resource forecast runs out before the mission ends (the same threshold the gauges and
// CAPCOM use for their warnings), or a dust storm, radiation storm or event card is active.
export function missionStatus(m, fc) {
  const remaining = m.config.targetSols - m.sol;
  const reasons = [];
  if (fc) {
    for (const [key, label] of Object.entries(FORECAST_LABELS)) {
      if (fc[key] && fc[key].sols < remaining) reasons.push(`${label} low`);
    }
  }
  if (m.env?.storm) reasons.push('Dust storm');
  if (m.today?.sep) reasons.push('Radiation storm');
  if (m.phase === 'event') reasons.push('Event in progress');
  return { level: reasons.length ? 'caution' : 'nominal', reasons };
}

export function statusBadge(m, fc) {
  const { level, reasons } = missionStatus(m, fc);
  const text = level === 'nominal' ? 'Nominal' : 'Caution';
  return h('span', {
    class: ['status-badge', level],
    role: 'status',
    title: reasons.length ? reasons.join(' · ') : 'All systems nominal',
    'aria-label': `Mission status: ${text}${reasons.length ? `. ${reasons.join(', ')}` : ''}`,
  }, h('span', { class: 'status-dot', 'aria-hidden': 'true' }), text);
}

const daysLeft = (f) => (!f ? 'no forecast yet' : Number.isFinite(f.sols) ? `${f.sols} sols left` : 'stable');
const tone = (f, remaining) => (f && f.sols < remaining ? 'warn' : null);

export function telemetryItems(m, fc) {
  const e = m.env;
  const mars = m.config.body === 'mars';
  const remaining = m.config.targetSols - m.sol;
  const cap = m.capacity?.batteryKwh ?? 0;
  const avgDose = m.crew.reduce((sum, c) => sum + c.doseMsv, 0) / Math.max(1, m.crew.length);
  const delay = mars ? lightDelaySeconds(new Date(e.dateMs)) : MOON.lightSeconds;
  const { level } = missionStatus(m, fc);
  const items = [
    { label: 'Status', value: level === 'nominal' ? 'NOMINAL' : 'CAUTION', tone: level === 'nominal' ? 'good' : 'warn' },
    { label: mars ? 'Sol' : 'Day', value: `${m.sol} / ${m.config.targetSols}` },
    { label: 'Earth date', value: new Date(e.dateMs).toISOString().slice(0, 10) },
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
    { label: 'Light delay', value: m.modifiers?.blackout > 0 ? `no contact ${m.modifiers.blackout} sols` : fmtDelay(delay), tone: m.modifiers?.blackout > 0 ? 'warn' : null },
    { label: 'Battery', value: cap > 0 ? `${Math.round((100 * m.resources.batteryKwh) / cap)}% · ${Math.round(m.resources.batteryKwh)} kWh` : 'none', tone: tone(fc?.energy, remaining) },
    { label: 'Oxygen', value: daysLeft(fc?.o2), tone: tone(fc?.o2, remaining) },
    { label: 'Water', value: daysLeft(fc?.water), tone: tone(fc?.water, remaining) },
    { label: 'Food', value: daysLeft(fc?.food), tone: tone(fc?.food, remaining) },
    { label: 'Crew dose', value: `${Math.round(avgDose)} / ${RADIATION.careerLimitMsv} mSv`, tone: m.today?.sep ? 'warn' : null });
  return items;
}
