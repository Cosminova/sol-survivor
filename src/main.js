import './styles/index.css';
import { h, mount } from './ui/dom.js';
import { logo } from './ui/logo.js';
import { startRouter } from './ui/router.js';
import { getState, subscribe } from './state/store.js';
import { loadSimContext } from './state/nasaData.js';
import { closeTermPopover } from './ui/components/termPopover.js';
import { stopSpeaking } from './ui/speech.js';

const NAV = [
  ['home', '🏠', 'Home'],
  ['campaign', '🚀', 'Campaign'],
  ['dictionary', '📖', 'Dictionary'],
  ['academy', '🎓', 'Academy'],
  ['datalab', '📊', 'Data Lab'],
  ['tools', '🧭', 'Tools'],
  ['badges', '🏅', 'Badges'],
  ['educators', '🍎', 'Educators'],
];

function applySettings({ settings }) {
  const root = document.documentElement;
  root.dataset.text = settings.textSize;
  root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
}

function buildShell() {
  const links = NAV.map(([route, icon, label]) => h('a', { href: `#/${route}`, 'aria-label': label, dataset: { route } },
    h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'nav-label' }, label)));

  const header = h('header', { class: 'app-header' },
    h('a', { class: 'brand', href: '#/home', 'aria-label': 'Sol Survivor home' }, logo(), h('span', { class: 'brand-name' }, 'Sol ', h('span', null, 'Survivor'))),
    h('nav', { class: 'main-nav', 'aria-label': 'Main' }, links),
    h('div', { class: 'header-actions' },
      h('a', { class: 'btn btn-ghost btn-icon', href: '#/settings', 'aria-label': 'Settings', dataset: { route: 'settings' } }, '⚙️')));

  const view = h('main', { id: 'view', tabindex: '-1' });
  const footer = h('footer', { class: 'app-footer' },
    h('p', null, 'Sol Survivor · NASA Space Apps Challenge 2026 · Seattle. Built with archived NASA data (Curiosity REMS, DONKI, Mars & Moon Trek, NASA Image Library). ',
      h('a', { href: '#/datalab' }, 'Sources & methodology'), '.'),
    h('p', { class: 'faint' }, 'Not an official NASA product. Works offline once loaded.'));
  const live = h('div', { id: 'live-region', class: 'sr-only', 'aria-live': 'polite' });

  mount(document.getElementById('app'), header, view, footer, live);
  return { view, links: [...header.querySelectorAll('[data-route]')] };
}

function highlight(links, name) {
  const section = { loadout: 'campaign', play: 'campaign', debrief: 'campaign', patch: 'badges' }[name] ?? name;
  links.forEach((a) => {
    if (a.dataset.route === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

applySettings(getState());
subscribe(applySettings);
const { view, links } = buildShell();
loadSimContext().catch((err) => console.warn('[data] NASA data failed to load', err));
startRouter(view, {
  onRoute: (route) => {
    closeTermPopover();
    stopSpeaking();
    document.body.dataset.route = route.name;
    highlight(links, route.name);
  },
});
