// Mission screen: the core loop. Three big gauges, the crew, today's weather, the log and the Next Sol button.
import { LIFE_SUPPORT, RADIATION, SHIELDING } from '../../data/constants.js';
import { moduleById } from '../../data/modules.js';
import { gauge, toneForSols, toneForPercent } from '../components/gauge.js';
import { renderLog } from '../components/log.js';
import { renderEventCard } from '../components/eventCard.js';
import { escapeHtml, fmt, formatDate, clamp } from '../text.js';

const SHIELD_NAMES = ['Bare walls', 'Thin berm', 'Thick berm', 'Buried base'];

function onlineCount(state, id) {
  const count = state.modules?.[id] ?? 0;
  if (!count) return 0;
  const off = state.offline?.[id];
  return off ? 0 : count;
}

/** Sols of oxygen left, or Infinity when producing more than the crew breathes. */
export function airSolsLeft(state) {
  const b = state.lastSol?.budget;
  if (b && Number.isFinite(b.o2Out) && Number.isFinite(b.o2In)) {
    const net = b.o2Out - b.o2In;
    const o2 = state.supplies?.o2Kg ?? 0;
    return { sols: net <= 0 ? Infinity : o2 / net, use: b.o2Out, made: b.o2In };
  }
  const crew = state.crew?.length ?? 0;
  const use = (LIFE_SUPPORT?.o2KgPerCrewDay ?? 0.82) * crew;
  let made = 0;
  for (const id of ['oxygen', 'moxie', 'regolithO2']) made += onlineCount(state, id) * (moduleById(id)?.o2Kg ?? 0);
  const gh = moduleById('greenhouse');
  if ((state.flags?.greenhouseSols ?? 0) >= (gh?.growSols ?? 25)) made += onlineCount(state, 'greenhouse') * (gh?.o2Kg ?? 0);
  const net = use - made;
  const o2 = state.supplies?.o2Kg ?? 0;
  if (net <= 0) return { sols: Infinity, use, made };
  return { sols: o2 / net, use, made };
}

export function waterSolsLeft(state) {
  const b = state.lastSol?.budget;
  if (b && Number.isFinite(b.waterOut) && Number.isFinite(b.waterIn)) {
    const net = b.waterOut - b.waterIn;
    return net <= 0 ? Infinity : (state.supplies?.waterKg ?? 0) / net;
  }
  const crew = state.crew?.length ?? 0;
  const use = (LIFE_SUPPORT?.waterKgPerCrewDay ?? 3.5) * crew;
  const recycler = moduleById('recycler');
  const recovery = onlineCount(state, 'recycler') ? recycler?.recovery ?? 0.98 : 0;
  const o2gens = onlineCount(state, 'oxygen') * 4; // electrolysis water
  const drill = onlineCount(state, 'iceDrill') * (moduleById('iceDrill')?.waterKg ?? 10) * ((state.site?.iceAccess ?? 0) + (state.flags?.iceBonus ?? 0));
  const net = use * (1 - recovery) + o2gens - drill;
  const water = state.supplies?.waterKg ?? 0;
  return net <= 0 ? Infinity : water / net;
}

export function foodSolsLeft(state) {
  const b = state.lastSol?.budget;
  if (b && Number.isFinite(b.foodOut) && Number.isFinite(b.foodIn)) {
    const net = b.foodOut - b.foodIn;
    return net <= 0 ? Infinity : (state.supplies?.foodKg ?? 0) / net;
  }
  const crew = state.crew?.length ?? 0;
  const use = (LIFE_SUPPORT?.foodKgPerCrewDay ?? 1.8) * crew;
  const gh = moduleById('greenhouse');
  const harvesting = (state.flags?.greenhouseSols ?? 0) >= (gh?.growSols ?? 25);
  let made = harvesting ? onlineCount(state, 'greenhouse') * (gh?.foodKg ?? 0) : 0;
  if (state.flags?.perchlorate) made /= 2;
  const net = use - made;
  return net <= 0 ? Infinity : (state.supplies?.foodKg ?? 0) / net;
}

export function avgDose(state) {
  const crew = state.crew ?? [];
  if (!crew.length) return 0;
  return crew.reduce((s, c) => s + (c.doseMsv ?? 0), 0) / crew.length;
}

function solsText(sols, unit) {
  if (!Number.isFinite(sols)) return '∞';
  return `${fmt(Math.floor(sols))} ${unit}`;
}

function statCard(label, value, sub, tone = 'good', frac = null) {
  return `<div class="card stat ${tone}">
    <div class="label">${escapeHtml(label)}</div>
    <div class="value">${escapeHtml(value)}</div>
    ${frac != null ? `<div class="bar ${tone}"><span style="width:${clamp(frac, 0, 1) * 100}%"></span></div>` : ''}
    <small>${sub}</small>
  </div>`;
}

