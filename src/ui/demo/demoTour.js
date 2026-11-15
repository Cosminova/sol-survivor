// Demo mode: a hands-free tour of about two minutes for showing Sol Survivor to judges and classes. It drives the
// real screens (clicks real buttons, runs the real engine), with a caption bar explaining each step and a glow on
// what it is talking about. The player's own save is copied first and put back when the demo ends, and first-run
// pop-ups and tours are switched off for the demo only. Escape or Exit demo ends it at any time.
import { h, announce } from '../dom.js';
import { navigate } from '../router.js';
import { walkAndWork } from './walkDemo.js';

const POLL_MS = 200;
const WAIT_MS = 15000;
const SAVE_PREFIX = 'sol-survivor';
const QUIET_FLAGS = ['howto-seen', 'tutorial-done', 'tour-outpost', 'tour-map', 'tour-walk', 'walk-switch-learned'];
// Pop-ups the tour does not open on purpose (day results, found artifacts, rock facts) get this long on screen,
// then the tour closes them, so nothing is ever left waiting for a click.
const STRAY_MS = 3000;
const STRAY = ['.effect-pop .effect-pop-close', '.w3d-modal:not(.w3d-summary):not(.w3d-mg-modal) .w3d-primary'];

class DemoStopped extends Error {}
class StepSkipped extends Error {}

const visible = (el) => Boolean(el) && (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0);

// Visit a screen and point at its main content for a few seconds.
async function page(t, route, ms, focus = '#view .panel, #view h1') {
  navigate(route);
  const el = await t.waitFor(focus);
  window.scrollTo({ top: 0 });
  t.spot(el);
  await t.hold(ms);
}

// Captions for the training mission's coach steps, saying which part of the challenge each one shows.
const TRAINING_CAPTIONS = {
  welcome: 'Training mission on the Moon: keep four astronauts alive for three days, with just three core resources: Air, Power and Shield.',
  meters: 'Air, Power and Shield. Tap any one to see the real numbers behind it.',
  explore: 'Each day the crew follows one plan. Exploring finds science, but walking outside burns extra oxygen. No choice is free.',
  'air-cost': 'Each day the crew follows one plan. Exploring finds science, but walking outside burns extra oxygen. No choice is free.',
  'next-1': 'Each day the crew follows one plan. Exploring finds science, but walking outside burns extra oxygen. No choice is free.',
  shield: 'Building the radiation shield protects the crew, but costs a whole day of science.',
  'shield-cost': 'Building the radiation shield protects the crew, but costs a whole day of science.',
  'next-2': 'Building the radiation shield protects the crew, but costs a whole day of science.',
  'real-sun': 'The game links to the real Sun today, live from NASA’s DONKI space weather service.',
  storm: 'A real solar storm from 9 October 2024, from NASA DONKI. Shelter, partial cover or keep working: every option costs something.',
  'keep-going': 'A real solar storm from 9 October 2024, from NASA DONKI. Shelter, partial cover or keep working: every option costs something.',
  switch: 'Night falls: not enough power for every machine. Switching one off saves power but stops what it makes. That is power budgeting.',
  'power-cost': 'Night falls: not enough power for every machine. Switching one off saves power but stops what it makes. That is power budgeting.',
  'next-3': 'Last day of training.',
};

// Drives the real training walkthrough: reads the coach's current step and does what it asks.
async function playTraining(t, setCaption) {
  const coach = () => document.querySelector('.coach');
  await t.waitFor('.coach', { timeout: 15000 });
  for (let guard = 0; guard < 40 && coach(); guard += 1) {
    const { step, kind, target } = coach().dataset;
    setCaption(TRAINING_CAPTIONS[step] ?? '');
    if (kind === 'read') {
      if (step === 'real-sun') { await t.click('.coach-more'); await t.hold(5200); } else await t.hold(3800);
      await t.click('.coach-next');
    } else {
      // the storm choice and the night switch-off are the heart of the trade-off: give them time to be read
      await t.hold(step === 'storm' || step === 'switch' ? 5200 : 2600);
      if (step === 'storm') await t.click('.event-modal .event-choice:not([disabled])');
      else if (step === 'keep-going') await t.click('.event-modal [data-autofocus]');
      else if (step === 'switch') await t.click('#kid-switchboard .kid-switch.on:not([disabled])');
      else await t.click(target);
    }
    // wait for the coach to move on (or finish)
    for (let i = 0; i < 40 && coach()?.dataset.step === step; i += 1) await t.hold(200);
  }
}

