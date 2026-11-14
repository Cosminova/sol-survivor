// Bundled fonts (no CDN): the game must work offline in classrooms.
import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/800.css';
import './styles/index.css';
import { h, mount } from './ui/dom.js';
import { logo } from './ui/logo.js';
import { icon } from './ui/icons.js';
import { startRouter } from './ui/router.js';
import { getState, subscribe } from './state/store.js';
import { loadSimContext } from './state/nasaData.js';
import { closeTermPopover } from './ui/components/termPopover.js';
import { trapFocus } from './ui/components/modal.js';
import { stopSpeaking } from './ui/speech.js';
import { createStarfield } from './ui/starfield.js';
import { createTicker } from './ui/components/ticker.js';

const NAV = [['campaign', 'Missions'], ['dictionary', 'Dictionary'], ['academy', 'Academy'], ['datalab', 'Data'], ['educators', 'Educators']];
const MENU = [
  ['campaign', 'Missions'], ['loadout/free-play', 'Free Play'], ['dictionary', 'Dictionary'], ['academy', 'Academy'],
  ['datalab', 'Data Lab'], ['tools', 'Mission Tools'], ['badges', 'Badges'], ['educators', 'Educators'], ['settings', 'Settings'],
];
const FOOTER = [
  ['Missions', [['campaign', 'Campaign'], ['loadout/free-play', 'Free Play'], ['debrief', 'Last debrief']]],
  ['Learn', [['dictionary', 'Astronaut Dictionary'], ['academy', 'Academy'], ['badges', 'Badges'], ['patch', 'Patch Designer']]],
  ['Data', [['datalab', 'Data Lab'], ['tools', 'Mission Tools'], ['datalab/methodology', 'Sources & methodology']]],
  ['About', [['educators', 'For Educators'], ['settings', 'Settings']]],
];
const SECTION = { loadout: 'campaign', play: 'campaign', debrief: 'campaign', patch: 'badges' };
// The whole app uses the flight-control HUD theme. data-theme is still set per route so the mechanism keeps working.
const themeFor = () => 'dark';

function applySettings({ settings }) {
  const root = document.documentElement;
  root.dataset.text = settings.textSize;
  root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
}

function mobileMenu(toggle) {
  const sheet = h('div', { class: 'menu-sheet', id: 'menu-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu', hidden: true },
    h('div', { class: 'menu-sheet-head' },
      h('a', { class: 'brand', href: '#/home', 'aria-label': 'Sol Survivor home' }, logo()),
      h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Close menu', onclick: () => close() }, icon('close', { size: 24 }))),
    h('nav', { 'aria-label': 'Menu' }, h('ul', { class: 'menu-sheet-links' },
      MENU.map(([route, label]) => h('li', null, h('a', { href: `#/${route}`, dataset: { route } }, label, icon('arrow-right', { size: 24 })))))));
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else trapFocus(sheet, e);
  };
  function open() {
    sheet.hidden = false;
    document.body.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKey);
    sheet.querySelector('a, button')?.focus();
  }
  function close() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey);
    toggle.focus();
  }
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  toggle.addEventListener('click', open);
  return { sheet, close };
}

function header() {
  const toggle = h('button', { type: 'button', class: 'btn btn-ghost btn-icon nav-toggle', 'aria-label': 'Open menu', 'aria-controls': 'menu-sheet', 'aria-expanded': 'false' }, icon('menu', { size: 24 }));
  const menu = mobileMenu(toggle);
  const strip = h('div', { class: 'utility-strip' },
    h('span', null, 'NASA Space Apps Challenge 2026 · Seattle'),
    h('nav', { 'aria-label': 'Utility' }, h('a', { href: '#/educators' }, 'For Educators'), h('a', { href: '#/datalab/methodology' }, 'Data sources')));
  const bar = h('header', { class: 'site-header' },
    h('div', { class: 'site-header-inner' },
      h('a', { class: 'brand', href: '#/home', 'aria-label': 'Sol Survivor home' }, logo()),
      h('nav', { class: 'main-nav', 'aria-label': 'Main' }, h('ul', null, NAV.map(([route, label]) => h('li', null, h('a', { href: `#/${route}`, dataset: { route } }, label))))),
      h('div', { class: 'header-actions' },
        h('a', { class: 'btn btn-ghost btn-icon', href: '#/badges', 'aria-label': 'Badges and profile', dataset: { route: 'badges' } }, icon('award', { size: 22 })),
        h('a', { class: 'btn btn-ghost btn-icon', href: '#/settings', 'aria-label': 'Settings', dataset: { route: 'settings' } }, icon('settings', { size: 22 })),
        toggle)));
  return { strip, bar, menu };
}

// The header slides away while scrolling down and returns on any scroll up.
function autoHide(bar) {
  let last = window.scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const delta = y - last;
    if (Math.abs(delta) < 6) return;
    const hide = delta > 0 && y > 160 && !document.body.classList.contains('menu-open') && !bar.contains(document.activeElement);
    bar.classList.toggle('is-hidden', hide);
    last = y;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  bar.addEventListener('focusin', () => bar.classList.remove('is-hidden'));
}

function footer() {
  return h('footer', { class: 'site-footer' },
    h('div', { class: 'site-footer-cols' }, FOOTER.map(([title, links]) => h('div', null,
      h('h2', null, title),
      h('ul', null, links.map(([route, label]) => h('li', null, h('a', { href: `#/${route}` }, label))))))),
    h('div', { class: 'site-footer-base' },
      h('p', null, 'Sol Survivor · NASA Space Apps Challenge 2026 · Seattle'),
      h('p', null, 'Built with archived NASA data: Curiosity REMS, DONKI, Mars and Moon Trek, NASA Image Library. Not an official NASA product.')));
}

function buildShell() {
  const { strip, bar, menu } = header();
  const view = h('main', { id: 'view', tabindex: '-1' });
  const live = h('div', { id: 'live-region', class: 'sr-only', 'aria-live': 'polite' });
  const backdrop = h('canvas', { class: 'hud-backdrop', 'aria-hidden': 'true' });
  mount(document.getElementById('app'), backdrop, strip, bar, view, footer(), createTicker(), menu.sheet, live);
  createStarfield(backdrop, { density: 0.00012, shooting: false });
  autoHide(bar);
  return { view, menu, links: [...document.querySelectorAll('#app [data-route]')] };
}

function highlight(links, name) {
  const section = SECTION[name] ?? name;
  links.forEach((a) => {
    if (a.dataset.route === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

applySettings(getState());
subscribe(applySettings);
const { view, menu, links } = buildShell();
loadSimContext().catch((err) => console.warn('[data] NASA data failed to load', err));
startRouter(view, {
  onRoute: (route) => {
    closeTermPopover();
    stopSpeaking();
    menu.close();
    document.body.dataset.route = route.name;
    document.documentElement.dataset.theme = themeFor(route.name);
    highlight(links, route.name);
  },
});
