// Debrief building blocks: score breakdown, lessons, radiation comparison, history charts, badges, certificate.
import { h } from '../../dom.js';
import { icon, MODULE_ICONS, SUPPLY_ICONS } from '../../icons.js';
import { lineChart } from '../../charts.js';
import { stars, sourceBadge, termButton } from '../../components/common.js';
import { compareDose } from '../../../engine/dataLab.js';
import { RADIATION } from '../../../data/constants.js';
import { logo } from '../../logo.js';
import { isExpertView } from '../../kid/view.js';
import { plainify, dayKey, daysText, dayWord } from '../../kid/words.js';

const PARTS = [
  { key: 'survival', icon: '🫁', label: 'Survival', max: 400, color: 'var(--cyan)', tip: 'How many of the planned days the crew lasted.' },
  { key: 'science', icon: '🔬', label: 'Science', max: 250, color: 'var(--violet)', tip: 'How close you got to the science goal.' },
  { key: 'health', icon: '❤️', label: 'Crew health', max: 150, color: 'var(--good)', tip: 'Average crew health at the end.' },
  { key: 'morale', icon: '🙂', label: 'Morale', max: 50, color: 'var(--gold)', tip: 'Happy crews work better.' },
  { key: 'radiation', icon: '☢️', label: 'Radiation safety', max: 150, color: 'var(--rad)', tip: 'Staying under the limit and blocking dose with shielding.' },
];

export function scoreBreakdown(score) {
  return h('section', { class: 'panel db-score', 'aria-label': 'Score breakdown' },
    h('h2', { class: 'panel-title' }, 'Score breakdown'),
    h('ul', { class: 'db-bars' }, PARTS.map((p) => {
      const v = score.breakdown[p.key] ?? 0;
      return h('li', { class: 'db-bar', title: p.tip },
        h('span', { class: 'db-bar-label' }, h('span', { 'aria-hidden': 'true' }, `${p.icon} `), p.label),
        h('span', { class: 'db-bar-track', role: 'meter', 'aria-label': `${p.label} ${v} of ${p.max} points`, 'aria-valuemin': 0, 'aria-valuemax': p.max, 'aria-valuenow': v },
          h('span', { style: { width: `${Math.min(100, (100 * v) / p.max)}%`, background: p.color } })),
        h('span', { class: 'db-bar-num mono' }, `${v}`, h('small', null, ` / ${p.max}`)));
    })),
    h('p', { class: 'db-star-rules faint' }, 'How to earn 3 stars: finish the mission, reach the science goal, and keep the crew healthy (health 70 or more, radiation under the limit).'));
}

// Cadet view reads the engine's lessons through the kid words layer (same facts and numbers, plainer words).
export function lessonsPanel(report, body = 'mars') {
  const say = (t) => (isExpertView() ? daysText(t, body) : plainify(t, body));
  const list = (items, cls, empty) => (items.length
    ? h('ul', { class: ['db-list', cls] }, items.map((t) => h('li', null, say(t))))
    : h('p', { class: 'faint' }, empty));
  return h('section', { class: 'db-lessons' },
    h('div', { class: 'panel db-went' },
      h('h2', { class: 'panel-title' }, '✅ What went well'),
      list(report.went, 'good', 'You survived the landing. Every mission teaches something!')),
    h('div', { class: 'panel db-improve' },
      h('h2', { class: 'panel-title' }, 'Try next time'),
      list(report.improve, 'warn', 'Nothing to fix. A perfect mission, Commander!')));
}

export function radiationPanel(report, mission) {
  const dose = report.score.surfaceDose;
  const c = compareDose(dose);
  const rung = (d, label) => (d ? h('li', { class: 'db-rung' },
    h('span', { class: 'db-rung-icon', 'aria-hidden': 'true' }, d.icon),
    h('span', null, h('span', { class: 'faint' }, `${label}: `), d.label, h('strong', { class: 'mono' }, ` ${d.msv} mSv`))) : null);
  return h('section', { class: 'panel db-rad', 'aria-label': 'Radiation report' },
    h('h2', { class: 'panel-title mars' }, '☢️ Radiation report', h('span', { class: 'spacer' }), termButton('sievert', 'What is a millisievert?')),
    h('p', null, isExpertView() ? daysText(report.radiation, dayKey(mission.config)) : plainify(report.radiation, dayKey(mission.config))),
    h('div', { class: 'db-rad-stats' },
      h('div', { class: 'db-stat' }, h('span', { class: 'db-stat-num mono' }, c.msv.toFixed(1)), h('span', null, 'mSv each')),
      h('div', { class: 'db-stat' }, h('span', { class: 'db-stat-num mono' }, c.chestXrays.toLocaleString()), h('span', null, 'chest X-rays')),
      h('div', { class: 'db-stat' }, h('span', { class: 'db-stat-num mono' }, c.usYears), h('span', null, 'years of normal life in the US')),
      h('div', { class: 'db-stat' }, h('span', { class: 'db-stat-num mono' }, `${c.careerPct}%`), h('span', null, 'of the career limit'))),
    h('div', { class: 'meter db-career', role: 'meter', 'aria-label': `Dose is ${c.careerPct}% of NASA's ${RADIATION.careerLimitMsv} mSv career limit`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.min(100, c.careerPct), style: { '--pct': `${Math.min(100, c.careerPct)}%`, '--meter-color': 'var(--rad)' } }, h('span')),
    h('ul', { class: 'db-rungs' }, rung(c.below, 'More than'), rung(c.above, 'Less than')),
    h('div', { class: 'row' },
      mission.config.body === 'mars' ? sourceBadge('rad-2014', { label: 'Curiosity RAD' }) : sourceBadge('lnd-2020', { label: 'Chang’e 4 LND' }),
      h('a', { class: 'chip', href: '#/datalab?tab=radiation' }, '📊 See the dose ladder')));
}

