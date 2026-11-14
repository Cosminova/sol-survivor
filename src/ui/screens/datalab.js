// Data Lab: explore the real NASA data behind Sol Survivor. Tabs persist in #/datalab?tab=…
import '../../styles/datalab.css';
import { h, mount, announce } from '../dom.js';
import { renderWeather } from './datalab/weather.js';
import { renderStorms } from './datalab/storms.js';
import { renderRadiation } from './datalab/radiation.js';
import { renderTimeline } from './datalab/timeline.js';
import { renderMaps } from './datalab/maps.js';
import { renderGallery } from './datalab/gallery.js';
import { renderCompare } from './datalab/compare.js';
import { renderMethodology } from './datalab/methodology.js';

const TABS = [
  { id: 'weather', icon: '🌡️', label: 'Mars Weather', render: renderWeather },
  { id: 'storms', icon: '☀️', label: 'Space Weather', render: renderStorms },
  { id: 'radiation', icon: '☢️', label: 'Radiation', render: renderRadiation },
  { id: 'timeline', icon: '🕰️', label: 'Timeline', render: renderTimeline },
  { id: 'maps', icon: '🗺️', label: 'Map Explorer', render: renderMaps },
  { id: 'gallery', icon: '📷', label: 'Gallery', render: renderGallery },
  { id: 'compare', icon: '🪐', label: 'Compare Worlds', render: renderCompare },
  { id: 'sources', icon: '📚', label: 'Sources', render: renderMethodology },
];

const tabById = (id) => TABS.find((t) => t.id === id) ?? TABS[0];

function rememberTab(id) {
  const next = `#/datalab?tab=${encodeURIComponent(id)}`;
  if (location.hash !== next) history.replaceState(history.state, '', next);
}

export function render(root, route) {
  let active = tabById(route?.query?.tab).id;
  let sectionCleanup = null;
  const panel = h('section', { class: 'dl-panel', id: 'dl-panel', tabindex: '-1' });
  const tabs = h('div', { class: 'tabs dl-tabs', role: 'group', 'aria-label': 'Data Lab sections' });

  const drawTabs = () => mount(tabs, TABS.map((t) => h('button', {
    type: 'button',
    class: 'chip dl-tab',
    'aria-pressed': String(t.id === active),
    'aria-controls': 'dl-panel',
    onclick: () => select(t.id, true),
  }, h('span', { 'aria-hidden': 'true' }, t.icon), t.label)));

  const select = (id, userAction = false) => {
    const tab = tabById(id);
    active = tab.id;
    try { sectionCleanup?.(); } catch (err) { console.warn('[datalab] cleanup failed', err); }
    drawTabs();
    panel.setAttribute('aria-label', tab.label);
    const result = tab.render(panel);
    sectionCleanup = typeof result === 'function' ? result : null;
    rememberTab(tab.id);
    if (userAction) {
      tabs.querySelector('[aria-pressed="true"]')?.focus();
      announce(`${tab.label} section`);
    }
  };

  mount(root,
    h('div', { class: 'dl-screen' },
      h('header', { class: 'screen-head dl-hero' },
        h('div', null,
          h('span', { class: 'kicker' }, '📊 Real NASA data'),
          h('h1', null, 'Data Lab'),
          h('p', null, 'Everything in Sol Survivor comes from real missions. Dig into the same weather, solar storms, maps and photos that NASA scientists use.')),
        h('div', { class: 'dl-hero-chips', 'aria-hidden': 'true' },
          h('span', null, '🛰️ REMS'), h('span', null, '☀️ DONKI'), h('span', null, '☢️ RAD'), h('span', null, '🗺️ Trek'), h('span', null, '📷 Images'))),
      tabs,
      panel));
  select(active);

  return () => {
    try { sectionCleanup?.(); } catch (err) { console.warn('[datalab] cleanup failed', err); }
  };
}
