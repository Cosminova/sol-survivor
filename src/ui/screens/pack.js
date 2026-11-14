// Pack the Lander: choose modules and supply crates under the mass limit.
import { modulesForBody, SUPPLIES } from '../../data/modules.js';
import { landerMass, LANDER_CAPACITY_KG } from '../../engine/mission.js';
import { escapeHtml, fmt } from '../text.js';

const CATEGORY_LABEL = { power: 'Power', life: 'Life support', isru: 'Make it here (ISRU)', safety: 'Safety', science: 'Science' };
const CATEGORY_ORDER = ['power', 'life', 'isru', 'safety', 'science'];

export function safeMass(loadout) {
  try {
    const m = landerMass(loadout);
    return { modulesKg: m?.modulesKg ?? 0, suppliesKg: m?.suppliesKg ?? 0, totalKg: m?.totalKg ?? 0, overBy: m?.overBy ?? 0 };
  } catch {
    return { modulesKg: 0, suppliesKg: 0, totalKg: 0, overBy: 0 };
  }
}

function counter(kind, id, count, max) {
  return `<div class="counter" role="group" aria-label="${escapeHtml(id)} count">
    <button type="button" class="btn" data-action="pack-dec" data-kind="${kind}" data-id="${escapeHtml(id)}" ${count <= 0 ? 'disabled' : ''} aria-label="Remove one">−</button>
    <span class="count" aria-live="polite">${count}</span>
    <button type="button" class="btn" data-action="pack-inc" data-kind="${kind}" data-id="${escapeHtml(id)}" ${count >= max ? 'disabled' : ''} aria-label="Add one">+</button>
  </div>`;
}

export function renderPack(store) {
  const s = store.setup;
  const loadout = s.loadout;
  const mods = modulesForBody(s.body);
  const mass = safeMass(loadout);
  const cap = LANDER_CAPACITY_KG ?? 12000;
  const pct = Math.min(100, (mass.totalKg / cap) * 100);
  const over = mass.overBy > 0;
  const barTone = over ? 'danger' : pct > 85 ? 'warn' : '';
  const crewSols = s.crew.length * s.lengthSols;

  const groups = CATEGORY_ORDER.map((cat) => {
    const list = mods.filter((m) => (m.category ?? 'other') === cat);
    if (!list.length) return '';
    return `<h3 style="margin-top:14px">${CATEGORY_LABEL[cat] ?? cat}</h3>
      <div class="stack">${list
        .map((m) => {
          const count = loadout.modules[m.id] ?? 0;
          return `<div class="card module-row">
            <span class="icon" aria-hidden="true">${m.icon ?? ''}</span>
            <div>
              <strong>${escapeHtml(m.name)}</strong> <span data-badge="${escapeHtml(m.source ?? '')}"></span>
              <div class="meta">${escapeHtml(m.blurb ?? '')}</div>
              <div class="meta">${fmt(m.massKg)} kg each${m.kw ? ` · uses ${m.kw} kW` : ''}${m.outputKw ? ` · makes ${m.outputKw} kW` : ''}${m.storageKwh ? ` · stores ${m.storageKwh} kWh` : ''}${m.term ? ` · <button type="button" class="term" data-term="${escapeHtml(m.term)}">what is this?</button>` : ''}</div>
            </div>
            ${counter('module', m.id, count, m.max ?? 9)}
          </div>`;
        })
        .join('')}</div>`;
  }).join('');

  return `
  <h1>Pack the Lander</h1>
  <p class="muted">Everything you bring has to fit under ${fmt(cap)} kg. Heavy gear is powerful, but mass is the one thing you cannot cheat.</p>

  <div class="card stack" aria-live="polite">
    <div class="row between"><strong>Lander mass</strong><span class="${over ? 'pill danger' : 'pill'}">${fmt(mass.totalKg)} / ${fmt(cap)} kg</span></div>
    <div class="massbar ${barTone}" role="progressbar" aria-valuenow="${Math.round(mass.totalKg)}" aria-valuemin="0" aria-valuemax="${cap}"><span style="width:${pct}%"></span></div>
    <div class="hint">Modules ${fmt(mass.modulesKg)} kg · Supplies ${fmt(mass.suppliesKg)} kg${over ? ` · <strong style="color:var(--danger)">Too heavy by ${fmt(mass.overBy)} kg. Remove something to launch.</strong>` : ''}</div>
  </div>

  ${groups}

  <h3 style="margin-top:14px">Supply crates (100 kg each)</h3>
  <div class="stack">${SUPPLIES.map((sup) => {
    const count = loadout.supplies[sup.id] ?? 0;
    const perDay = { o2: 0.82, water: 3.5, food: 1.8 }[sup.id] ?? 1;
    const solsCovered = perDay > 0 ? Math.floor((count * (sup.unitKg ?? 100)) / (perDay * s.crew.length)) : 0;
    return `<div class="card module-row">
      <span class="icon" aria-hidden="true">${sup.icon ?? ''}</span>
      <div>
        <strong>${escapeHtml(sup.name)}</strong> <span data-badge="bvad"></span>
        <div class="meta">${count} crates = ${fmt(count * (sup.unitKg ?? 100))} kg, about <strong>${solsCovered} sols</strong> for ${s.crew.length} crew with no recycling or production. Mission is ${s.lengthSols} sols (${crewSols} crew-sols).</div>
      </div>
      ${counter('supply', sup.id, count, 40)}
    </div>`;
  }).join('')}</div>

  <div class="sticky-foot grid grid-2 collapse">
    <button type="button" class="btn big" data-action="go-start">← Back</button>
    <button type="button" class="btn primary big" data-action="launch" ${over ? 'disabled' : ''}>${over ? 'Too heavy to launch' : '🚀 Launch!'}</button>
  </div>`;
}