const pts = (hist, key) => hist.map((x) => ({ x: x.sol, y: x[key] }));

export function historyCharts(mission) {
  const hist = mission.history ?? [];
  if (hist.length < 2) {
    return h('section', { class: 'panel db-charts' }, h('h2', { class: 'panel-title' }, 'Mission charts'),
      h('p', { class: 'faint' }, 'The mission was too short to draw charts. Next time you will get further!'));
  }
  const unit = dayWord(dayKey(mission.config), { cap: true });
  const common = { xLabel: unit, xFormat: (v) => String(Math.round(v)), width: 560, height: 230, yZero: true };
  return h('section', { class: 'panel db-charts', 'aria-label': 'Mission telemetry charts' },
    h('h2', { class: 'panel-title' }, 'Mission charts'),
    h('div', { class: 'db-chart-grid' },
      lineChart({ ...common, title: 'Supplies over time', yLabel: 'kg',
        desc: 'Oxygen, water and food remaining at the end of each sol.',
        series: [
          { label: 'Oxygen', color: '#7dd3fc', values: pts(hist, 'o2') },
          { label: 'Water', color: '#60a5fa', values: pts(hist, 'water') },
          { label: 'Food', color: '#a3e635', values: pts(hist, 'food') },
        ] }),
      lineChart({ ...common, title: 'Power made vs used', yLabel: 'kWh',
        desc: 'Energy generated and demanded each sol, plus the battery level.',
        series: [
          { label: 'Made', color: '#fde047', values: pts(hist, 'generated') },
          { label: 'Used', color: '#4fe3ff', values: pts(hist, 'demand') },
          { label: 'Battery', color: '#c5d2de', values: pts(hist, 'battery'), dashed: true },
        ] }),
      lineChart({ ...common, title: 'Crew health and morale', yLabel: '%', yDomain: [0, 100],
        desc: 'Average crew health and morale each sol.',
        series: [
          { label: 'Health', color: '#4ade80', values: pts(hist, 'health') },
          { label: 'Morale', color: '#ffd166', values: pts(hist, 'morale') },
        ] }),
      lineChart({ ...common, title: 'Radiation dose', yLabel: 'mSv',
        desc: 'Average surface radiation dose per astronaut, adding up over the mission.',
        series: [{ label: 'Total dose', color: '#f472b6', values: pts(hist, 'dose'), area: true }] })));
}

export function badgesPanel(badges) {
  if (!badges?.length) return null;
  return h('section', { class: 'panel db-badges', 'aria-label': 'New badges' },
    h('h2', { class: 'panel-title' }, '🏅 New badges earned!'),
    h('ul', { class: 'db-badge-list' }, badges.map((b, i) => h('li', { class: 'db-badge', style: { '--i': i } },
      h('span', { class: 'db-badge-icon', 'aria-hidden': 'true' }, icon('award', { size: 30 })),
      h('span', null, h('strong', null, b.title), h('br'), h('span', { class: 'faint' }, b.desc))))),
    h('a', { class: 'btn btn-sm', href: '#/badges' }, 'See all badges'));
}

export function certificate({ mission, report, commander, date }) {
  const won = mission.status === 'won';
  const unit = mission.config.body === 'mars' ? 'sols' : 'days';
  return h('section', { class: ['db-cert', mission.config.body], 'aria-label': 'Mission certificate' },
    h('div', { class: 'db-cert-inner' },
      h('div', { class: 'db-cert-logo' }, logo({ size: 72 })),
      h('p', { class: 'db-cert-kicker' }, 'Sol Survivor · Junior Astronaut Mission Trainer'),
      h('h2', { class: 'db-cert-title' }, won ? 'Certificate of Mission Success' : 'Certificate of Brave Effort'),
      h('p', null, 'This certifies that'),
      h('p', { class: 'db-cert-name' }, commander),
      h('p', null, won
        ? `commanded the ${mission.config.title} mission at ${mission.site.name} and kept the crew alive for ${mission.sol} ${unit}.`
        : `led the ${mission.config.title} mission at ${mission.site.name} for ${mission.sol} ${unit} and learned what it takes to survive.`),
      h('div', { class: 'db-cert-stars' }, stars(report.score.stars, 3, { size: '2rem' })),
      h('p', { class: 'db-cert-meta mono' }, `${report.score.points} points · Crew: ${mission.crew.map((c) => c.name).join(', ')}`),
      h('p', { class: 'db-cert-meta mono' }, `${date} · Mission code ${mission.code}`),
      h('p', { class: 'db-cert-foot' }, 'Built with real NASA data from NASA records: Curiosity REMS weather, DONKI space weather, and Moon/Mars Trek maps.')));
}
