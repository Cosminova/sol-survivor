// World cards and the landing-site list for the Cosminova sky picker.
import { h } from '../dom.js';
import { factRows, provenanceLine, disputedLine } from './worldFacts.js';
import { planetPortrait } from './portrait.js';

const badge = (text, measured) => h('span', { class: ['wp-badge', measured ? 'wp-badge-real' : 'wp-badge-gen'] }, text);

// The four facts every card shows; the rest fold away under "All facts" so a card fits on screen.
const KEY_FACTS = new Set(['gravity', 'tempDay', 'pressure', 'ice']);

const factItem = (r) => h('div', { class: 'wp-fact', dataset: { fact: r.key }, title: r.note ?? null },
  h('dt', null, r.label),
  h('dd', null, h('span', { class: 'wp-fact-value' }, r.value), badge(r.badge, r.measured)));

/**
 * A card for one landable world.
 * @param {object} world a World from src/data/worlds.js
 * @param {{ onChoose?: (world: object) => void, selected?: boolean,
 *   challenge?: (world: object) => (string|Node|null), effects?: (world: object) => (Node|Node[]|string|null) }} [opts]
 *   challenge/effects are the engine's worldChallenge/worldEffects, passed in by the loadout once they exist.
 */
export function worldCard(world, { onChoose, chooseLabel = null, selected = false, challenge, effects } = {}) {
  const titleId = `wp-card-${world.id}`;
  const rows = factRows(world);
  const more = effects ? effects(world) : null;
  return h('article', { class: ['wp-card', selected && 'is-selected'], 'aria-labelledby': titleId },
    h('header', { class: 'wp-card-head' },
      planetPortrait(world),
      h('div', { class: 'wp-card-id' },
        h('h4', { id: titleId, class: 'wp-card-title' }, world.name),
        h('p', { class: 'wp-card-prov' }, provenanceLine(world)),
        world.disputed ? h('p', { class: 'wp-card-disputed' }, disputedLine(world)) : null,
        challenge ? h('p', { class: 'wp-card-challenge' }, challenge(world)) : null)),
    h('p', { class: 'wp-card-blurb' }, world.blurb),
    h('dl', { class: 'wp-facts' }, rows.filter((r) => KEY_FACTS.has(r.key)).map(factItem)),
    h('details', { class: 'wp-more' },
      h('summary', null, 'All facts and what it does to your crew'),
      h('dl', { class: 'wp-facts' }, rows.filter((r) => !KEY_FACTS.has(r.key)).map(factItem)),
      h('div', { class: 'wp-effects', 'data-slot': 'world-effects' }, more)),
    onChoose ? h('button', {
      type: 'button', class: ['btn', selected ? 'btn-cyan' : 'btn-primary', 'wp-choose'], 'aria-pressed': String(selected),
      onclick: () => onChoose(world),
    }, chooseLabel ?? (selected ? `${world.name} chosen` : `Land on ${world.name}`)) : null);
}

/** Card for a moon a gateway promises but that has no world profile yet. */
export function missingCard(id) {
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  return h('article', { class: 'wp-card wp-card-missing' },
    h('h4', { class: 'wp-card-title' }, name),
    h('p', { class: 'muted' }, 'Mission Control is still writing up this world. Check back soon.'));
}

/**
 * Landing-site chooser for a world.
 * @param {{ world: object, sites: Array<object>, selectedId: string|null, practice: boolean, onSelect: (siteId: string) => void }} opts
 */
export function siteList({ world, sites, selectedId, practice, onSelect }) {
  return h('div', { class: 'wp-sites', role: 'group', 'aria-label': `Landing sites on ${world.name}` },
    practice ? h('p', { class: 'wp-note' }, `Nobody has mapped landing sites on ${world.name} yet. Your lander will use a practice landing zone.`) : null,
    sites.map((site) => h('button', {
      type: 'button', class: ['wp-site', site.id === selectedId && 'is-selected'], 'aria-pressed': String(site.id === selectedId),
      onclick: () => onSelect(site.id),
    },
    h('span', { class: 'wp-site-name' }, practice ? 'Practice landing zone' : site.name),
    h('span', { class: 'wp-site-blurb' }, practice ? 'A flat, safe spot picked by Mission Control.' : site.blurb),
    site.origin ? badge(site.origin === 'generated' ? 'Generated · game model' : 'Real · NASA', site.origin !== 'generated') : null)));
}