/**
 * The demo script, built around the NASA Space Apps challenge: real trade-offs (air, power, shielding, food,
 * communication delay), real NASA data (DONKI, OSDR, Curiosity, lidar) with attribution, plain language, the
 * Cadet and Expert views, classroom use, replayability and worlds beyond the Moon and Mars. About two and a half
 * minutes. Exported for tests.
 */
export const DEMO_STEPS = [
  {
    id: 'home', caption: 'Sol Survivor: a Moon and Mars outpost game for ages 7 to 12. Free in the browser, no download or account. This is today’s real Sun, live from NASA DONKI.',
    async run(t) {
      navigate('home');
      await t.waitFor('.hero-sun .live-sun:not(.is-loading)', { timeout: 6000 }).catch(() => null);
      const card = await t.waitFor('.hero-sun');
      card.scrollIntoView({ block: 'center' });
      t.spot(card);
      await t.hold(5500);
    },
  },
  {
    id: 'training', caption: TRAINING_CAPTIONS.welcome,
    async run(t, setCaption) {
      t.spot(null);
      navigate('play?tutorial=1');
      await playTraining(t, setCaption);
      setCaption('The debrief sums up the trade-offs. Failing is fine: every mission can be replayed, and events change between playthroughs.');
      t.spot(await t.waitFor('.tutorial-recap', { timeout: 8000 }));
      await t.hold(5000);
      t.spot(null);
      await t.click('.tutorial-recap .modal-close'); // close it, or it stays over the next screens
    },
  },
  {
    id: 'osdr', caption: 'Data Lab: live NASA DONKI events and Curiosity weather, plus real astronaut-health findings from NASA’s OSDR, each labelled live or saved.',
    async run(t) {
      navigate('datalab');
      const health = await t.waitFor('.dl-live-health', { timeout: 15000 });
      health.scrollIntoView({ block: 'center' });
      t.spot(health);
      await t.hold(7000);
    },
  },
  {
    id: 'live-mission', caption: 'Today’s Real Sun: a Mars mission whose storm forecast comes from NASA’s live data. Radio messages to Earth take minutes from Mars.',
    async run(t, setCaption) {
      const launch = await t.waitFor('#dl-live-launch-mars');
      launch.scrollIntoView({ block: 'center' });
      t.spot(launch);
      await t.hold(3200);
      launch.click();
      await t.waitFor('#next-sol', { timeout: 20000 });
      t.spot(await t.waitFor('.ticker'));
      await t.hold(5000);
      setCaption('Food production: the greenhouse grows food but uses power and water. A Grow food day speeds it up, at the cost of science.');
      t.spot(await t.waitFor('#plan-grow, #kid-plans, .kid-today', { timeout: 4000 }).catch(() => null));
      await t.hold(5200);
    },
  },
  {
    id: 'walk', caption: 'Walk 3D: go outside and do jobs by hand. The Mars ground is built from NASA laser-altimeter data around the landing site.',
    async run(t, setCaption) {
      await t.click('.view-toggle [data-view="walk"]');
      t.spot(await t.waitFor('.walk-world canvas', { timeout: 15000 }));
      try {
        await walkAndWork(t, setCaption);
      } finally {
        await t.closeWalkDialogs();
        await t.click('.walk-back', null, { timeout: 4000 }).catch(() => null);
      }
    },
  },
  {
    id: 'views', caption: 'The same base as a flat Map 2D, and as Outpost 3D zoomed out to the whole camp.',
    async run(t) {
      await t.click('.view-toggle [data-view="map"]');
      t.spot(await t.waitFor('.play-stage'));
      await t.hold(3800);
      await t.click('.view-toggle [data-view="outpost"]');
      await t.click('[aria-label="Zoom out to see the whole camp"]');
      await t.hold(4300);
    },
  },
  {
    id: 'expert', caption: 'Expert view for older siblings, parents and classes: every number, the full power budget and radiation dose in millisieverts.',
    async run(t) {
      await t.click('#view-switch');
      t.spot(await t.waitFor('#view'));
      await t.hold(5800);
      await t.click('#view-switch');
    },
  },
  {
    id: 'sky', caption: 'Beyond the Moon and Mars: pick any rocky world from a real night sky (with our partner project Cosminova), from NASA’s Exoplanet Archive.',
    async run(t) {
      navigate('loadout/free-play');
      await t.click('button', 'Cosminova sky');
      const sky = await t.waitFor('.wp-stage');
      sky.scrollIntoView({ block: 'center' });
      t.spot(sky);
      await t.hold(4700);
      await t.click('.wp-target[data-target="star:TRAPPIST-1"]');
      await t.click('button', 'Visit TRAPPIST-1 e', { timeout: 10000 });
      const globe = await t.waitFor('.wp-planet-grid');
      globe.scrollIntoView({ block: 'start' });
      t.spot(globe);
      await t.hold(6000);
    },
  },
  {
    id: 'words', caption: 'Plain language: every science word, like sol or radiation dose, has a short kid-friendly explanation, plus flashcards and quizzes.',
    async run(t) {
      await page(t, 'dictionary', 3000);
      await page(t, 'academy', 3000);
    },
  },
  {
    id: 'educators', caption: 'For classrooms: printable lessons, NGSS links, and one mission code so the whole class plays the same mission.',
    async run(t) { await page(t, 'educators', 4500); },
  },
  {
    id: 'sources', caption: 'Every dataset is credited inside the game: DONKI, OSDR, Curiosity REMS, NASA Trek imagery, LRO and MGS lidar, and the Exoplanet Archive.',
    async run(t) { await page(t, 'datalab/methodology', 6000); },
  },
];

