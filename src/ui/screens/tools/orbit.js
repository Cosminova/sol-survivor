// Earth–Mars distance and radio light delay for any date within ±2 years, with a live orbit diagram.
import { h, s, mount } from '../../dom.js';
import { sourceBadge, termButton } from '../../components/common.js';
import { heliocentric, earthMarsDistanceAU, lightDelaySeconds, sunEarthMarsAngleDeg } from '../../../engine/marsTime.js';
import { toolCard, readout, fmt, fmtDate, minSec, DAY_MS } from './card.js';

const KM_PER_AU = 149.6;
const RANGE_DAYS = 730;
const CONJUNCTION_DEG = 3;
const OPPOSITION_DEG = 172;
const SCALE = 100;

const toSvg = ({ x, y }) => ({ x: x * SCALE, y: -y * SCALE });

function orbitPath(planet, start, periodDays) {
  const steps = 120;
  const pts = Array.from({ length: steps + 1 }, (_, i) => toSvg(heliocentric(planet, new Date(start + (i / steps) * periodDays * DAY_MS))));
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('') + 'Z';
}

function diagram(start) {
  const link = s('line', { class: 'tools-orbit-link' });
  const earth = s('circle', { r: 7, class: 'tools-orbit-earth' });
  const mars = s('circle', { r: 6, class: 'tools-orbit-mars' });
  const earthLabel = s('text', { class: 'tools-orbit-label' }, 'Earth');
  const marsLabel = s('text', { class: 'tools-orbit-label' }, 'Mars');
  const svg = s('svg', { viewBox: '-200 -200 400 400', class: 'tools-orbit', role: 'img', 'aria-label': 'Orbit diagram' },
    s('defs', null, s('radialGradient', { id: 'tools-sun-glow' },
      s('stop', { offset: '0%', 'stop-color': '#fff6c9' }), s('stop', { offset: '45%', 'stop-color': '#ffd166' }), s('stop', { offset: '100%', 'stop-color': 'rgba(255, 209, 102, 0)' }))),
    s('path', { d: orbitPath('mars', start, 687), class: 'tools-orbit-ring tools-orbit-ring-mars' }),
    s('path', { d: orbitPath('earth', start, 365.25), class: 'tools-orbit-ring tools-orbit-ring-earth' }),
    s('circle', { r: 26, fill: 'url(#tools-sun-glow)' }),
    s('circle', { r: 11, class: 'tools-orbit-sun' }),
    link, earth, mars, earthLabel, marsLabel);
  const place = (date, blocked) => {
    const e = toSvg(heliocentric('earth', date));
    const m = toSvg(heliocentric('mars', date));
    [['x1', e.x], ['y1', e.y], ['x2', m.x], ['y2', m.y]].forEach(([k, v]) => link.setAttribute(k, v.toFixed(1)));
    link.classList.toggle('blocked', blocked);
    earth.setAttribute('cx', e.x.toFixed(1)); earth.setAttribute('cy', e.y.toFixed(1));
    mars.setAttribute('cx', m.x.toFixed(1)); mars.setAttribute('cy', m.y.toFixed(1));
    earthLabel.setAttribute('x', (e.x + 10).toFixed(1)); earthLabel.setAttribute('y', (e.y - 10).toFixed(1));
    marsLabel.setAttribute('x', (m.x + 10).toFixed(1)); marsLabel.setAttribute('y', (m.y - 10).toFixed(1));
    svg.setAttribute('aria-label', `Orbit diagram for ${fmtDate(date)}: the Sun in the middle, Earth on the inner ring and Mars on the outer ring, joined by the radio signal line${blocked ? ', which passes behind the Sun' : ''}.`);
  };
  return { svg, place };
}

// Scan the slider range once for the closest approach and solar conjunctions.
function findEvents(today) {
  const days = Array.from({ length: RANGE_DAYS * 2 + 1 }, (_, i) => i - RANGE_DAYS);
  const samples = days.map((d) => {
    const date = new Date(today + d * DAY_MS);
    return { d, au: earthMarsDistanceAU(date), angle: sunEarthMarsAngleDeg(date) };
  });
  const closest = samples.reduce((a, b) => (b.au < a.au ? b : a));
  const conj = samples.filter((x, i) => i > 0 && i < samples.length - 1 && x.angle < 10
    && x.angle < samples[i - 1].angle && x.angle <= samples[i + 1].angle);
  return { closest: closest.d, conjunctions: conj.map((x) => x.d) };
}