function crewCard(state) {
  const crew = state.crew ?? [];
  return `<div class="card">
    <h3>Crew</h3>
    <div class="crew-list">${crew
      .map((c) => {
        const health = clamp(c.health ?? 100, 0, 100);
        const morale = clamp(c.morale ?? 100, 0, 100);
        const hTone = health <= 30 ? 'danger' : health <= 60 ? 'warn' : '';
        const mTone = morale <= 30 ? 'danger' : morale <= 60 ? 'warn' : '';
        return `<div class="crew-member">
          <div class="avatar" aria-hidden="true">${escapeHtml(String(c.name ?? '?').slice(0, 1).toUpperCase())}</div>
          <div>
            <strong>${escapeHtml(c.name ?? 'Crew')}</strong> <small>${escapeHtml(c.role ?? '')} · ${fmt(c.doseMsv ?? 0, 1)} mSv</small>
            <div class="bars">
              <span>Health ${Math.round(health)}</span><div class="bar ${hTone}"><span style="width:${health}%"></span></div>
              <span>Morale ${Math.round(morale)}</span><div class="bar ${mTone}"><span style="width:${morale}%"></span></div>
            </div>
          </div>
        </div>`;
      })
      .join('')}</div>
  </div>`;
}

function envCard(state) {
  const env = state.env ?? {};
  const isMoon = state.body === 'moon';
  const tauPct = Math.round(clamp(env.dust ?? 0, 0, 1) * 100);
  const blackout = (env.blackoutSols ?? 0) > 0;
  const storm = (env.stormSols ?? 0) > 0;
  return `<div class="card">
    <div class="row between"><h3>Outside today</h3><span data-badge="${isMoon ? 'moon-fact' : 'rems'}"></span></div>
    <div class="env-grid">
      <div><div class="k">Coldest</div><div class="v">${fmt(env.minC)} °C</div></div>
      <div><div class="k">Warmest</div><div class="v">${fmt(env.maxC)} °C</div></div>
      ${isMoon
        ? `<div><div class="k">Sun</div><div class="v">${env.lit === false ? 'Night (no solar power)' : 'Daylight'}</div></div>`
        : `<div><div class="k"><button type="button" class="term" data-term="tau">Dust in the sky (tau)</button></div><div class="v">${fmt(env.tau, 2)}${storm ? ` · storm, ${env.stormSols} sols left` : ''}</div></div>`}
      <div><div class="k">Dust on panels</div><div class="v">${tauPct}%</div></div>
      <div><div class="k"><button type="button" class="term" data-term="light-delay">Light delay</button></div><div class="v">${isMoon ? '1.3 s' : `${fmt(env.lightDelayMin, 1)} min`}</div></div>
      <div><div class="k">Air pressure</div><div class="v">${isMoon ? 'None (vacuum)' : `${fmt(env.pressurePa)} Pa`}</div></div>
    </div>
    ${blackout ? `<p class="notice danger" style="margin-top:8px">Comms blackout: no messages from Earth for ${env.blackoutSols} more sols.</p>` : ''}
  </div>`;
}

function offlineList(state) {
  const entries = Object.entries(state.offline ?? {});
  if (!entries.length) return '';
  return `<div class="card offline-list"><strong>Switched off or broken:</strong> ${entries
    .map(([id, o]) => `${escapeHtml(moduleById(id)?.name ?? id)} (${escapeHtml(o?.reason ?? 'off')}${Number.isFinite(o?.sols) ? `, ${o.sols} sols` : ''})`)
    .join(', ')}</div>`;
}

