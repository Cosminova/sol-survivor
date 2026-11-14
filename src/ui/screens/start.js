// Start screen: pick a world, a site, a crew and a mission code. One click to quick start.
import { sitesForBody } from '../../data/sites.js';
import { escapeHtml } from '../text.js';

export const ROLES = ['commander', 'engineer', 'geologist', 'doctor', 'botanist'];
const ROLE_LABEL = { commander: 'Commander', engineer: 'Engineer', geologist: 'Geologist', doctor: 'Doctor', botanist: 'Botanist' };

const BODIES = [
  { id: 'mars', icon: '🔴', name: 'Mars', blurb: 'Thin air, dust storms, 24.6-hour sols and real Curiosity weather.' },
  { id: 'moon', icon: '🌕', name: 'Moon', blurb: 'No air at all, two-week nights and ice hiding in dark craters.' },
];

function siteHints(site) {
  const ice = site.iceAccess >= 0.7 ? 'Lots of ice' : site.iceAccess >= 0.2 ? 'Some ice' : 'Almost no ice';
  const sci = site.science >= 1.5 ? 'Top science' : site.science >= 1.1 ? 'Good science' : 'Plain science';
  let temp;
  if (site.body === 'mars') temp = site.tempOffsetC <= -15 ? 'Very cold' : site.tempOffsetC < 0 ? 'Cold' : 'Mild for Mars';
  else temp = `${site.tempDayC ?? '?'}°C day / ${site.tempNightC ?? '?'}°C night`;
  return [
    ['🧊', ice],
    ['🔬', sci],
    ['🌡️', temp],
  ]
    .map(([icon, text]) => `<span class="pill"><span aria-hidden="true">${icon}</span>${escapeHtml(text)}</span>`)
    .join('');
}

/** @param {object} store app store (uses store.setup, store.saved, store.offline) */
export function renderStart(store) {
  const s = store.setup;
  const sites = sitesForBody(s.body);
  const saved = store.saved;
  const canContinue = saved?.mission && !saved.mission.status?.over;
  return `
  <section class="hero">
    <h1>Sol Survivor</h1>
    <p class="pitch">Run a tiny outpost on Mars or the Moon, one sol at a time. Keep your crew breathing, powered and safe, with real NASA data behind every number.</p>
    ${store.offline ? '<p class="notice" style="display:inline-block">Offline: using built-in weather instead of the archived NASA files.</p>' : ''}
  </section>
  ${canContinue ? `<div class="card row between">
      <div><strong>Mission ${escapeHtml(saved.mission.code ?? '')} in progress</strong><br><small>Sol ${escapeHtml(saved.mission.sol ?? 0)} of ${escapeHtml(saved.mission.lengthSols ?? '?')} at ${escapeHtml(saved.mission.site?.name ?? '')}</small></div>
      <button type="button" class="btn primary" data-action="continue">Continue mission</button>
    </div>` : ''}

  <div class="card stack">
    <button type="button" class="btn primary big" data-action="quickstart">🚀 Quick start on ${s.body === 'moon' ? 'the Moon' : 'Mars'}</button>
    <p class="hint" style="text-align:center">A sensible lander loadout, your crew below, and straight to Sol 1.</p>
  </div>

  <h2 style="margin-top:16px">1. Choose a world</h2>
  <div class="grid grid-2" role="radiogroup" aria-label="World">
    ${BODIES.map(
      (b) => `<button type="button" role="radio" aria-checked="${s.body === b.id}" class="card selectable body-card ${s.body === b.id ? 'selected' : ''}" data-action="set-body" data-body="${b.id}">
        <span class="icon" aria-hidden="true">${b.icon}</span>
        <strong>${b.name}</strong>
        <small>${b.blurb}</small>
      </button>`,
    ).join('')}
  </div>

  <h2 style="margin-top:16px">2. Pick a landing site</h2>
  <div class="grid grid-2 collapse" role="radiogroup" aria-label="Landing site">
    ${sites.map(
      (site) => `<button type="button" role="radio" aria-checked="${s.siteId === site.id}" class="card selectable site-card ${s.siteId === site.id ? 'selected' : ''}" data-action="set-site" data-site="${site.id}">
        <strong>${escapeHtml(site.name)}</strong>
        <small>${escapeHtml(site.blurb)}</small>
        <div class="hints">${siteHints(site)}</div>
      </button>`,
    ).join('')}
  </div>

  <h2 style="margin-top:16px">3. How long?</h2>
  <div class="seg" role="radiogroup" aria-label="Mission length">
    ${[30, 60].map((n) => `<button type="button" role="radio" aria-checked="${s.lengthSols === n}" class="btn ${s.lengthSols === n ? 'on' : ''}" data-action="set-length" data-length="${n}">${n} ${s.body === 'moon' ? 'days' : 'sols'}</button>`).join('')}
  </div>
  <p class="hint">A sol is one Mars day: 24 hours and 40 minutes. On the Moon each turn is one Earth day.</p>

  <h2 style="margin-top:16px">4. Your crew (2 to 4)</h2>
  <div class="card stack">
    ${s.crew.map(
      (c, i) => `<div class="crew-row">
        <label class="field"><span>Name</span><input type="text" maxlength="16" value="${escapeHtml(c.name)}" data-field="crew-name" data-index="${i}" aria-label="Crew member ${i + 1} name"></label>
        <label class="field"><span>Role</span><select data-field="crew-role" data-index="${i}" aria-label="Crew member ${i + 1} role">
          ${ROLES.map((r) => `<option value="${r}" ${c.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
        </select></label>
        <button type="button" class="btn ghost" data-action="remove-crew" data-index="${i}" ${s.crew.length <= 2 ? 'disabled' : ''} aria-label="Remove ${escapeHtml(c.name)}">Remove</button>
      </div>`,
    ).join('')}
    ${s.crew.length < 4 ? '<button type="button" class="btn" data-action="add-crew">+ Add a crew member</button>' : ''}
    <p class="hint">Geologists find more science. Engineers fix machines. Doctors keep everyone healthy. Botanists grow bigger harvests.</p>
  </div>

  <h2 style="margin-top:16px">5. Mission code</h2>
  <div class="card stack">
    <div class="row">
      <input type="text" class="code-input" maxlength="8" value="${escapeHtml(s.code)}" data-field="code" aria-label="Mission code" style="flex:1; min-width: 160px">
      <button type="button" class="btn" data-action="new-code">New code</button>
    </div>
    <p class="hint">Share this code so a friend gets the same mission: same weather, same storms, same surprises. Only your choices differ.</p>
  </div>

  <div class="grid grid-2 collapse" style="margin-top:16px">
    <button type="button" class="btn primary big" data-action="quickstart">🚀 Quick start</button>
    <button type="button" class="btn big" data-action="go-pack">🧰 Pack the lander myself</button>
  </div>
  <p class="hint" style="text-align:center; margin-top:10px">Numbers in this game come from archived NASA data, not live feeds. See the Data Lab tab for every source.</p>`;
}
