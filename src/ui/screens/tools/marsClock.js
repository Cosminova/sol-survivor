// Live Mars clock: Coordinated Mars Time, Mars Sol Date, season (Ls) and today's rover sols.
import { h, s } from '../../dom.js';
import { sourceBadge, termButton } from '../../components/common.js';
import { marsTime, missionSol, localSolarHours, seasonName, formatHours, MISSIONS } from '../../../engine/marsTime.js';
import { toolCard, readout, fmt } from './card.js';

const RING_R = 46;
const DUST = [180, 330];

function polar(lsDeg, r = RING_R) {
  const a = ((lsDeg - 90) * Math.PI) / 180;
  return { x: 60 + r * Math.cos(a), y: 60 + r * Math.sin(a) };
}

function arc(from, to, r = RING_R) {
  const p0 = polar(from, r);
  const p1 = polar(to, r);
  return `M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
}

function seasonRing() {
  const dot = s('circle', { r: 6, class: 'tools-ring-dot' });
  const labels = [[0, 'Spring'], [90, 'Summer'], [180, 'Autumn'], [270, 'Winter']].map(([ls, label]) => {
    const p = polar(ls + 45, 30);
    return s('text', { x: p.x, y: p.y + 3, 'text-anchor': 'middle', class: 'tools-ring-label' }, label);
  });
  const ticks = [0, 90, 180, 270].map((ls) => {
    const a = polar(ls, RING_R - 6);
    const b = polar(ls, RING_R + 6);
    return s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'tools-ring-tick' });
  });
  const svg = s('svg', { viewBox: '0 0 120 120', class: 'tools-ring', role: 'img', 'aria-label': 'Mars year ring' },
    s('circle', { cx: 60, cy: 60, r: RING_R, class: 'tools-ring-track' }),
    s('path', { d: arc(DUST[0], DUST[1]), class: 'tools-ring-dust' }),
    ticks, labels, dot);
  const place = (ls) => {
    const p = polar(ls);
    dot.setAttribute('cx', p.x.toFixed(2));
    dot.setAttribute('cy', p.y.toFixed(2));
    svg.setAttribute('aria-label', `Mars year ring: today is Ls ${Math.round(ls)} degrees, northern ${seasonName(ls, true).toLowerCase()}. The orange arc is dust storm season.`);
  };
  return { svg, place };
}

function roverRow(mission) {
  const sol = h('span');
  const time = h('span');
  const sky = h('span', { 'aria-hidden': 'true' });
  const node = h('li', { class: 'tools-rover' },
    h('span', { class: 'tools-rover-sky' }, sky),
    h('div', null, h('strong', null, mission.name), h('span', { class: 'faint tools-small' }, ` · ${mission.site}`)),
    h('div', { class: 'tools-rover-nums' },
      h('span', null, 'Sol ', h('b', null, sol)),
      h('span', null, 'Local time ', h('b', { class: 'tools-mono' }, time))));
  const update = (now) => {
    const local = localSolarHours(now, mission.lon);
    sol.textContent = fmt(missionSol(now, mission.landing, mission.lon));
    time.textContent = formatHours(local).slice(0, 5);
    sky.textContent = local >= 6 && local < 18 ? '☀️' : '🌙';
    node.title = local >= 6 && local < 18 ? 'Daytime at the rover' : 'Night-time at the rover';
  };
  return { node, update };
}

export function marsClockCard() {
  const mtc = h('span', { class: 'tools-mono' });
  const msd = h('span', { class: 'tools-mono' });
  const ls = h('span');
  const year = h('span');
  const north = h('span');
  const south = h('span');
  const ring = seasonRing();
  const rovers = [MISSIONS.curiosity, MISSIONS.perseverance].map(roverRow);

  const tick = () => {
    const now = new Date();
    const t = marsTime(now);
    mtc.textContent = formatHours(t.mtcHours);
    msd.textContent = fmt(t.msd, 4);
    ls.textContent = `${t.ls.toFixed(1)}°`;
    year.textContent = String(t.marsYear);
    north.textContent = seasonName(t.ls, true);
    south.textContent = seasonName(t.ls, false);
    ring.place(t.ls);
    rovers.forEach((r) => r.update(now));
  };
  tick();
  const timer = setInterval(tick, 1000);

  const node = toolCard({
    id: 'tools-clock', icon: '🕰️', kicker: 'Live · updates every second', title: 'Mars Clock', tone: 'mars', wide: true,
    footer: [termButton('mtc', 'MTC'), termButton('msd', 'Mars Sol Date'), termButton('solar-longitude', 'Ls'), termButton('mars-year', 'Mars Year'), termButton('lmst', 'local solar time'), sourceBadge('mars24', { label: 'Math' })],
    children: h('div', { class: 'tools-clock' },
      h('div', { class: 'tools-clock-main' },
        readout('Coordinated Mars Time (Mars’s “UTC”)', mtc, { big: true, tone: 'mars' }),
        h('div', { class: 'tools-readouts' },
          readout('Mars Sol Date', msd),
          readout('Mars Year', year),
          readout('Season angle (Ls)', ls),
          readout('Northern season', north),
          readout('Southern season', south)),
        h('ul', { class: 'tools-rovers', 'aria-label': 'Rover mission sols today' }, rovers.map((r) => r.node))),
      h('figure', { class: 'tools-ring-wrap' }, ring.svg,
        h('figcaption', { class: 'faint tools-small' }, 'Where Mars is in its year (northern seasons). Orange = dust storm season.'))),
  });
  return { node, cleanup: () => clearInterval(timer) };
}
