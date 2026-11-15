// Data Lab · Live from NASA: what the Sun is doing right now (DONKI, fetched in the browser), the latest
// Curiosity weather reading (REMS feed) and saved space-biology findings (OSDR), each with its timestamp.
import { h, mount, announce } from '../../dom.js';
import { loadingState, toast } from '../../components/common.js';
import { loadLive, onLive, liveHealth, relativeTime } from '../../../live/liveData.js';
import { todaysSunMission } from '../../../live/liveMission.js';
import { liveSunCard, liveMarsCard, liveBriefingCard, liveTag, healthFactBody } from '../../live/liveSun.js';
import { createMission } from '../../../engine/sim.js';
import { randomMissionCode } from '../../../engine/rng.js';
import { loadSimContext } from '../../../state/nasaData.js';
import { setMission } from '../../../state/store.js';
import { navigate } from '../../router.js';
import { sectionHead, statCard, statGrid, fmtNum } from './shared.js';

const STAMP = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false });
const stamp = (iso) => (Number.isFinite(Date.parse(iso)) ? `${STAMP.format(new Date(iso))} UTC` : 'unknown');
const FILTERS = [['all', 'All'], ['flare', 'Flares'], ['cme', 'Eruptions (CMEs)'], ['sep', 'Radiation storms'], ['storm', 'Magnetic storms'], ['alert', 'NASA notices']];
const KIND = { flare: 'Flare', cme: 'CME', sep: 'SEP', storm: 'Geomagnetic storm', alert: 'Notice' };
const PAGE = 25;

function statusBar(live, onRefresh, busy) {
  const sun = live.sun;
  const isLive = sun.source === 'live';
  return h('div', { class: 'dl-live-status', role: 'status' },
    liveTag(sun.source),
    h('p', null, isLive
      ? `Fetched from NASA ${relativeTime(sun.fetchedAt)} (${stamp(sun.fetchedAt)}). ${live.cached ? 'Kept for up to 30 minutes so we do not pester NASA.' : 'Fresh from NASA just now.'}`
      : 'We could not reach NASA, so this page shows saved NASA records, not live data. The game still works.'),
    h('button', { type: 'button', class: 'btn btn-cyan', id: 'dl-live-refresh', disabled: busy, onclick: onRefresh }, busy ? 'Checking…' : 'Check NASA again'));
}

function requestList(live) {
  if (!live.requests?.length) return null;
  return h('details', { class: 'dl-live-reqwrap' },
    h('summary', null, 'How we asked NASA (for grown-ups and judges)'),
    h('ul', { class: 'dl-live-req' }, live.requests.map((r) => h('li', null,
      h('span', null, r.name),
      h('span', { class: r.ok ? 'ok' : 'bad' }, r.ok ? `HTTP ${r.status}` : `failed${r.status ? ` (${r.status})` : ''}`),
      h('span', null, r.ok ? `${r.count ?? '?'} records in ${(r.ms / 1000).toFixed(1)} s` : r.error ?? 'no answer')))));
}

function eventsTable(live) {
  const wrap = h('div');
  let filter = 'all';
  let shown = PAGE;
  const draw = () => {
    const now = Date.now();
    const rows = live.sun.events.filter((e) => filter === 'all' || e.kind === filter);
    mount(wrap,
      h('div', { class: 'dl-live-filters', role: 'group', 'aria-label': 'Show which events' }, FILTERS.map(([id, label]) => {
        const n = id === 'all' ? live.sun.events.length : live.sun.events.filter((e) => e.kind === id).length;
        return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === id), onclick: () => { filter = id; shown = PAGE; draw(); announce(`${label}: ${n} events`); } }, `${label} (${n})`);
      })),
      rows.length ? h('div', { class: 'dl-live-tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Sun events from NASA DONKI' },
        h('table', { class: 'dl-live-table' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'When (UTC)'), h('th', { scope: 'col' }, 'Type'), h('th', { scope: 'col' }, 'What happened'), h('th', { scope: 'col' }, 'NASA record'))),
          h('tbody', null, rows.slice(0, shown).map((e) => h('tr', { class: Date.parse(e.time) > now ? 'is-future' : null },
            h('td', { class: 'mono' }, stamp(e.time).replace(' UTC', '')),
            h('td', { class: 'mono' }, e.label ?? KIND[e.kind]),
            h('td', null, e.kidLine, e.summary ? h('span', { class: 'muted' }, ` “${e.summary}”`) : null),
            h('td', null, e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener noreferrer', class: 'live-link' }, 'Open', h('span', { class: 'sr-only' }, ` ${e.label} at NASA DONKI (opens in a new tab)`)) : h('span', { class: 'muted' }, 'saved record')))))))
        : h('p', { class: 'muted' }, 'NASA has no events of this kind in the last 30 days.'),
      rows.length > shown ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { shown += PAGE; draw(); } }, `Show ${Math.min(PAGE, rows.length - shown)} more (${rows.length - shown} left)`) : null);
  };
  draw();
  return wrap;
}

