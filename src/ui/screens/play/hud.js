// Mission header (day progress, weather, radio delay, science) and scene overlays (alerts, end of mission).
// Cadet view shows plain-word chips and tucks the exact numbers into "More details"; Expert view shows them all.
import { h } from '../../dom.js';
import { seasonName, lightDelaySeconds } from '../../../engine/marsTime.js';
import { MOON } from '../../../data/constants.js';
import { termButton } from '../../components/common.js';
import { icon } from '../../icons.js';
import { statusBadge } from './status.js';
import { isExpertView, moreDetails, realDataLabel, viewSwitch } from '../../kid/view.js';
import { howToPlayButton } from '../../kid/howToPlay.js';
import { skyWord, delayWords, dayWord, niceDate, lossMessage, LOSS_TITLE, LOSS_CHEER } from '../../kid/words.js';

const ic = (name) => icon(name, { size: 16 });

const fmtDelay = (s) => (s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);
const radioDelay = (m) => (m.config.body === 'mars' ? lightDelaySeconds(new Date(m.env.dateMs)) : MOON.lightSeconds);

// Every number, with a tappable explanation for each science word.
function expertChips(m) {
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
    chips.push(h('span', { class: 'hud-chip' }, ic('pressure'), termButton('atmospheric-pressure', '0 Pa (no air)')));
  }
  const blackout = m.modifiers?.blackout > 0;
  chips.push(h('span', { class: ['hud-chip', blackout && 'warn'] }, ic('antenna'), termButton(blackout ? 'solar-conjunction' : 'light-delay', blackout ? `No contact ${m.modifiers.blackout} sols` : `Earth ${fmtDelay(radioDelay(m))} away`)));
  return chips;
}

// The same facts in plain words. Tapping a chip explains the science word behind it.
export function cadetChips(m) {
  const e = m.env;
  const unit = dayWord(m.config.body, { plural: true });
  const chips = [];
  if (m.config.body === 'mars') {
    chips.push(h('span', { class: ['hud-chip', (e.storm || e.tau >= 2) && 'warn'] }, ic('wind'), termButton('tau', skyWord(e, m)), e.storm ? ` for ${e.storm.solsLeft} more ${unit}` : ''));
    chips.push(h('span', { class: 'hud-chip' }, ic('thermometer'), `${e.minC}° to ${e.maxC}°C outside`));
    chips.push(h('span', { class: 'hud-chip' }, ic('orbit'), termButton('solar-longitude', `Season: ${seasonName(e.ls, m.site.lat >= 0)}`)));
  } else {
    chips.push(h('span', { class: ['hud-chip', !e.lit && 'warn'] }, ic(e.lit ? 'sun' : 'moon'), termButton(e.lit ? 'lunar-day' : 'lunar-night', e.lit ? 'The Sun is up' : 'Night: no sunlight')));
    chips.push(h('span', { class: 'hud-chip' }, ic('thermometer'), `${e.avgC}°C outside`));
  }
  const blackout = m.modifiers?.blackout > 0;
  chips.push(h('span', { class: ['hud-chip', blackout && 'warn'] }, ic('antenna'),
    termButton(blackout ? 'solar-conjunction' : 'light-delay', blackout ? `No radio to Earth for ${m.modifiers.blackout} ${unit}` : `Radio to Earth takes ${delayWords(radioDelay(m))}`)));
  return chips;
}

// REMS weather is replayed from the Curiosity archive: say so, with the date it was recorded.
export const weatherSource = (m) => (m.env.reference && m.config.body === 'mars'
  ? realDataLabel(m.env.reference.earthDate, 'rems', 'Weather')
  : null);