function statusBadge(angle) {
  if (angle < CONJUNCTION_DEG) return h('span', { class: 'badge danger' }, '🚫 Solar conjunction: the Sun blocks radio! Mission control stops sending commands.');
  if (angle < 10) return h('span', { class: 'badge warn' }, '⚠️ Close to the Sun in the sky: radio signals get noisy.');
  if (angle > OPPOSITION_DEG) return h('span', { class: 'badge good' }, '🎯 Opposition: Mars is opposite the Sun and close to Earth.');
  return h('span', { class: 'badge' }, '📡 Clear line of sight for radio.');
}

export function orbitCard() {
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 12);
  const view = diagram(today);
  const events = findEvents(today);
  const out = h('div', { class: 'tools-orbit-out', 'aria-live': 'polite' });
  const dateLabel = h('output', { class: 'tools-mono', for: 'tools-orbit-days' });

  const update = (offset) => {
    const date = new Date(today + offset * DAY_MS);
    const au = earthMarsDistanceAU(date);
    const delay = lightDelaySeconds(date);
    const angle = sunEarthMarsAngleDeg(date);
    view.place(date, angle < CONJUNCTION_DEG);
    dateLabel.textContent = offset === 0 ? `${fmtDate(date)} (today)` : `${fmtDate(date)} (${offset > 0 ? '+' : ''}${offset} days)`;
    mount(out,
      h('div', { class: 'tools-readouts' },
        readout('Distance', `${fmt(au, 3)} AU`, { tone: 'cyan' }),
        readout('In kilometres', `${fmt(au * KM_PER_AU, 1)} million km`),
        readout('Radio delay, one way', minSec(delay), { tone: 'gold' }),
        readout('Round trip (ask + answer)', minSec(delay * 2)),
        readout('Sun–Earth–Mars angle', `${fmt(angle, 1)}°`)),
      statusBadge(angle));
  };

  const slider = h('input', {
    type: 'range', id: 'tools-orbit-days', min: -RANGE_DAYS, max: RANGE_DAYS, step: 1, value: 0,
    'aria-describedby': 'tools-orbit-hint',
    oninput: (e) => update(Number(e.target.value)),
  });
  const jump = (offset) => { slider.value = String(offset); update(offset); };
  const nextConj = events.conjunctions.find((d) => d > 0) ?? events.conjunctions[events.conjunctions.length - 1];
  update(0);

  return toolCard({
    id: 'tools-orbit', icon: '🛰️', kicker: 'Distance & light delay', title: 'How far is Mars today?', wide: true,
    footer: [termButton('light-delay', 'light delay'), termButton('solar-conjunction', 'solar conjunction'), termButton('orbit', 'orbit'), sourceBadge('jpl-elements', { label: 'Math' })],
    children: h('div', { class: 'tools-orbit-layout' },
      h('figure', { class: 'tools-orbit-fig' }, view.svg,
        h('figcaption', { class: 'faint tools-small' }, 'View from above the Sun. Planets move counter-clockwise. Not to scale for planet sizes.')),
      h('div', { class: 'stack-sm' },
        h('label', { class: 'field', for: 'tools-orbit-days' }, h('span', null, 'Pick a date (2 years back to 2 years ahead)')),
        slider,
        h('p', { id: 'tools-orbit-hint', class: 'tools-small' }, 'Date: ', dateLabel),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => jump(0) }, '📍 Today'),
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => jump(events.closest) }, '🤏 Closest approach'),
          nextConj != null ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => jump(nextConj) }, '☀️ Solar conjunction') : null),
        out,
        h('p', { class: 'muted tools-small' }, 'Radio waves travel at the speed of light, but Mars is so far away that a “Hello!” takes minutes to arrive. Rovers must drive themselves between messages.'))),
  });
}
