// Demo tour, Walk 3D step: the astronaut walks to a station, does the job by hand (the solar-panel wipe is
// played with real arrow-key presses), walks back to the airlock and ends the day. Uses the Walk 3D autopilot
// (src/world3d/demoPilot.js), which the 3D view puts on its .w3d-host element.

// Jobs to show, best first. Solar panels are on almost every base and their mini-game can be played by the demo.
const JOB_KINDS = ['solar', 'outcrop', 'greenhouse', 'berm', 'shelter'];
const PLAYABLE = 'solar';
// The wipe mini-game's cloth moves 340 px/s over a 480 x 280 panel: five passes clean about 95% of it.
const WIPE_ROW_MS = 1400;
const WIPE_STEP_MS = 200;
const WIPE_ROWS = 5;
const OTHER_GAME_MS = 3500; // other mini-games: show them, then use their own Skip button

const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));

async function pressFor(t, codes, ms) {
  codes.forEach((c) => key('keydown', c));
  try { await t.hold(ms); } finally { codes.forEach((c) => key('keyup', c)); }
}

// Zigzag the cloth across the panel: up to the top row, then right/left passes stepping down each time.
async function wipePanel(t) {
  await pressFor(t, ['ArrowUp', 'ArrowLeft'], 800);
  for (let row = 0; row < WIPE_ROWS; row += 1) {
    await pressFor(t, [row % 2 === 0 ? 'ArrowRight' : 'ArrowLeft'], WIPE_ROW_MS);
    if (row < WIPE_ROWS - 1) await pressFor(t, ['ArrowDown'], WIPE_STEP_MS);
  }
}

// Walks there while still honouring the demo's Pause, Next step and Exit buttons.
async function walk(t, pilot, spot) {
  let done = false;
  const walking = pilot.walkTo(spot.x, spot.z).then((ok) => { done = true; return ok; });
  try {
    while (!done) await t.hold(200);
  } finally {
    if (!done) pilot.stop();
  }
  return walking;
}

async function waitGone(t, selector, ms) {
  for (let left = ms; left > 0 && document.querySelector(selector); left -= 200) await t.hold(200);
}

async function doJob(t, setCaption, pilot) {
  const kind = JOB_KINDS.find((k) => pilot.spotOf(k));
  if (!kind) return;
  setCaption(kind === PLAYABLE
    ? 'The astronaut walks out to the solar panels. Mars dust piles up on them and cuts the power.'
    : 'The astronaut walks out to a work station to do a job by hand.');
  await walk(t, pilot, pilot.spotOf(kind));
  await t.hold(800);
  pilot.interact();
  const game = await t.waitFor('.w3d-mg-modal', { timeout: 3000 }).catch(() => null);
  if (!game) return;
  t.spot(game);
  if (kind === PLAYABLE) {
    setCaption('Wiping the dust off by hand. Cleaner panels make more power tonight.');
    await t.hold(1200);
    await wipePanel(t);
  } else {
    await t.hold(OTHER_GAME_MS);
    await t.click('.w3d-mg-modal button', 'Skip').catch(() => null);
  }
  await waitGone(t, '.w3d-mg-modal', 8000);
  t.spot(null);
  await t.closeWalkDialogs(2500); // a rock fact or found artifact gets a moment on screen, then closes
  await t.hold(2000); // the job's star rating shows as a toast
}

async function endDay(t, setCaption, pilot) {
  const airlock = pilot.spotOf('habitat');
  if (!airlock) return;
  setCaption('Back to the airlock to end the day. The report sums up what the crew got done.');
  await walk(t, pilot, airlock);
  await t.hold(600);
  pilot.interact();
  const report = await t.waitFor('.w3d-summary', { timeout: 3000 }).catch(() => null);
  if (!report) return;
  t.spot(report);
  await t.hold(5500);
  t.spot(null);
  await t.click('.w3d-summary .w3d-primary');
  await t.answerEvents();
}

export async function walkAndWork(t, setCaption) {
  const host = await t.waitFor('.w3d-host', { timeout: 15000 });
  const pilot = host.w3dPilot;
  if (!pilot) { await t.hold(8000); return; }
  pilot.skipIntro();
  for (let i = 0; i < 20 && pilot.busy; i += 1) { await t.closeWalkDialogs(0); await t.hold(200); }
  await t.hold(1500);
  await doJob(t, setCaption, pilot);
  await endDay(t, setCaption, pilot);
}