export function hud(m, { onNext, onRun, busy, fc }) {
  const pct = Math.min(100, (100 * m.sol) / m.config.targetSols);
  const sciPct = Math.min(100, (100 * m.science) / m.config.scienceGoal);
  const active = m.status === 'active';
  const mars = m.config.body === 'mars';
  const expert = isExpertView();
  const date = new Date(m.env.dateMs).toISOString().slice(0, 10);
  const unit = dayWord(m.config.body, { plural: true });
  const idLine = `Earth date ${date} · code ${m.code}`;
  return h('header', { class: ['play-hud', m.config.body, expert ? 'is-expert' : 'is-cadet'] },
    h('div', { class: 'hud-title' },
      h('span', { class: ['kicker', mars && 'mars'] }, m.config.chapter ? `Chapter ${m.config.chapter} · ${m.site.name}` : `Free Play · ${m.site.name}`),
      h('h1', null, m.config.title),
      expert ? h('span', { class: 'faint mono hud-date' }, idLine) : null),
    h('div', { class: 'hud-progress' },
      h('div', { class: 'hud-sol' },
        icon('reticle', { size: 22 }),
        h('span', { class: 'hud-sol-label' }, mars ? 'Sol' : 'Day'),
        h('span', { class: 'hud-sol-num mono' }, m.sol), h('span', { class: 'hud-sol-of' }, expert ? ` / ${m.config.targetSols} ${unit}` : ` of ${m.config.targetSols}`), ' ',
        mars ? termButton('sol', expert ? 'Sol?' : 'A sol is a Mars day') : (expert ? termButton('lunar-day', 'Day?') : null)),
      h('div', { class: 'meter hud-meter', role: 'progressbar', 'aria-label': 'Mission progress', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100, style: { '--pct': `${pct}%`, '--meter-color': 'var(--cyan)' } }, h('span')),
      h('div', { class: 'hud-sci' }, h('span', { class: 'hud-sci-label' }, ic('flask'), expert ? `Science ${Math.round(m.science)} / ${m.config.scienceGoal}` : `Science points: ${Math.round(m.science)} of ${m.config.scienceGoal}`),
        h('div', { class: 'meter', role: 'progressbar', 'aria-label': 'Science goal progress', 'aria-valuenow': Math.round(sciPct), 'aria-valuemin': 0, 'aria-valuemax': 100, style: { '--pct': `${sciPct}%`, '--meter-color': 'var(--violet)' } }, h('span')))),
    h('div', { class: 'hud-status' }, h('span', { class: 'hud-status-label' }, 'Mission status'), statusBadge(m, fc)),
    h('div', { class: 'hud-actions' },
      h('button', { type: 'button', id: 'next-sol', class: 'btn btn-primary btn-lg btn-caps hud-next', disabled: !active || busy, onclick: onNext, 'aria-keyshortcuts': 'N' }, icon('play', { size: 18 }), active ? `Next ${mars && expert ? 'Sol' : 'Day'}` : 'Mission over'),
      h('button', { type: 'button', id: 'run-sols', class: 'btn btn-sm', disabled: !active || busy, onclick: onRun, title: `Plays up to 5 ${unit} in a row. It stops if something happens.` }, icon('fast-forward', { size: 16 }), expert ? 'Run 5' : `Skip 5 ${unit}`)),
    h('div', { class: 'hud-env' },
      expert ? expertChips(m) : cadetChips(m),
      expert ? null : moreDetails('hud', 'More details',
        h('div', { class: 'hud-env hud-env-more' }, expertChips(m)),
        h('p', { class: 'faint mono hud-date' }, idLine)),
      h('span', { class: 'hud-tools' }, howToPlayButton({ className: 'btn btn-sm btn-ghost' }), viewSwitch())),
    weatherSource(m) ? h('div', { class: 'hud-extra' }, weatherSource(m)) : null);
}

export function sceneOverlay(m, { onDebrief, training = false }) {
  const items = [];
  const expert = isExpertView();
  if (m.today?.sep) {
    items.push(h('div', { class: 'scene-alert sep', role: 'alert' }, ic('alert'), h('strong', null, 'Solar radiation storm! '), realDataLabel(m.today.sep.time, 'donki')));
  }
  if (m.today?.shelter) items.push(h('div', { class: 'scene-alert shelter' }, ic('shield'), m.today.shelter === true ? 'Crew is safe in the storm shelter' : 'Crew is hiding behind the water tanks'));
  if (m.env.storm) items.push(h('div', { class: 'scene-alert storm' }, ic('wind'), expert ? `Dust storm · τ ${m.env.tau}` : 'Dust storm: solar panels make less power'));
  // Cadet view keeps the outpost clear: the weather source line lives in the Mission details drawer.
  const ref = expert && m.env.reference && m.config.body === 'mars'
    ? h('div', { class: 'scene-ref' }, realDataLabel(m.env.reference.earthDate, 'rems', `Weather from the Curiosity rover, sol ${m.env.reference.sol}`))
    : null;
  const won = m.status === 'won';
  const end = m.status !== 'active' && !training
    ? h('div', { class: ['scene-end', m.status] },
      h('span', { class: 'scene-end-kicker' }, icon('status', { size: 18 }), 'End of mission'),
      h('p', { class: 'scene-end-title' }, won ? 'Mission complete!' : LOSS_TITLE),
      won ? null : h('p', { class: 'scene-end-why' }, lossMessage(m)),
      won ? null : h('p', { class: 'scene-end-cheer' }, LOSS_CHEER),
      h('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: onDebrief, 'data-autofocus': true }, won ? 'See how you did' : 'See what to try next', icon('arrow-right', { size: 18 })))
    : null;
  return h('div', { class: 'scene-overlay' }, h('div', { class: 'scene-alerts' }, items), ref, end);
}