/** Copy of every Sol Survivor key in localStorage, so the demo leaves the player's own save untouched. */
export function snapshotSave(storage = localStorage) {
  try {
    return Object.keys(storage).filter((k) => k.startsWith(SAVE_PREFIX)).map((k) => [k, storage.getItem(k)]);
  } catch { return null; }
}

export function restoreSave(snapshot, storage = localStorage) {
  if (!snapshot) return;
  try {
    for (const k of Object.keys(storage)) if (k.startsWith(SAVE_PREFIX)) storage.removeItem(k);
    for (const [k, v] of snapshot) storage.setItem(k, v);
  } catch { /* storage unavailable: nothing was saved by the demo either */ }
}

function quietFirstRun() {
  try { for (const f of QUIET_FLAGS) localStorage.setItem(`${SAVE_PREFIX}:${f}`, '1'); } catch { /* storage unavailable */ }
}

let current = null;

export const demoRunning = () => Boolean(current);

export function startDemo() {
  if (current) return;
  const snapshot = snapshotSave();
  quietFirstRun();
  current = runDemo(snapshot);
}

function runDemo(snapshot) {
  let paused = false;
  let stopped = false;
  let skip = false;
  let spotted = null;

  const caption = h('p', { class: 'demo-caption', 'aria-live': 'polite' });
  const counter = h('span', { class: 'demo-count' });
  const pauseBtn = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { paused = !paused; pauseBtn.textContent = paused ? 'Resume' : 'Pause'; } }, 'Pause');
  const skipBtn = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { skip = true; } }, 'Next step');
  const stopBtn = h('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: () => end() }, 'Exit demo');
  const bar = h('div', { class: 'demo-bar', role: 'region', 'aria-label': 'Demo mode' },
    h('div', { class: 'demo-head' }, h('span', { class: 'demo-badge' }, 'Demo mode'), counter),
    caption,
    h('div', { class: 'demo-actions' }, pauseBtn, skipBtn, stopBtn));
  document.body.append(bar);
  document.body.classList.add('demo-on');
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); } };
  document.addEventListener('keydown', onKey, true);

  // The caption bar sits bottom-left. If that covers what the tour points at, it tries bottom-right, then the top
  // corners, and keeps whichever covers the least (a centred dialog fills both bottom corners).
  const PLACES = [[], ['demo-bar-right'], ['demo-bar-top', 'demo-bar-right'], ['demo-bar-top']];
  const ALL_PLACE_CLASSES = ['demo-bar-right', 'demo-bar-top'];
  const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  function dodge() {
    const target = spotted?.getBoundingClientRect();
    let best = { place: PLACES[0], area: Infinity };
    for (const place of PLACES) {
      bar.classList.remove(...ALL_PLACE_CLASSES);
      bar.classList.add(...place);
      const area = target ? overlapArea(bar.getBoundingClientRect(), target) : 0;
      if (area < best.area) best = { place, area };
      if (area === 0) break;
    }
    bar.classList.remove(...ALL_PLACE_CLASSES);
    bar.classList.add(...best.place);
  }

  const check = () => {
    if (stopped) throw new DemoStopped();
    if (skip) { skip = false; throw new StepSkipped(); }
  };
  const tick = () => new Promise((r) => window.setTimeout(r, POLL_MS));

  // Closes pop-ups the tour did not open on purpose once they have been on screen for STRAY_MS.
  const strayFirstSeen = new WeakMap();
  function sweepStray() {
    const now = Date.now();
    for (const sel of STRAY) {
      for (const btn of document.querySelectorAll(sel)) {
        if (!visible(btn)) continue;
        if (!strayFirstSeen.has(btn)) strayFirstSeen.set(btn, now);
        else if (now - strayFirstSeen.get(btn) >= STRAY_MS) btn.click();
      }
    }
  }

  const t = {
    async hold(ms) {
      let left = ms;
      while (left > 0) {
        check();
        await tick();
        if (!paused) { left -= POLL_MS; sweepStray(); }
      }
    },
    async waitFor(selector, { text = null, timeout = WAIT_MS } = {}) {
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        check();
        const el = [...document.querySelectorAll(selector)].find((e) => visible(e) && (!text || e.textContent.includes(text)));
        if (el) return el;
        await tick();
      }
      throw new Error(`demo: nothing matched ${selector}${text ? ` "${text}"` : ''}`);
    },
    async click(selector, text = null, opts = {}) {
      const el = await t.waitFor(selector, { text, ...opts });
      el.scrollIntoView?.({ block: 'nearest' });
      el.click();
      await tick();
    },
    spot(el) {
      spotted?.classList.remove('demo-spot');
      spotted = el ?? null;
      spotted?.classList.add('demo-spot');
      spotted?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      window.setTimeout(dodge, 450); // after the smooth scroll settles
    },
    // Next day, answering any event card with its first available choice so the tour keeps moving.
    // Answers any event card that opens (first available choice) so the tour keeps moving.
    async answerEvents() {
      const stepCaption = caption.textContent;
      for (let i = 0; i < 2; i += 1) {
        await t.hold(800);
        const card = document.querySelector('.event-modal');
        if (!visible(card)) break;
        caption.textContent = 'An event! Many are real NASA records, like solar storms from 2024. The crew has to choose.';
        t.spot(card);
        await t.hold(5500);
        await t.click('.event-modal .event-choice:not([disabled])');
        await t.hold(3500);
        await t.click('.event-modal [data-autofocus]');
      }
      t.spot(null);
      caption.textContent = stepCaption;
    },
    // Next day, answering any event card with its first available choice so the tour keeps moving.
    async nextDay() {
      await t.click('#next-sol');
      await t.answerEvents();
    },
    // Closes any open Walk 3D dialog (after showing it for showMs), using its own main button.
    async closeWalkDialogs(showMs = 0) {
      for (let i = 0; i < 3; i += 1) {
        const btn = document.querySelector('.w3d-modal:not(.w3d-mg-modal) .w3d-primary');
        if (!visible(btn)) return;
        if (showMs) await t.hold(showMs);
        btn.click();
        await tick();
      }
    },
  };

  async function play() {
    for (let i = 0; i < DEMO_STEPS.length; i += 1) {
      const step = DEMO_STEPS[i];
      counter.textContent = `${i + 1} of ${DEMO_STEPS.length}`;
      caption.textContent = step.caption;
      announce(step.caption);
      try {
        await step.run(t, (text) => { caption.textContent = text; });
      } catch (err) {
        if (err instanceof DemoStopped) return;
        if (!(err instanceof StepSkipped)) console.warn('[demo] step skipped:', step.id, err.message);
      }
    }
    t.spot(null);
    counter.textContent = 'Done';
    caption.textContent = 'That is Sol Survivor: real NASA data, real trade-offs, and any rocky world you can see in the sky.';
    skipBtn.replaceWith(h('button', { type: 'button', class: 'btn btn-sm', onclick: () => end(true) }, 'Watch again'));
    pauseBtn.remove();
  }

  // Ends the demo: the player's own save comes back and the app reloads so nothing from the demo lingers.
  function end(again = false) {
    if (stopped) return;
    stopped = true;
    document.removeEventListener('keydown', onKey, true);
    restoreSave(snapshot);
    window.location.hash = again ? '#/?demo=1' : '#/';
    window.location.reload();
  }

  play();
  return { end };
}

/** Starts the demo when the address asks for it (#/?demo=1 on any screen), for a link judges can open. */
export function maybeStartDemoFromUrl() {
  if (/[?&]demo=1(?:&|$)/.test(window.location.hash)) startDemo();
}
