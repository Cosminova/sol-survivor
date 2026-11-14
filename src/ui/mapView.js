// Equirectangular planet map stitched from the bundled 8×4 NASA Trek tiles, with landing-site pins.
import { h } from './dom.js';

export const TILE_COLS = 8;
export const TILE_ROWS = 4;
export const tileUrl = (body, row, col) => `./tiles/${body}/${row}_${col}.jpg`;

export const lonLatToPct = (lon, lat) => ({
  x: ((lon + 180) / 360) * 100,
  y: Math.min(97, Math.max(3, ((90 - lat) / 180) * 100)),
});

const formatLat = (lat) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
const formatLon = (lon) => `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
export const formatLatLon = (lat, lon) => `${formatLat(lat)}, ${formatLon(lon)}`;

// mapView({ body, sites, selectedId, onSelect, extraPins: [{lat, lon, label, icon}] })
export function mapView({ body, sites = [], selectedId = null, onSelect, extraPins = [], label }) {
  const tiles = [];
  for (let r = 0; r < TILE_ROWS; r += 1) {
    for (let c = 0; c < TILE_COLS; c += 1) {
      tiles.push(h('img', { src: tileUrl(body, r, c), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }));
    }
  }
  const pins = sites.map((site) => {
    const { x, y } = lonLatToPct(site.lon, site.lat);
    const selected = site.id === selectedId;
    return h('button', {
      type: 'button',
      class: ['map-pin', selected && 'selected'],
      style: { left: `${x}%`, top: `${y}%` },
      'aria-pressed': onSelect ? String(selected) : null,
      'aria-label': `${site.name}, ${formatLatLon(site.lat, site.lon)}`,
      onclick: onSelect ? () => onSelect(site.id) : null,
      tabindex: onSelect ? null : '-1',
    }, h('span', { class: 'map-pin-dot', 'aria-hidden': 'true' }), h('span', { class: 'map-pin-label' }, site.name));
  });
  const extras = extraPins.map((p) => {
    const { x, y } = lonLatToPct(p.lon, p.lat);
    return h('span', { class: 'map-pin extra', style: { left: `${x}%`, top: `${y}%` }, title: p.label },
      h('span', { class: 'map-pin-dot', 'aria-hidden': 'true' }, p.icon ?? ''), h('span', { class: 'map-pin-label' }, p.label));
  });
  return h('div', {
    class: ['map-view', `map-${body}`],
    role: 'group',
    'aria-label': label ?? `${body === 'mars' ? 'Mars' : 'Moon'} map from NASA Trek mosaics`,
  },
  h('div', { class: 'map-tiles', 'aria-hidden': 'true' }, tiles),
  h('div', { class: 'map-graticule', 'aria-hidden': 'true' }),
  pins,
  extras,
  h('span', { class: 'map-credit' }, body === 'mars' ? 'Real NASA data, recorded 1976 to 1980 by the Viking orbiters · NASA Mars Trek map' : 'Real NASA data, recorded from 2009 by the Lunar Reconnaissance Orbiter · NASA Moon Trek map'));
}
