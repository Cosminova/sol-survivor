// Mission header (sol progress, weather, light delay, science) and scene overlays (alerts, end of mission).
import { h } from '../../dom.js';
import { seasonName, lightDelaySeconds } from '../../../engine/marsTime.js';
import { MOON } from '../../../data/constants.js';
import { termButton, sourceBadge } from '../../components/common.js';
import { icon } from '../../icons.js';
import { statusBadge } from './status.js';

const ic = (name) => icon(name, { size: 16 });

const fmtDelay = (s) => (s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

function envChips(m) {
  const e = m.env;
  const chips = [];
  if (m.config.body === 'mars') {
    chips.push(h('span', { class: 'hud-chip' }, ic('orbit'), termButton('solar-longitude', `Ls ${Math.round(e.ls)}°`), ` ${seasonName(e.ls, m.site.lat >= 0)}`));
    chips.push(h('span', { class: ['hud-chip', e.tau >= 2 && 'warn'] }, ic('wind'), termButton('tau', `Dust τ ${e.tau}`), e.storm ? ` · storm ${e.storm.solsLeft} sols` : ''));
    chips.push(h('span', { class: 'hud-chip' }, ic('thermometer'), `${e.minC}° to ${e.maxC}°C`));
    chips.push(h('span', { class: 'hud-chip' }, ic('pressure'), termButton('atmospheric-pressure', `${e.pressurePa} Pa`)));
  } else {
    chips.push(h('span', { class: ['hud-chip', !e.lit && 'warn'] }, ic(e.lit ? 'sun' : 'moon'), termButton(e.lit ? 'lunar-day' : 'lunar-night', e.lit ? 'Lunar day' : 'Lunar night')));
    chips.push(h('span', { class: 'hud-chip' }, ic('thermometer'), `${e.avgC}°C`));
    chips.push(h('span', { class: 'hud-chip' }, ic('pressure'), 'No air'));
  }
  const delay = m.config.body === 'mars' ? lightDelaySeconds(new Date(e.dateMs)) : MOON.lightSeconds;
  const blackout = m.modifiers?.blackout > 0;
  chips.push(h('span', { class: ['hud-chip', blackout && 'warn'] }, ic('antenna'), termButton(blackout ? 'solar-conjunction' : 'light-delay', blackout ? `No contact ${m.modifiers.blackout} sols` : `Earth ${fmtDelay(delay)} away`)));
  return chips;
}

export function hud(m, { onNext, onRun, busy, fc }) {
  const pct = Math.min(100, (100 * m.sol) / m.config.targetSols);
  const sciPct = Math.min(100, (100 * m.science) / m.config.scienceGoal);
  const active = m.status === 'active';
  const date = new Date(m.env.dateMs).toISOString().slice(0, 10);
  return h('header', { class: ['play-hud', m.config.body] },
    h('div', { class: 'hud-title' },
      h('span', { class: ['kicker', m.config.body === 'mars' && 'mars'] }, m.config.chapter ? `Chapter ${m.config.chapter} · ${m.site.name}` : `Free Play · ${m.site.name}`),
      h('h1', null, m.config.title),
      h('span', { class: 'faint mono hud-date' }, `Earth date ${date} · code ${m.code}`)),
    h('div', { class: 'hud-progress' },
      h('div', { class: 'hud-sol' },
        icon('reticle', { size: 22 }),
        h('span', { class: 'hud-sol-label' }, m.config.body === 'mars' ? 'Sol' : 'Day'),
        h('span', { class: 'hud-sol-num mono' }, m.sol), h('span', { class: 'faint' }, ` / ${m.config.targetSols} ${m.config.body === 'mars' ? 'sols' : 'days'}`), ' ', termButton(m.config.body === 'mars' ? 'sol' : 'lunar-day', '?')),
      h('div', { class: 'meter hud-meter', role: 'progressbar', 'aria-label': 'Mission progress', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100, style: { '--pct': `${pct}%`, '--meter-color': 'var(--cyan)' } }, h('span')),
      h('div', { class: 'hud-sci' }, h('span', { class: 'hud-sci-label' }, ic('flask'), `Science ${Math.round(m.science)} / ${m.config.scienceGoal}`),
        h('div', { class: 'meter', role: 'progressbar', 'aria-label': 'Science goal progress', 'aria-valuenow': Math.round(sciPct), 'aria-valuemin': 0, 'aria-valuemax': 100, style: { '--pct': `${sciPct}%`, '--meter-color': 'var(--violet)' } }, h('span')))),
    h('div', { class: 'hud-status' }, h('span', { class: 'hud-status-label' }, 'Mission status'), statusBadge(m, fc)),
    h('div', { class: 'hud-actions' },
      h('button', { type: 'button', id: 'next-sol', class: 'btn btn-primary btn-lg hud-next', disabled: !active || busy, onclick: onNext, 'aria-keyshortcuts': 'N' }, icon('play', { size: 18 }), active ? `Next ${m.config.body === 'mars' ? 'Sol' : 'Day'} ▶` : 'Mission over'),
      h('button', { type: 'button', id: 'run-sols', class: 'btn btn-sm', disabled: !active || busy, onclick: onRun, title: 'Runs up to 5 sols, stopping for any event' }, icon('fast-forward', { size: 16 }), '⏩ Run 5')),
    h('div', { class: 'hud-env' }, envChips(m)));
}

export function sceneOverlay(m, { onDebrief }) {
  const items = [];
  if (m.today?.sep) {
    items.push(h('div', { class: 'scene-alert sep', role: 'alert' }, ic('alert'), '☢️ Solar radiation storm! ', h('span', { class: 'faint' }, `Real ${new Date(m.today.sep.time).toISOString().slice(0, 10)} event from NASA DONKI`)));
  }
  if (m.today?.shelter) items.push(h('div', { class: 'scene-alert shelter' }, ic('shield'), m.today.shelter === true ? '🛡️ Crew in the storm shelter' : '🛡️ Crew behind the water tanks'));
  if (m.env.storm) items.push(h('div', { class: 'scene-alert storm' }, ic('wind'), `🌪️ Dust storm · τ ${m.env.tau}`));
  const ref = m.env.reference && m.config.body === 'mars'
    ? h('div', { class: 'scene-ref' }, `Weather from Curiosity REMS, sol ${m.env.reference.sol} (${m.env.reference.earthDate})`, ' ', sourceBadge('rems', { label: 'Data' }))
    : null;
  const end = m.status !== 'active'
    ? h('div', { class: ['scene-end', m.status] },
      h('span', { class: 'scene-end-kicker' }, icon('status', { size: 18 }), 'End of mission'),
      h('p', { class: 'scene-end-title' }, m.status === 'won' ? '🏁 Mission complete!' : '🚨 Mission aborted'),
      h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: onDebrief, 'data-autofocus': true }, 'See your debrief ▶', icon('arrow-right', { size: 18 })))
    : null;
  return h('div', { class: 'scene-overlay' }, h('div', { class: 'scene-alerts' }, items), ref, end);
}
