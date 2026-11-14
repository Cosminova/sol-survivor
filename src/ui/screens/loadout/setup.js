// Mission setup controls: free-play site/length/date, difficulty, mission code, crew names.
import { h } from '../../dom.js';
import { icon, MODULE_ICONS, SUPPLY_ICONS } from '../../icons.js';
import { DIFFICULTY } from '../../../data/missions.js';
import { sitesForBody, siteById } from '../../../data/sites.js';
import { ROLES } from '../../../engine/sim.js';
import { randomMissionCode } from '../../../engine/rng.js';
import { mapView } from '../../mapView.js';
import { termButton, meter } from '../../components/common.js';

export const sanitizeCode = (v) => String(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
export const sanitizeName = (v) => String(v).replace(/[<>]/g, '').slice(0, 16);

export function freePlayPanel(fp, onChange) {
  const sites = sitesForBody(fp.body);
  const site = siteById(fp.siteId);
  return h('section', { class: 'panel lo-free' },
    h('h2', { class: 'panel-title' }, 'Design your mission'),
    h('div', { class: 'tabs', role: 'group', 'aria-label': 'Destination' },
      ['moon', 'mars'].map((body) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(fp.body === body),
        onclick: () => onChange({ body, siteId: sitesForBody(body)[0].id }),
      }, body === 'mars' ? '🔴 Mars' : '🌕 The Moon'))),
    mapView({ body: fp.body, sites, selectedId: fp.siteId, onSelect: (siteId) => onChange({ siteId }), label: 'Pick a landing site' }),
    site ? h('div', { class: 'lo-site' },
      h('h3', null, `📍 ${site.name}`),
      h('p', { class: 'muted' }, site.blurb),
      h('div', { class: 'lo-site-meters' },
        h('span', null, '🧊 Ice access'), meter(site.iceAccess * 100, 'var(--water)', 'Ice access'),
        h('span', null, '🔬 Science value'), meter((site.science / 1.6) * 100, 'var(--violet)', 'Science value'))) : null,
    h('div', { class: 'grid-2 lo-free-fields' },
      h('label', { class: 'field' },
        h('span', null, `Mission length: ${fp.targetSols} ${fp.body === 'mars' ? 'sols' : 'days'}`),
        h('input', { type: 'range', min: 10, max: 150, step: 5, value: fp.targetSols, onchange: (e) => onChange({ targetSols: Number(e.target.value) }) })),
      h('label', { class: 'field' },
        h('span', null, 'Landing date (replays real 2024–25 solar storms)'),
        h('input', { class: 'input', type: 'date', min: '2024-01-01', max: '2025-12-31', value: fp.startDate, onchange: (e) => onChange({ startDate: e.target.value || '2024-05-01' }) }))),
    fp.body === 'mars' ? h('label', { class: 'switch' },
      h('span', null, 'Include the 6-month trip’s radiation dose ', termButton('galactic-cosmic-rays', 'why?')),
      h('input', { type: 'checkbox', checked: fp.includeTransitDose, onchange: (e) => onChange({ includeTransitDose: e.target.checked }) })) : null);
}

export function difficultyPicker(value, onChange) {
  const notes = { cadet: 'Bigger lander, fewer surprises', specialist: 'The real numbers', commander: 'Tight mass, more breakdowns' };
  return h('div', { class: 'field' },
    h('span', { class: 'field-label' }, 'Difficulty'),
    h('div', { class: 'tabs lo-diff', role: 'group', 'aria-label': 'Difficulty' },
      Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(value === id), title: notes[id], onclick: () => onChange(id),
      }, d.label))),
    h('span', { class: 'faint lo-diff-note' }, notes[value]));
}

export function codeField(code, onChange) {
  return h('div', { class: 'field' },
    h('label', { class: 'field-label', for: 'mission-code' }, 'Mission code (same code = same mission for the whole class)'),
    h('div', { class: 'row' },
      h('input', {
        id: 'mission-code', class: 'input mono lo-code', value: code, maxlength: 8, autocomplete: 'off', spellcheck: 'false',
        oninput: (e) => { e.target.value = sanitizeCode(e.target.value); },
        onchange: (e) => onChange(sanitizeCode(e.target.value) || randomMissionCode()),
      }),
      h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Random mission code', onclick: () => onChange(randomMissionCode()) }, icon('recycle', { size: 20 }))));
}

export function crewFields(crew, onChange) {
  return h('details', { class: 'lo-crew' },
    h('summary', null, '🧑‍🚀 Name your crew'),
    h('div', { class: 'stack-sm' }, crew.map((c, i) => h('label', { class: 'lo-crew-row' },
      h('span', { class: 'lo-crew-avatar', 'aria-hidden': 'true' }, icon('user', { size: 20 })),
      h('span', { class: 'lo-crew-role' }, ROLES[c.role]?.label ?? c.role),
      h('input', {
        class: 'input', value: c.name, maxlength: 16, 'aria-label': `${ROLES[c.role]?.label ?? c.role} name`,
        onchange: (e) => onChange(crew.map((x, j) => (j === i ? { ...x, name: sanitizeName(e.target.value).trim() || x.name } : x))),
      })))));
}
