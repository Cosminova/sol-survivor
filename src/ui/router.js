// Hash router. Each screen module exports render(root, { params, query }) and may return a cleanup fn.
const SCREENS = import.meta.glob('./screens/*.js');
const ROUTE_NAMES = ['home', 'campaign', 'loadout', 'play', 'debrief', 'dictionary', 'academy', 'datalab', 'tools', 'badges', 'educators', 'settings', 'patch'];
const ROUTES = Object.fromEntries(ROUTE_NAMES.map((name) => [name, () => {
  const loader = SCREENS[`./screens/${name}.js`];
  return loader ? loader() : Promise.reject(new Error('This part of the station is still under construction.'));
}]));

export const TITLES = {
  home: 'Home', campaign: 'Campaign', loadout: 'Pack the Lander', play: 'Mission Control', debrief: 'Mission Debrief',
  dictionary: 'Astronaut Dictionary', academy: 'Astronaut Academy', datalab: 'Data Lab', tools: 'Mission Tools',
  badges: 'Badges', educators: 'For Educators', settings: 'Settings', patch: 'Mission Patch Designer',
};

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const [name = 'home', ...params] = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: ROUTES[name] ? name : 'home', params, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export const navigate = (path) => { location.hash = `#/${path.replace(/^#?\/?/, '')}`; };

export function startRouter(view, { onRoute } = {}) {
  let cleanup = null;
  let token = 0;

  async function render() {
    const route = parseHash();
    const mine = ++token;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch (err) { console.warn('[router] cleanup failed', err); }
    }
    cleanup = null;
    onRoute?.(route);
    try {
      const mod = await ROUTES[route.name]();
      if (mine !== token) return;
      view.replaceChildren();
      view.className = '';
      view.style.animation = 'none';
      void view.offsetWidth;
      view.style.animation = '';
      cleanup = await mod.render(view, route);
      document.title = `${TITLES[route.name]} · Sol Survivor`;
      window.scrollTo({ top: 0 });
      view.focus({ preventScroll: true });
    } catch (err) {
      console.error('[router] screen failed', err);
      if (mine !== token) return;
      view.replaceChildren();
      const box = document.createElement('div');
      box.className = 'panel empty';
      box.innerText = `🛰️ Lost signal loading this screen. ${err.message}`;
      view.append(box);
    }
  }

  window.addEventListener('hashchange', render);
  render();
  return () => window.removeEventListener('hashchange', render);
}