export function renderMission(store) {
  const state = store.mission;
  if (!state) return '<p class="loading">No mission loaded.</p>';
  const isMoon = state.body === 'moon';
  const unit = isMoon ? 'days' : 'sols';
  const over = state.status?.over;

  const air = airSolsLeft(state);
  const airTone = toneForSols(air.sols);
  const airBig = Number.isFinite(air.sols) ? `${fmt(Math.floor(air.sols))} ${unit} left` : 'Making a surplus';
  const airFrac = Number.isFinite(air.sols) ? clamp(air.sols / 30, 0, 1) : 1;

  const power = state.power ?? {};
  const battMax = power.batteryMaxKwh ?? 0;
  const battPct = battMax > 0 ? clamp((power.batteryKwh ?? 0) / battMax, 0, 1) * 100 : 0;
  const shortfall = (power.shortfallKwh ?? 0) > 0;
  const powerTone = shortfall ? 'danger' : toneForPercent(battPct);

  const level = clamp(state.shielding?.level ?? 0, 0, SHIELDING?.maxLevel ?? 3);
  const dose = avgDose(state);
  const xrays = dose / (RADIATION?.chestXrayMsv ?? 0.1);
  const limit = RADIATION?.careerLimitMsv ?? 600;
  const shieldTone = dose > limit * 0.5 ? 'danger' : dose > limit * 0.2 ? 'warn' : 'good';

  const foodSols = foodSolsLeft(state);
  const waterSols = waterSolsLeft(state);
  const headerSeason = isMoon ? (state.env?.lit === false ? 'Lunar night' : 'Lunar day') : state.season ?? '';
  const pending = state.pendingCard;

  return `
  <div class="card mission-head">
    <div class="row between">
      <div class="sol">Sol ${escapeHtml(state.sol ?? 0)} of ${escapeHtml(state.lengthSols ?? '?')}</div>
      <span class="pill" title="Mission code">Code ${escapeHtml(state.code ?? '')}</span>
    </div>
    <div class="row muted">
      <span>${escapeHtml(formatDate(state.date))}</span>
      <span>·</span><span>${escapeHtml(headerSeason)}</span>
      <span>·</span><span>${escapeHtml(state.site?.name ?? '')}, ${isMoon ? 'the Moon' : 'Mars'}</span>
    </div>
  </div>

  <div class="gauges" style="margin-top:12px">
    ${gauge({ label: 'Air', fraction: airFrac, center: Number.isFinite(air.sols) ? String(Math.floor(air.sols)) : '∞', big: airBig, tone: airTone,
      sub: `${fmt(state.supplies?.o2Kg ?? 0)} kg <button type="button" class="term" data-term="life-support">oxygen</button> in tanks · crew breathes ${fmt(air.use, 1)} kg a sol, machines make ${fmt(air.made, 1)} kg` })}
    ${gauge({ label: 'Power', fraction: battPct / 100, center: `${Math.round(battPct)}%`, big: `Battery ${Math.round(battPct)}%`, tone: powerTone,
      sub: `Last sol: made ${fmt(power.producedKwh)} kWh, used ${fmt(power.usedKwh)} kWh${shortfall ? ` · <strong>short by ${fmt(power.shortfallKwh)} kWh, machines were switched off</strong>` : ''}` })}
    ${gauge({ label: 'Shielding', fraction: (level + 1) / 4, center: `L${level}`, big: `Level ${level}: ${SHIELD_NAMES[level] ?? ''}`, tone: shieldTone,
      sub: `Crew <button type="button" class="term" data-term="sievert">dose</button> ${fmt(dose, 1)} mSv, about ${fmt(xrays)} chest X-rays · career limit ${fmt(limit)} mSv${state.shielding?.shelterMode ? ` · sheltering (${escapeHtml(state.shielding.shelterMode)})` : ''}` })}
  </div>

  <div class="strip" style="margin-top:12px">
    ${statCard('Food', solsText(foodSols, unit), `${fmt(state.supplies?.foodKg ?? 0)} kg packed`, toneForSols(foodSols), Number.isFinite(foodSols) ? foodSols / 30 : 1)}
    ${statCard('Water', solsText(waterSols, unit), `${fmt(state.supplies?.waterKg ?? 0)} kg in tanks`, toneForSols(waterSols), Number.isFinite(waterSols) ? waterSols / 30 : 1)}
    ${statCard('Science', fmt(state.science ?? 0), 'points for Earth', 'good')}
    ${statCard('Spares', fmt(state.supplies?.spares ?? 0), 'repair kits', (state.supplies?.spares ?? 0) === 0 ? 'warn' : 'good')}
  </div>

  <div class="grid grid-2 collapse" style="margin-top:12px">
    ${crewCard(state)}
    ${envCard(state)}
  </div>
  ${offlineList(state)}

  ${store.toast ? `<div class="notice outcome row between" style="margin-top:12px" role="status"><span>${escapeHtml(store.toast)}</span><button type="button" class="btn small" data-action="dismiss-toast">OK</button></div>` : ''}

  <div class="card" style="margin-top:12px">
    <h3>Mission log</h3>
    ${renderLog(store.history ?? [])}
  </div>

  <div class="next-sol">
    <div class="inner">
      ${over
        ? '<button type="button" class="btn primary big" data-action="go-debrief">See how you did →</button>'
        : `<button type="button" class="btn primary big" data-action="next-sol" ${pending ? 'disabled' : ''}>Next Sol ▶</button>
           ${pending ? '<span class="pill warn">Decide first!</span>' : ''}`}
      <button type="button" class="btn" data-action="abandon" aria-label="Quit mission">Quit</button>
    </div>
  </div>

  ${pending ? renderEventCard(pending, state) : ''}`;
}
