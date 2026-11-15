// Landing page: full-bleed hero, large photo panels, one editorial panel. Deliberately light on data.
import '../../styles/home.css';
import { h } from '../dom.js';
import { getState } from '../../state/store.js';
import { icon } from '../icons.js';
import { tutorialDone, TUTORIAL_ROUTE } from '../tutorial/tutorial.js';
import { onLive } from '../../live/liveData.js';
import { liveSunCard } from '../live/liveSun.js';

const img = (file) => `./images/${file}`;

const CAMPAIGNS = [
  { href: '#/campaign', file: 'PIA14838.jpg', alt: 'Artist concept of the Curiosity rover being lowered to the surface of Mars', kicker: 'Mars missions', title: 'Red dust, real storms.', cta: 'Play Mars' },
  { href: '#/campaign', file: '11_03_24_artemis_3_on_surface.jpg', alt: 'Artist concept of a Starship lander on the Moon with Earth in the sky', kicker: 'Moon missions', title: 'Fourteen days of night.', cta: 'Play Moon' },
];

const EXPLORE = [
  { href: '#/dictionary', file: 'as11-40-5903.jpg', alt: 'Buzz Aldrin standing on the Moon during Apollo 11', title: 'Space words', cta: 'Look it up' },
  { href: '#/academy', file: '09_24_24_First_steps_Axiom_suits.jpg', alt: 'Artist concept of two astronauts in Artemis suits stepping onto the Moon', title: 'Quizzes', cta: 'Start training' },
  { href: '#/datalab', file: 'PIA10789.jpg', alt: 'Dust storms swirling near the north pole of Mars, seen from orbit', title: 'Real NASA data', cta: 'See the data' },
];

const QUICK = '#/loadout/artemis-dawn?quick=1';
const TRAINING = `#/${TUTORIAL_ROUTE}`;

// First visit: the big button starts the training walkthrough. After that it is simply "Play".
function cta(saved) {
  if (!tutorialDone()) {
    return [
      h('a', { class: 'btn btn-light btn-lg btn-caps kid-play-now', id: 'play-now', href: TRAINING }, icon('play', { size: 22 }), 'Start training'),
      h('a', { class: 'btn btn-outline-light btn-lg', id: 'skip-training', href: QUICK }, 'Skip to a mission'),
    ];
  }
  const going = saved?.status === 'active';
  return [
    h('a', { class: 'btn btn-light btn-lg btn-caps kid-play-now', id: 'play-now', href: going ? '#/play' : QUICK }, icon('play', { size: 22 }), 'Play'),
    h('a', { class: 'btn btn-outline-light btn-lg', id: 'replay-training', href: TRAINING }, icon('lightbulb', { size: 20 }), 'Tutorial'),
    h('a', { class: 'btn btn-ghost btn-lg', href: '#/campaign' }, 'All missions'),
  ];
}

function hero(saved, sunSlot) {
  const first = !tutorialDone();
  return h('section', { class: 'hero' },
    h('img', { class: 'hero-img', src: img('PIA23302.jpg'), alt: 'Artist concept of astronauts and habitats on the surface of Mars', fetchpriority: 'high' }),
    h('div', { class: 'hero-copy hud-frame' },
      h('p', { class: 'hero-kicker' }, icon('orbit', { size: 18 }), 'Junior Astronaut Mission Trainer'),
      h('h1', { class: 'hero-title' }, 'Survive Mars.'),
      h('p', { class: 'hero-lede' }, 'Run a base on the Moon or Mars. Keep your crew safe, one day at a time.'),
      h('div', { class: 'row hero-cta' }, cta(saved)),
      h('p', { class: 'hero-note' }, first ? 'Training takes about three minutes. Free, in your browser, no account.' : 'Free. Plays in your browser. No download and no account.'),
      sunSlot),
    h('p', { class: 'hero-credit' }, 'Image: NASA, First Humans on Mars (artist concept)'));
}

function resume(saved) {
  if (!saved || saved.status !== 'active') return null;
  const unit = saved.config.body === 'mars' ? 'Sol' : 'Day';
  return h('section', { class: 'home-resume', 'aria-label': 'Mission in progress' },
    h('p', null, h('strong', null, saved.config.title), ` · ${unit} ${saved.sol} of ${saved.config.targetSols}`),
    h('a', { class: 'btn btn-primary', href: '#/play' }, 'Keep playing'));
}

function photoTile({ href, file, alt, kicker, title, cta }, size) {
  return h('a', { class: ['tile', size], href },
    h('img', { src: img(file), alt, loading: 'lazy' }),
    h('span', { class: 'tile-copy' },
      kicker ? h('span', { class: 'tile-kicker' }, kicker) : null,
      h('span', { class: 'tile-title' }, title),
      h('span', { class: 'btn btn-light tile-btn' }, cta)));
}

function section(title, ...children) {
  return h('section', { class: 'home-section' }, h('h2', { class: 'home-section-title' }, title), ...children);
}

function editorial() {
  return h('section', { class: 'editorial' },
    h('img', { src: img('art002e009282.jpg'), alt: 'Shadows across Vavilov crater on the Moon, photographed by the Artemis II crew', loading: 'lazy' }),
    h('div', { class: 'editorial-copy hud-frame' },
      h('h2', { class: 'editorial-title' }, 'Built on real NASA data.'),
      h('p', null, 'The Mars weather was measured by the Curiosity rover. The solar storms come from NASA’s DONKI storm list. The maps come from NASA’s Mars Trek and Moon Trek. All of it is saved from NASA records, not live.'),
      h('a', { class: 'btn btn-light', href: '#/datalab' }, 'See the sources')));
}

export function render(root) {
  root.classList.add('view-bleed');
  const saved = getState().savedMission;
  // The real Sun today, from the live NASA data layer (falls back to its archive when offline).
  const sunSlot = h('div', { class: 'hero-sun' }, liveSunCard(null, { compact: true }));
  const stopLive = onLive((live) => { if (sunSlot.isConnected) sunSlot.replaceChildren(liveSunCard(live, { compact: true })); });
  root.append(...[
    hero(saved, sunSlot),
    resume(saved),
    section('Choose your world', h('div', { class: 'tile-grid two' }, CAMPAIGNS.map((t) => photoTile(t, 'tall')))),
    editorial(),
    section('Learn like an astronaut', h('div', { class: 'tile-grid three' }, EXPLORE.map((t) => photoTile(t, 'square')))),
    h('section', { class: 'home-closer' },
      h('h2', { class: 'home-closer-title' }, 'Your outpost. Your call.'),
      h('div', { class: 'row' },
        tutorialDone()
          ? h('a', { class: 'btn btn-primary btn-lg btn-caps', href: QUICK }, icon('play', { size: 18 }), 'Play')
          : h('a', { class: 'btn btn-primary btn-lg btn-caps', href: TRAINING }, icon('play', { size: 18 }), 'Start training'),
        h('a', { class: 'btn btn-lg', href: '#/educators' }, 'For teachers and parents'))),
  ].filter(Boolean));
  return () => stopLive?.();
}
