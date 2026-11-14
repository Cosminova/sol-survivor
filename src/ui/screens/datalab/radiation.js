// Data Lab · Radiation: NASA dose ladder on a log scale, a "how does it compare?" dose explorer, and PIA17601.
import { h, mount } from '../../dom.js';
import { sourceBadge, termButton, meter } from '../../components/common.js';
import { openModal } from '../../components/modal.js';
import { DOSE_LADDER, DOSE_CHART } from '../../../data/doses.js';
import { RADIATION } from '../../../data/constants.js';
import { compareDose } from '../../../engine/dataLab.js';
import { sectionHead, caption, fmtNum } from './shared.js';

const LOG_MIN = Math.log10(0.05);
const LOG_MAX = Math.log10(1000);
const SLIDER_STEPS = 1000;
const SLIDER_LOG = [-2, 3];
const AXIS = [0.1, 1, 10, 100, 1000];
const rung = (id) => DOSE_LADDER.find((d) => d.id === id);

const logPct = (msv) => Math.max(0, Math.min(100, ((Math.log10(Math.max(msv, 1e-3)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100));
const sliderToMsv = (v) => 10 ** (SLIDER_LOG[0] + ((SLIDER_LOG[1] - SLIDER_LOG[0]) * v) / SLIDER_STEPS);
const msvToSlider = (msv) => Math.round(((Math.log10(Math.max(msv, 0.01)) - SLIDER_LOG[0]) / (SLIDER_LOG[1] - SLIDER_LOG[0])) * SLIDER_STEPS);
const fmtMsv = (msv) => (msv >= 10 ? fmtNum(Math.round(msv)) : String(Math.round(msv * 100) / 100));

function missionPresets() {
  const there = rung('mars-transit')?.msv ?? 0;
  const stay = rung('mars-500')?.msv ?? 0;
  return [
    { label: '🔴 1 sol on Mars', msv: rung('mars-sol')?.msv ?? 0.64 },
    { label: '🌕 A week on the Moon', msv: Math.round((rung('moon-day')?.msv ?? 1.37) * 7 * 10) / 10 },
    { label: '☀️ Big storm, no shelter (game)', msv: RADIATION.sepDoseMsv.major },
    { label: '🛰️ 6 months on the ISS', msv: rung('iss-6mo')?.msv ?? 75 },
    { label: '🚀 Whole Mars trip', msv: there * 2 + stay, hint: 'Flight there + 500 days on Mars + flight home' },
  ];
}

function axisRow() {
  return h('div', { class: 'dl-ladder-axis', 'aria-hidden': 'true' },
    AXIS.map((v) => h('span', { style: { left: `${logPct(v)}%` } }, `${fmtNum(v)}`)));
}

function ladderRow(d) {
  return h('li', { class: ['dl-rung', d.id === 'career-limit' && 'dl-rung-limit'], dataset: { msv: String(d.msv) } },
    h('span', { class: 'dl-rung-icon', 'aria-hidden': 'true' }, d.icon),
    h('div', { class: 'dl-rung-body' },
      h('div', { class: 'dl-rung-head' }, h('span', { class: 'dl-rung-label' }, d.label), h('strong', { class: 'dl-rung-msv' }, `${fmtMsv(d.msv)} mSv`)),
      h('div', { class: 'dl-rung-track', 'aria-hidden': 'true' }, h('span', { class: 'dl-rung-bar', style: { '--w': `${logPct(d.msv)}%` } })),
      sourceBadge(d.source, { label: 'Source' })));
}

function ladder() {
  const list = h('ol', { class: 'dl-ladder-rungs', 'aria-label': 'Radiation doses from smallest to largest, in millisieverts' }, DOSE_LADDER.map(ladderRow));
  const card = h('section', { class: 'card dl-dose-ladder', 'aria-labelledby': 'dl-dose-ladder-title' },
    h('h3', { id: 'dl-dose-ladder-title', class: 'dl-h4' }, '🪜 The radiation ladder'),
    h('p', { class: 'faint dl-small' }, 'Log scale: each grid line is 10 times more than the one before, so tiny and huge doses fit on one ladder. The gold line is your dose.'),
    axisRow(),
    list);
  const setDose = (msv) => {
    card.style.setProperty('--you', `${logPct(msv)}%`);
    card.classList.toggle('dl-has-you', msv > 0);
    list.querySelectorAll('.dl-rung').forEach((li) => li.classList.toggle('dl-rung-reached', msv > 0 && Number(li.dataset.msv) <= msv));
  };
  return { node: card, setDose };
}

function comparison(result) {
  const { below, above, careerPct } = result;
  const rungText = (d) => [h('strong', null, `${d.icon} ${d.label}`), ` (${fmtMsv(d.msv)} mSv)`];
  const between = !above
    ? ['🚨 That is more than ', rungText(below), '! A real crew would need thicker shielding or a faster trip.']
    : [below ? ['More than: ', rungText(below), '. '] : 'Smaller than every rung on the ladder. ', 'Less than: ', rungText(above), '.'];
  return h('div', { class: 'stack-sm' },
    h('div', { class: 'dl-dose-hero' }, h('strong', null, fmtMsv(result.msv)), h('span', null, 'millisieverts')),
    h('div', { class: 'dl-dose-nums' },
      h('div', null, h('span', null, '🩻 Chest X-rays'), h('strong', null, fmtNum(result.chestXrays))),
      h('div', null, h('span', null, '🏠 Years of normal US life'), h('strong', null, fmtNum(result.usYears)))),
    h('div', { class: ['dl-dose-career', careerPct >= 100 && 'over'] },
      h('div', { class: 'row between' }, h('span', null, '🛑 Share of NASA’s career limit'), h('strong', null, `${fmtNum(careerPct)}%`)),
      meter(Math.min(careerPct, 100), careerPct >= 100 ? '#ff5d6c' : careerPct >= 50 ? '#fbbf24' : '#4ade80', `${careerPct} percent of the career limit`)),
    h('p', { class: 'dl-dose-between' }, between));
}

function explorer(onDose) {
  const out = h('div', { 'aria-live': 'polite' });
  const number = h('input', { id: 'dl-dose-msv', class: 'input dl-dose-input', type: 'number', min: 0, max: 5000, step: 'any', inputmode: 'decimal' });
  const slider = h('input', { id: 'dl-dose-slider', type: 'range', min: 0, max: SLIDER_STEPS, step: 1, 'aria-label': 'Dose slider, log scale from 0.01 to 1,000 millisieverts' });
  const show = (msv, from) => {
    const result = compareDose(msv);
    if (from !== 'number') number.value = String(Math.round(result.msv * 100) / 100);
    if (from !== 'slider') slider.value = String(msvToSlider(result.msv));
    slider.setAttribute('aria-valuetext', `${fmtMsv(result.msv)} millisieverts`);
    mount(out, comparison(result));
    onDose(result.msv);
  };
  number.addEventListener('input', () => show(Number(number.value), 'number'));
  slider.addEventListener('input', () => show(sliderToMsv(Number(slider.value)), 'slider'));
  show(rung('mars-sol')?.msv ?? 0.64);
  return h('section', { class: 'card dl-dose-explorer', 'aria-labelledby': 'dl-dose-title' },
    h('h3', { id: 'dl-dose-title', class: 'dl-h4' }, '🔍 How does it compare?'),
    h('label', { class: 'field', for: 'dl-dose-msv' }, h('span', null, 'Type a dose in millisieverts (mSv)'), number),
    slider,
    h('div', { class: 'row', role: 'group', 'aria-label': 'Example doses' },
      missionPresets().map((p) => h('button', { type: 'button', class: 'chip', title: p.hint ?? null, onclick: () => show(p.msv) }, p.label))),
    out);
}

function chartFigure() {
  const src = `./images/${encodeURIComponent(DOSE_CHART.file)}`;
  const alt = 'NASA bar chart on a log scale from 0.1 to 1,000 millisieverts. From smallest to largest: a year of cosmic radiation at sea level (about 0.3), the US yearly average from all sources (about 3.6), an abdominal CT scan (about 8), the US Department of Energy yearly limit for radiation workers (20), six months on the ISS (about 75), a 180-day flight to Mars and 500 days on Mars (both a little over 300).';
  const enlarge = () => openModal({
    title: DOSE_CHART.title,
    wide: true,
    content: h('figure', { class: 'dl-lightbox-figure' }, h('img', { src, alt }),
      h('figcaption', { class: 'faint dl-small' }, 'Image: NASA/JPL-Caltech/SwRI (PIA17601). ', sourceBadge(DOSE_CHART.source, { label: 'Source' }))),
  });
  return h('figure', { class: 'card dl-dose-figure' },
    h('button', { type: 'button', class: 'dl-dose-figure-btn', 'aria-label': `Enlarge: ${DOSE_CHART.title}`, onclick: enlarge },
      h('img', { src, alt, loading: 'lazy', decoding: 'async' })),
    h('figcaption', { class: 'stack-sm' },
      h('strong', null, DOSE_CHART.title),
      h('span', { class: 'muted dl-small' }, 'Curiosity’s RAD instrument measured radiation during the whole trip to Mars and on the surface. Scientists used it to estimate an astronaut’s dose for a real Mars mission. Like our ladder, the chart uses a log scale. Tap it to see it bigger.'),
      sourceBadge(DOSE_CHART.source, { label: 'Chart' })));
}

export function renderRadiation(container) {
  const lad = ladder();
  mount(container,
    sectionHead({
      kicker: 'Curiosity RAD · NASA dose data',
      title: 'Radiation Lab',
      intro: 'Space is full of invisible radiation from the Sun and from exploding stars far away. Scientists measure the dose in millisieverts (mSv). How big is a Mars mission compared with an X-ray?',
      tone: 'mars',
    }),
    h('div', { class: 'row dl-terms' },
      h('span', { class: 'faint dl-small' }, 'Words to know:'),
      termButton('sievert', 'millisievert'), termButton('galactic-cosmic-rays', 'cosmic rays'), termButton('sep', 'solar particles'),
      termButton('dose-limit', 'career limit'), termButton('radiation-shielding', 'shielding')),
    h('div', { class: 'dl-split' },
      lad.node,
      h('div', { class: 'stack' }, explorer(lad.setDose), chartFigure())),
    caption('🛡️', 'On Earth, our thick air and magnetic field block most space radiation. Mars has thin air and no global magnetic field, so astronauts need shielding: soil piled on the habitat, water walls, and a storm shelter for solar storms.'));
}
