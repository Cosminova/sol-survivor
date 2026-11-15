// Demo mode: a hands-free tour of about two minutes for showing Sol Survivor to judges and classes. It drives the
// real screens (clicks real buttons, runs the real engine), with a caption bar explaining each step and a glow on
// what it is talking about. The player's own save is copied first and put back when the demo ends, and first-run
// pop-ups and tours are switched off for the demo only. Escape or Exit demo ends it at any time.
import { h, announce } from '../dom.js';
import { navigate } from '../router.js';

const POLL_MS = 200;
const WAIT_MS = 15000;
const SAVE_PREFIX = 'sol-survivor';
const QUIET_FLAGS = ['howto-seen', 'tutorial-done', 'tour-outpost', 'tour-map', 'tour-walk', 'walk-switch-learned'];

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

/**
 * The demo script: every main screen, with time spent only on the key features. About two minutes.
 * Each step drives the app, then holds while its caption is read. Exported for tests.
 */
export const DEMO_STEPS = [
  {
    id: 'home', caption: 'Sol Survivor: a Moon and Mars outpost game for young astronauts, built on real NASA data. This is today’s real Sun, live from NASA DONKI.',
    async run(t) {
      navigate('home');
      await t.waitFor('.hero-sun .live-sun:not(.is-loading)', { timeout: 6000 }).catch(() => null);
      const card = await t.waitFor('.hero-sun');
      card.scrollIntoView({ block: 'center' });
      t.spot(card);
      await t.hold(6000);
    },
  },
  {
    id: 'campaign', caption: 'The campaign: chapters on the Moon and Mars, each one replaying real solar storms and real Mars weather.',
    async run(t) { await page(t, 'campaign', 5000, '.camp-node-btn'); },
  },
  {
    id: 'sky', caption: 'Choose your world from a real night sky (inspired by Cosminova). Rings mark stars with rocky planets from NASA’s Exoplanet Archive.',
    async run(t) {
      navigate('loadout/free-play');
      await t.click('button', 'Cosminova sky');
      const sky = await t.waitFor('.wp-stage');
      sky.scrollIntoView({ block: 'center' });
      t.spot(sky);
      await t.hold(5000);
    },
  },
  {
    id: 'trappist', caption: 'Fly to TRAPPIST-1: seven rocky planets. Every fact says Real (NASA) or Generated (a game guess where nobody has measured it).',
    async run(t) {
      await t.click('.wp-target[data-target="star:TRAPPIST-1"]');
      const strip = await t.waitFor('.wp-system-portrait', { timeout: 10000 });
      strip.scrollIntoView({ block: 'start' });
      t.spot(strip);
      await t.hold(5000);
      await t.click('button', 'Visit TRAPPIST-1 e');
      const globe = await t.waitFor('.wp-planet-grid');
      globe.scrollIntoView({ block: 'start' });
      t.spot(globe);
      await t.hold(6000);
    },
  },
  {
    id: 'titan', caption: 'Or Titan: thick air, methane lakes, −179 °C. The engine changes power, heat, radiation and events on every world.',
    async run(t) {
      await t.click('.wp-back');
      await t.click('.wp-back');
      await t.click('.wp-target[data-target="saturn"]');
      await t.click('button', 'Visit Titan', { timeout: 10000 });
      const card = await t.waitFor('.wp-planet-grid');
      card.scrollIntoView({ block: 'start' });
      t.spot(card);
      await t.hold(5000);
    },
  },
  {
    id: 'pack', caption: 'Pack the lander under a weight limit. Mission Control’s pack uses the engine’s own numbers.',
    async run(t) {
      await t.click('button', 'Use recommended');
      const launch = await t.waitFor('.lo-launch');
      t.spot(launch);
      await t.hold(3500);
      await t.click('.lo-launch');
      await t.waitFor('#next-sol', { timeout: 20000 });
    },
  },
  {
    id: 'play', caption: 'Each day: keep Air, Power and Shield safe, pick one plan, and see the trade-off before you commit.',
    async run(t) {
      t.spot(await t.waitFor('.kid-meters'));
      await t.hold(4500);
      await t.click('#plan-explore');
      t.spot(await t.waitFor('#plan-preview'));
      await t.hold(4500);
      await t.nextDay();
      t.spot(await t.waitFor('.kid-meters'));
      await t.hold(3500);
    },
  },
  {
    id: 'walk', caption: 'Walk 3D: go outside as an astronaut and do jobs by hand. Every world gets its own generated ground and sky.',
    async run(t) {
      await t.click('.view-toggle [data-view="walk"]');
      t.spot(await t.waitFor('.walk-world canvas', { timeout: 15000 }));
      await t.hold(14000);
      await t.click('.walk-back');
    },
  },
  {
    id: 'views', caption: 'Three views of the same base: the flat Map 2D, and Outpost 3D zoomed out to the whole camp.',
    async run(t) {
      await t.click('.view-toggle [data-view="map"]');
      t.spot(await t.waitFor('.play-stage'));
      await t.hold(5000);
      await t.click('.view-toggle [data-view="outpost"]');
      await t.click('[aria-label="Zoom out to see the whole camp"]');
      await t.hold(6000);
    },
  },
  {
    id: 'datalab', caption: 'Data Lab: the real NASA records behind the game. Solar flares, storms and Curiosity’s Mars weather, with sources.',
    async run(t) { await page(t, 'datalab', 6000, '.dl-tabs, #view .panel'); },
  },
  {
    id: 'dictionary', caption: 'Astronaut Dictionary: every space word in plain language, with flashcards.',
    async run(t) { await page(t, 'dictionary', 4000); },
  },
  {
    id: 'academy', caption: 'Academy: quizzes on survival and science, at three difficulty levels.',
    async run(t) { await page(t, 'academy', 4000); },
  },
  {
    id: 'badges', caption: 'Badges and a mission patch designer reward kids for what they learn.',
    async run(t) {
      await page(t, 'badges', 3000);
      await page(t, 'patch', 3000);
    },
  },
  {
    id: 'educators', caption: 'For educators: lesson plans, classroom guides and standards links, so teachers can run it in class.',
    async run(t) { await page(t, 'educators', 4500); },
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

  // The caption bar sits bottom-left; if that would cover what the tour points at, it moves bottom-right.
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  function dodge() {
    bar.classList.remove('demo-bar-right');
    if (spotted && overlaps(bar.getBoundingClientRect(), spotted.getBoundingClientRect())) bar.classList.add('demo-bar-right');
  }

  const check = () => {
    if (stopped) throw new DemoStopped();
    if (skip) { skip = false; throw new StepSkipped(); }
  };
  const tick = () => new Promise((r) => window.setTimeout(r, POLL_MS));

  const t = {
    async hold(ms) {
      let left = ms;
      while (left > 0) {
        check();
        await tick();
        if (!paused) left -= POLL_MS;
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
    async nextDay() {
      await t.click('#next-sol');
      const stepCaption = caption.textContent;
      for (let i = 0; i < 2; i += 1) {
        await t.hold(600);
        const card = document.querySelector('.event-modal');
        if (!visible(card)) break;
        caption.textContent = 'An event! Many are real NASA records, like solar storms from 2024. The crew has to choose.';
        t.spot(card);
        await t.hold(5000);
        await t.click('.event-modal .event-choice:not([disabled])');
        await t.hold(3000);
        await t.click('.event-modal [data-autofocus]');
      }
      caption.textContent = stepCaption;
    },
  };

  async function play() {
    for (let i = 0; i < DEMO_STEPS.length; i += 1) {
      const step = DEMO_STEPS[i];
      counter.textContent = `${i + 1} of ${DEMO_STEPS.length}`;
      caption.textContent = step.caption;
      announce(step.caption);
      try {
        await step.run(t);
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