async function launchLiveMission(live, body) {
  try {
    const code = randomMissionCode();
    const { config, seps, summary } = todaysSunMission({ live, body, targetSols: 30, code });
    const ctx = await loadSimContext({ seps });
    const mission = createMission({ config, loadout: config.recommended, difficulty: 'cadet', code }, ctx);
    setMission(mission);
    toast(`Mission built from the real Sun: ${summary}`, { icon: 'sun', ms: 6000 });
    navigate('play');
  } catch (err) {
    console.error('[datalab] live mission failed to launch', err);
    toast(`The launch did not work. Please try again. (${err.message})`, { icon: 'alert' });
  }
}

function missionPanel(live) {
  const plan = todaysSunMission({ live, body: 'mars', targetSols: 30, code: 'PREVIEW' });
  return h('section', { class: 'card dl-live-mission', 'aria-labelledby': 'dl-live-mission-title' },
    h('h3', { id: 'dl-live-mission-title' }, 'Fly a mission on today’s real Sun'),
    h('p', { class: 'live-line' }, plan.isLive
      ? `A 30-day mission on the real calendar. ${plan.summary} Every storm card shows the real NASA record it came from.`
      : plan.summary),
    liveBriefingCard(live),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-primary', id: 'dl-live-launch-mars', onclick: () => launchLiveMission(live, 'mars') }, 'Launch on Mars'),
      h('button', { type: 'button', class: 'btn btn-cyan', id: 'dl-live-launch-moon', onclick: () => launchLiveMission(live, 'moon') }, 'Launch on the Moon'),
      h('span', { class: 'muted' }, 'Mission Control packs the lander for you. This replaces your saved mission.')));
}

function healthList(container) {
  liveHealth().then((health) => {
    if (!health.findings.length) { mount(container, h('p', { class: 'muted' }, health.label)); return; }
    mount(container,
      h('p', { class: 'live-stamp is-archive' }, `${health.label}. OSDR cannot be read from a web page, so these are saved study records, not live.`),
      h('div', { class: 'dl-live-health' }, health.findings.map((f) => {
        const card = healthFactBody(f, health);
        card.className = 'card live-card live-health src-archive';
        card.append(h('details', null, h('summary', null, 'In the scientists’ own words'), h('p', { class: 'muted' }, `${f.title}. ${f.summary}`)));
        return card;
      })));
  });
}

export function renderLive(container) {
  const body = h('div', { class: 'dl-live' }, loadingState('Asking NASA what the Sun is doing right now…'));
  let busy = false;
  let latest = null;

  const draw = (live) => {
    latest = live;
    const c = live.sun.counts ?? {};
    const isLive = live.sun.source === 'live';
    const health = h('div');
    const refresh = async () => {
      busy = true; draw(latest);
      const next = await loadLive({ force: true });
      busy = false; draw(next);
      announce(next.sun.source === 'live' ? 'Live NASA data updated.' : 'NASA could not be reached. Showing saved records.');
      document.getElementById('dl-live-refresh')?.focus();
    };
    mount(body,
      statusBar(live, refresh, busy),
      h('div', { class: 'dl-live-grid' }, liveSunCard(live), liveMarsCard(live)),
      statGrid([
        statCard({ icon: '', label: 'Solar flares', value: fmtNum(c.flares), detail: isLive ? 'Last 30 days, live' : 'Final 30 days of saved records', tone: 'gold' }),
        statCard({ icon: '', label: 'Sun eruptions (CMEs)', value: fmtNum(c.cmes), detail: 'Giant clouds of gas', tone: 'cyan' }),
        statCard({ icon: '', label: 'Radiation storms (SEPs)', value: fmtNum(c.seps), detail: 'Fast particles from the Sun', tone: 'rad' }),
        statCard({ icon: '', label: 'NASA notices', value: fmtNum(c.alerts), detail: isLive ? 'Sent by NASA’s forecasters' : 'Not in the saved records', tone: 'mars' }),
      ]),
      missionPanel(live),
      h('section', { 'aria-labelledby': 'dl-live-events-title' },
        h('h3', { id: 'dl-live-events-title' }, isLive ? 'Every Sun event NASA recorded in the last 30 days' : 'Sun events from saved NASA records'),
        h('p', { class: 'muted' }, isLive ? `Straight from NASA’s DONKI database. Rows tinted amber are forecasts for the next few days.` : 'These are saved NASA records, not live.'),
        eventsTable(live),
        requestList(live)),
      h('section', { 'aria-labelledby': 'dl-live-health-title' },
        h('h3', { id: 'dl-live-health-title' }, 'What space does to living things'),
        health));
    healthList(health);
  };

  mount(container,
    sectionHead({ kicker: 'Live from NASA', title: 'The real Sun and Mars, right now', intro: 'This page asks NASA’s computers for their newest records while you watch. If there is no internet it tells you, and shows saved records instead.' }),
    body);
  const off = onLive((live) => { if (!busy) draw(live); });
  return off;
}
