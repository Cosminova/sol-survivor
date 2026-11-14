// Live Mars clock card: MTC, Ls + season, Mars Year, and today's sol for Curiosity & Perseverance.
import { h } from '../dom.js';
import { marsTime, missionSol, MISSIONS, seasonName, formatHours, lightDelaySeconds } from '../../engine/marsTime.js';
import { termButton } from './common.js';

function readings(now) {
  const t = marsTime(now);
  const delay = lightDelaySeconds(now);
  return {
    mtc: formatHours(t.mtcHours),
    msd: Math.floor(t.msd).toLocaleString(),
    ls: `${t.ls.toFixed(1)}°`,
    season: `Northern ${seasonName(t.ls).toLowerCase()}`,
    year: `MY ${t.marsYear}`,
    curiosity: `Sol ${missionSol(now, MISSIONS.curiosity.landing, MISSIONS.curiosity.lon).toLocaleString()}`,
    perseverance: `Sol ${missionSol(now, MISSIONS.perseverance.landing, MISSIONS.perseverance.lon).toLocaleString()}`,
    delay: `${Math.floor(delay / 60)} min ${Math.round(delay % 60)} s`,
  };
}

const FIELDS = [
  ['mtc', 'Mars time (MTC)', 'mtc'],
  ['ls', 'Season angle (Ls)', 'solar-longitude'],
  ['season', 'Season', null],
  ['year', 'Mars Year', 'mars-year'],
  ['curiosity', 'Curiosity today', 'sol'],
  ['perseverance', 'Perseverance today', 'sol'],
  ['delay', 'Radio delay to Mars', 'light-delay'],
  ['msd', 'Mars Sol Date', 'msd'],
];

export function marsClock() {
  const values = {};
  const grid = h('dl', { class: 'clock-grid' }, FIELDS.map(([key, label, term]) => h('div', { class: ['clock-cell', key === 'mtc' && 'clock-main'] },
    h('dt', null, term ? termButton(term, label) : label),
    h('dd', { class: 'mono', ref: (el) => { values[key] = el; } }, '—'))));
  const tick = () => {
    const r = readings(new Date());
    for (const [key] of FIELDS) values[key].textContent = r[key];
  };
  tick();
  const id = setInterval(tick, 1000);
  const el = h('section', { class: 'panel clock-card', 'aria-label': 'Live Mars clock' },
    h('h2', { class: 'panel-title mars' }, 'Live Mars Clock', h('span', { class: 'spacer' }), h('span', { class: 'live-dot', 'aria-hidden': 'true' }), h('span', { class: 'badge mars' }, 'LIVE')),
    grid);
  return { el, stop: () => clearInterval(id) };
}
