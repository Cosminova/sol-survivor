// World cards and the landing-site list for the Cosminova sky picker.
import { h } from '../dom.js';
import { factRows, provenanceLine } from './worldFacts.js';

const badge = (text, measured) => h('span', { class: ['wp-badge', measured ? 'wp-badge-real' : 'wp-badge-gen'] }, text);

/**
 * A card for one landable world.
 * @param {object} world a World from src/data/worlds.js
 * @param {{ onChoose?: (world: object) => void, selected?: boolean,
 *   challenge?: (world: object) => (string|Node|null), effects?: (world: object) => (Node|Node[]|string|null) }} [opts]
 *   challenge/effects are the engine's worldChallenge/worldEffects, passed in by the loadout once they exist.
 */
export function worldCard(world, { onChoose, selected = false, challenge, effects } = {}) {
  const titleId = `wp-card-${world.id}`;
  const rows = factRows(world);
  return h('article', { class: ['wp-card', selected && 'is-selected'], 'aria-labelledby': titleId },
    h('header', { class: 'wp-card-head' },
      h('h4', { id: titleId, class: 'wp-card-title' }, world.name),
      h('p', { class: 'wp-card-prov' }, provenanceLine(world)),
      h('p', { class: 'wp-card-blurb' }, world.blurb)),
    challenge ? h('p', { class: 'wp-card-challenge' }, challenge(world)) : null,
    h('dl', { class: 'wp-facts' }, rows.map((r) => h('div', { class: 'wp-fact', dataset: { fact: r.key } },
      h('dt', null, r.label),
      h('dd', null, h('span', { class: 'wp-fact-value' }, r.value), badge(r.badge, r.measured))))),
    h('div', { class: 'wp-effects', 'data-slot': 'world-effects' }, effects ? effects(world) : null),
    onChoose ? h('button', {
      type: 'button', class: ['btn', selected ? 'btn-cyan' : 'btn-primary', 'wp-choose'], 'aria-pressed': String(selected),
      onclick: () => onChoose(world),
    }, selected ? `${world.name} chosen` : `Land on ${world.name}`) : null);
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
