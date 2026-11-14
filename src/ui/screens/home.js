// Home: cinematic title with starfield and rotating Mars/Moon globes, quick links, Mars clock.
import '../../styles/home.css';
import { h } from '../dom.js';
import { createGlobe } from '../globe.js';
import { createStarfield } from '../starfield.js';
import { marsClock } from '../components/marsClock.js';
import { wordOfSolCard } from '../components/wordOfSol.js';
import { didYouKnow, stars } from '../components/common.js';
import { getState } from '../../state/store.js';
import { CAMPAIGN } from '../../data/missions.js';

const TILES = [
  ['#/dictionary', '📖', 'Astronaut Dictionary', 'Every space word, explained for explorers.'],
  ['#/academy', '🎓', 'Academy', 'Quizzes that test your mission smarts.'],
  ['#/datalab', '📊', 'Data Lab', 'Real Curiosity weather and solar storm data.'],
  ['#/tools', '🧭', 'Mission Tools', 'Mars clock, light delay, your Mars age.'],
  ['#/badges', '🏅', 'Badges & Patch', 'Earn badges and design your mission patch.'],
  ['#/educators', '🍎', 'For Educators', 'Lesson plans aligned to NGSS.'],
];

function continueButton(saved) {
  if (!saved || saved.status !== 'active') return null;
  return h('a', { class: 'btn btn-cyan btn-lg', href: '#/play' }, `▶ Continue: ${saved.config.title} · Sol ${saved.sol}`);
}

function campaignStrip(progress) {
  const total = CAMPAIGN.reduce((sum, ch) => sum + (progress[ch.id]?.stars ?? 0), 0);
  return h('a', { class: 'card home-progress', href: '#/campaign' },
    h('span', { class: 'kicker' }, 'Your campaign'),
    h('div', { class: 'row between' },
      h('strong', null, `${total} / ${CAMPAIGN.length * 3} stars`),
      stars(Math.round((total / (CAMPAIGN.length * 3)) * 3))),
    h('div', { class: 'home-chapters', 'aria-hidden': 'true' }, CAMPAIGN.map((ch) => h('span', {
      class: ['home-chapter-dot', ch.body, (progress[ch.id]?.stars ?? 0) > 0 && 'done'],
      title: ch.title,
    }))));
}

function hero(saved) {
  const sky = h('canvas', { class: 'home-stars', 'aria-hidden': 'true' });
  const mars = h('canvas', { class: 'home-globe', role: 'img', 'aria-label': 'Rotating Mars, made from NASA Viking orbiter images' });
  const moon = h('canvas', { class: 'home-moon', role: 'img', 'aria-label': 'Rotating Moon, made from NASA Lunar Reconnaissance Orbiter images' });
  const el = h('section', { class: 'home-hero' },
    sky,
    h('div', { class: 'home-hero-text' },
      h('span', { class: 'kicker' }, 'NASA Space Apps 2026 · Junior Astronaut Mission Trainer'),
      h('h1', { class: 'home-title' }, 'Sol ', h('span', null, 'Survivor')),
      h('p', { class: 'home-tagline' }, 'Command a base on the Moon or Mars. Balance oxygen, water, food, power and radiation shielding, using real NASA data, one sol at a time.'),
      h('div', { class: 'row home-cta' },
        continueButton(saved),
        h('a', { class: 'btn btn-primary btn-lg', href: '#/campaign' }, '🚀 Play Campaign'),
        h('a', { class: 'btn btn-lg', href: '#/loadout/free-play' }, '🛠️ Free Play')),
      h('div', { class: 'row home-links' },
        h('a', { class: 'chip', href: '#/dictionary' }, '📖 Dictionary'),
        h('a', { class: 'chip', href: '#/academy' }, '🎓 Academy'),
        h('a', { class: 'chip', href: '#/datalab' }, '📊 Data Lab'))),
    h('div', { class: 'home-hero-art' }, h('div', { class: 'home-orbit', 'aria-hidden': 'true' }), mars, moon));
  return { el, sky, mars, moon };
}

export function render(root) {
  const { savedMission, progress } = getState();
  const top = hero(savedMission);
  const clock = marsClock();
  root.append(
    top.el,
    h('div', { class: 'home-grid' }, clock.el, wordOfSolCard(), h('div', { class: 'stack' }, campaignStrip(progress), didYouKnow())),
    h('section', { class: 'home-tiles', 'aria-label': 'Explore' }, TILES.map(([href, icon, title, desc]) => h('a', { class: 'card home-tile', href },
      h('span', { class: 'home-tile-icon', 'aria-hidden': 'true' }, icon),
      h('strong', null, title),
      h('span', { class: 'muted' }, desc)))),
  );
  const size = Math.min(440, Math.max(220, window.innerWidth * 0.36));
  const fx = [
    createStarfield(top.sky),
    createGlobe(top.mars, { body: 'mars', size, tiltDeg: 25, period: 70 }),
    createGlobe(top.moon, { body: 'moon', size: size * 0.3, tiltDeg: 6, period: 40 }),
  ];
  return () => {
    fx.forEach((f) => f.stop());
    clock.stop();
  };
}
