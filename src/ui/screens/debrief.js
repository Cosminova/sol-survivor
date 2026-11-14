// Debrief: how it ended, what stood out and what the player learned.
import { RADIATION } from '../../data/constants.js';
import { escapeHtml, fmt } from '../text.js';

const LESSONS = {
  sep_alert: 'Solar storms are real: NASA tracks them in the DONKI database. Water tanks and a storm shelter block most of the particle dose.',
  dust_storm: 'Dust storms dim the Sun for days. Solar panels make less power, so batteries or a fission unit keep the base alive.',
  global_storm: 'In 2018 a planet-wide dust storm ended the solar-powered Opportunity rover. Nuclear power kept Curiosity going.',
  lunar_night: 'A lunar night lasts about 14 Earth days. Surviving it needs stored power or fission power, not just solar.',
  perchlorate: 'Mars soil holds toxic perchlorate salts (found by Phoenix in 2008). Farms need washed soil or hydroponics.',
  harvest: 'Plants take weeks to grow but give fresh food, oxygen and a big morale boost, like NASA’s Veggie on the ISS.',
  micrometeoroid: 'Tiny space rocks hit the Moon constantly. Habitats use layered Whipple shields and spare parts for patches.',
  filter_clog: 'Even a 98% water recycler needs maintenance. Spare parts are life insurance.',
  conjunction: 'Every 26 months the Sun blocks radio between Earth and Mars. Crews must solve problems on their own.',
  ice_found: 'Buried ice means water, oxygen and radiation shielding you do not have to bring from Earth.',
  homesick: 'Radio takes 3 to 22 minutes to reach Mars. Crews keep morale up with recorded messages and rest.',
  lava_tube: 'Meters of rock overhead block most cosmic radiation. Lava tubes could shelter future bases.',
  moonquake: 'Apollo seismometers recorded thousands of moonquakes. Checking systems after one prevents surprises.',
  medical: 'Low gravity weakens bones and muscles. Astronauts exercise about two hours a day to stay strong.',
};

export function renderDebrief(store) {
  const state = store.mission;
  const status = state?.status ?? {};
  const won = status.outcome === 'won';
  const stats = store.stats ?? {};
  const crew = state?.crew ?? [];
  const maxDose = Math.max(0, ...crew.map((c) => c.doseMsv ?? 0), stats.maxDose ?? 0);
  const xrays = maxDose / (RADIATION?.chestXrayMsv ?? 0.1);
  const answered = Array.isArray(stats.cardsAnswered) ? stats.cardsAnswered : [];
  const storms = answered.filter((id) => ['sep_alert', 'dust_storm', 'global_storm', 'lunar_night'].includes(id)).length;
  const stars = Math.max(0, Math.min(3, Number(status.stars ?? 0)));
  const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const unit = state?.body === 'moon' ? 'days' : 'sols';

  const lessons = [];
  for (const id of new Set(answered)) if (LESSONS[id]) lessons.push(LESSONS[id]);
  if (stats.minO2 != null && stats.minO2 < 50) lessons.push('Oxygen ran low. Oxygen generators and MOXIE-style plants make air so tanks last longer.');
  if (stats.shortfallSols > 0) lessons.push(`Power ran short on ${stats.shortfallSols} ${unit}. Night, dust and cold all eat into the battery.`);
  if (!lessons.length) lessons.push('Air, power and shielding are a balancing act: every kilogram you pack is a choice.');
  lessons.push(`You kept ${crew.length} crew going for ${state?.sol ?? 0} ${unit} using real NASA numbers for air, water, food and radiation.`);

  return `
  <div class="banner ${won ? 'won' : 'lost'}" role="status">
    <h1>${won ? 'Mission complete!' : 'Mission over'}</h1>
    <p>${escapeHtml(status.reason ?? (won ? 'Everyone made it home.' : 'The crew could not go on.'))}</p>
    <div class="stars" aria-label="${stars} of 3 stars">${starText}</div>
    <div class="score">Score ${fmt(status.score ?? 0)} · ${stars} of 3 stars</div>
  </div>

  <h2 style="margin-top:16px">Highlights</h2>
  <div class="highlights">
    <div class="card stat"><div class="label">Highest dose</div><div class="value">${fmt(maxDose, 1)} mSv</div><small>about ${fmt(xrays)} chest X-rays (career limit ${fmt(RADIATION?.careerLimitMsv ?? 600)} mSv)</small></div>
    <div class="card stat"><div class="label">Lowest oxygen</div><div class="value">${fmt(stats.minO2 ?? state?.supplies?.o2Kg ?? 0)} kg</div><small>in the tanks at the tightest moment</small></div>
    <div class="card stat"><div class="label">Storms faced</div><div class="value">${storms}</div><small>radiation, dust and lunar night alerts answered</small></div>
    <div class="card stat"><div class="label">Science</div><div class="value">${fmt(state?.science ?? 0)}</div><small>points sent to Earth</small></div>
    <div class="card stat"><div class="label">Sols survived</div><div class="value">${fmt(state?.sol ?? 0)}</div><small>of ${fmt(state?.lengthSols ?? 0)} planned</small></div>
    <div class="card stat"><div class="label">Crew</div><div class="value">${crew.filter((c) => (c.health ?? 0) > 0).length} / ${crew.length}</div><small>healthy at the end</small></div>
  </div>

  <h2 style="margin-top:16px">What you learned</h2>
  <div class="card"><ul class="lessons">${lessons.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul></div>

  <div class="grid grid-3" style="margin-top:16px">
    <button type="button" class="btn primary big" data-action="replay">Replay code ${escapeHtml(state?.code ?? '')}</button>
    <button type="button" class="btn big" data-action="new-mission">New mission</button>
    <button type="button" class="btn big" data-action="share-code">Share code</button>
  </div>
  <p class="hint" style="text-align:center; margin-top:10px">Give a friend the code <strong>${escapeHtml(state?.code ?? '')}</strong>. They get the exact same weather and storms. Can they beat your score?</p>`;
}
