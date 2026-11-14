// Mission debrief: animated stars and points, score breakdown, lessons, radiation, telemetry charts,
// newly earned badges and a printable certificate.
import '../../styles/debrief.css';
import { h, prefersReducedMotion } from '../dom.js';
import { getState, clearNewBadges } from '../../state/store.js';
import { CAMPAIGN } from '../../data/missions.js';
import { stars, didYouKnow, sourceBadge, badgeToast } from '../components/common.js';
import { speak, canSpeak } from '../speech.js';
import { scoreBreakdown, lessonsPanel, radiationPanel, historyCharts, badgesPanel, certificate } from './debrief/sections.js';

function emptyState(root) {
  root.append(h('section', { class: 'panel empty' },
    h('span', { class: 'big', 'aria-hidden': 'true' }, '📋'),
    h('h1', null, 'No debrief yet'),
    h('p', null, 'Finish a mission and Mission Control will review how your crew did.'),
    h('div', { class: 'row' }, h('a', { class: 'btn btn-primary btn-lg', href: '#/campaign' }, '🚀 Go to the campaign')),
    didYouKnow()));
}

function countUp(el, target) {
  if (prefersReducedMotion()) { el.textContent = target.toLocaleString(); return () => {}; }
  const start = performance.now();
  const ms = 1400;
  let raf = 0;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = Math.round(target * (1 - (1 - t) ** 3)).toLocaleString();
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

function nextChapter(mission) {
  const i = CAMPAIGN.findIndex((c) => c.id === mission.config.id);
  return i >= 0 && mission.status === 'won' ? CAMPAIGN[i + 1] ?? null : null;
}

function hero(mission, report, pointsEl) {
  const won = mission.status === 'won';
  const unit = mission.config.body === 'mars' ? 'sols' : 'days';
  const story = won ? CAMPAIGN.find((c) => c.id === mission.config.id)?.win : report.improve[0];
  return h('header', { class: ['db-hero', won ? 'won' : 'lost', mission.config.body] },
    h('div', { class: 'db-hero-text' },
      h('span', { class: ['kicker', mission.config.body === 'mars' && 'mars'] }, mission.config.chapter ? `Chapter ${mission.config.chapter} debrief` : 'Free Play debrief'),
      h('h1', null, won ? '🏁 Mission complete!' : '🚨 Mission aborted'),
      h('p', { class: 'db-sub' }, `${mission.config.title} · ${mission.site.name} · ${mission.sol} of ${mission.config.targetSols} ${unit}`),
      story ? h('p', { class: 'db-story' }, story) : null,
      canSpeak() ? h('button', { type: 'button', class: 'btn btn-sm no-print', onclick: () => speak(`${won ? 'Mission complete' : 'Mission aborted'}. ${story ?? ''} ${report.radiation}`, true) }, '🔊 Read aloud') : null),
    h('div', { class: 'db-hero-score' },
      stars(report.score.stars, 3, { size: '3.2rem', animate: !prefersReducedMotion() }),
      h('p', { class: 'db-points' }, pointsEl, h('span', null, ' points')),
      h('p', { class: 'faint' }, `${report.score.stars} of 3 stars`)));
}

function actions(mission) {
  const next = nextChapter(mission);
  const isCampaign = CAMPAIGN.some((c) => c.id === mission.config.id);
  return h('nav', { class: 'db-actions no-print', 'aria-label': 'What next?' },
    next ? h('a', { class: 'btn btn-primary btn-lg', href: `#/loadout/${next.id}` }, `▶ Chapter ${next.chapter}: ${next.title}`) : null,
    h('a', { class: ['btn', 'btn-lg', !next && 'btn-primary'], href: `#/loadout/${isCampaign ? mission.config.id : 'free-play'}` }, '🔁 Try again'),
    h('a', { class: 'btn btn-lg', href: '#/academy' }, '🎓 Take a quiz'),
    h('a', { class: 'btn btn-lg', href: '#/patch' }, '🎨 Design your patch'),
    h('button', { type: 'button', class: 'btn btn-lg', onclick: () => window.print() }, '🖨️ Print certificate'),
    h('a', { class: 'btn btn-ghost', href: '#/campaign' }, 'Campaign map'));
}

export function render(root) {
  const { lastResult, profile } = getState();
  if (!lastResult?.mission || !lastResult?.debrief) { emptyState(root); return undefined; }
  const { mission, debrief: report, newBadges = [], at } = lastResult;
  root.classList.add('view-wide');

  const pointsEl = h('span', { class: 'db-points-num mono' }, '0');
  const commander = profile?.name || mission.crew[0]?.name || 'Commander';
  const date = new Date(at ?? Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  root.append(h('div', { class: 'db-screen' },
    hero(mission, report, pointsEl),
    actions(mission),
    badgesPanel(newBadges),
    h('div', { class: 'db-grid' }, scoreBreakdown(report.score), radiationPanel(report, mission)),
    lessonsPanel(report),
    historyCharts(mission),
    certificate({ mission, report, commander, date }),
    h('p', { class: 'db-sources faint no-print' }, 'Weather and radiation in this mission came from ', sourceBadge('rems', { label: 'Curiosity REMS' }), ' and ', sourceBadge('donki', { label: 'NASA DONKI' }), '.')));

  const stopCount = countUp(pointsEl, report.score.points);
  const fresh = getState().newBadges?.length > 0;
  const timer = fresh ? setTimeout(() => badgeToast(newBadges.length > 1 ? { icon: '🏅', title: `${newBadges.length} new badges` } : newBadges[0]), 1200) : 0;
  if (fresh) clearNewBadges();
  return () => { stopCount(); clearTimeout(timer); };
}
