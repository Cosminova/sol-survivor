// Plain-language layer for young players (ages 7-12). Presentation only: nothing here changes game
// state or numbers. Pure functions and string tables, so they can be unit tested without a DOM.

// One short, read-aloud-friendly sentence or two per science word. Shown first in the word popover.
export const KID_HINTS = {
  sol: 'A sol is one day on Mars. It lasts 24 hours and 40 minutes, a little longer than a day on Earth.',
  'solar-longitude': 'Ls is a number that tells you the season on Mars. It works like a calendar for spring, summer, autumn and winter.',
  tau: 'Tau tells you how dusty the sky is. A small number means a clear sky. A big number means a dust storm.',
  'dust-storm': 'A dust storm fills the sky with dust. Less sunlight reaches the solar panels, so they make less power.',
  'atmospheric-pressure': 'Pressure is how hard the air pushes on you. It is measured in pascals, or Pa. Mars has almost no air, so the number is tiny.',
  sievert: 'A millisievert, or mSv, measures how much radiation a body soaks up. One chest X-ray is about 0.1 mSv.',
  'dose-limit': 'This is the most radiation an astronaut may get in a whole career. NASA sets it at 600 millisieverts.',
  'radiation-shielding': 'Shielding is stuff you put between people and radiation, like water, plastic or a pile of space dirt.',
  sep: 'These are fast particles the Sun throws out in a solar storm. A shelter or a wall of water stops most of them.',
  'solar-flare': 'A solar flare is a giant flash of energy on the Sun. Big ones can send radiation toward the planets.',
  kwh: 'A kilowatt-hour, or kWh, is a chunk of energy. One kWh runs a microwave oven for about an hour.',
  battery: 'A battery saves energy for later, like at night or in a storm.',
  'solar-array': 'A solar array is a big set of solar panels. It turns sunlight into electricity.',
  capcom: 'CAPCOM is Mission Control’s helper. It is the one person on Earth who talks to the astronauts.',
  eva: 'EVA means going outside in a spacesuit. On the Moon it is also called a moonwalk.',
  regolith: 'Regolith is the loose dust and broken rock that covers the Moon and Mars. Think of it as space dirt.',
  'light-delay': 'Radio signals are fast, but space is big. A message takes about 1 second to reach the Moon and up to 22 minutes to reach Mars.',
  'solar-conjunction': 'Sometimes the Sun sits between Earth and Mars and blocks the radio. The crew cannot call home for a while.',
  'life-support': 'Life support is everything that keeps astronauts alive: air to breathe, water, food and warmth.',
  eclss: 'This is the machine system that cleans the air and recycles water so the crew can use it again.',
  hydroponics: 'Hydroponics means growing plants in water instead of soil.',
  'lunar-day': 'A day on the Moon lasts about two weeks of sunshine. Solar panels love it.',
  'lunar-night': 'Night on the Moon lasts about two weeks. It is very dark and very cold, and solar panels make no power.',
  'trade-off': 'A trade-off means that to get more of one thing you must give up some of another.',
  redundancy: 'Redundancy means having a backup, so one broken part does not end the mission.',
  bvad: 'This is NASA’s list of how much air, water and food each astronaut needs every day.',
  payload: 'Payload is everything a rocket carries. Every kilogram costs fuel, so you cannot bring it all.',
  isru: 'ISRU means making what you need from stuff already on the Moon or Mars, like ice and dirt.',
  'storm-shelter': 'A storm shelter is a small room with thick walls. The crew hides there during a solar storm.',
};

export const kidHint = (termId) => KID_HINTS[termId] ?? null;

// Cadet-view names and one-line reasons for the five crew jobs (engine ids, engine effects unchanged).
export const KID_TASKS = {
  rest: { label: 'Rest', why: 'Sleep and relax. Brings back health and a good mood.' },
  science: { label: 'Explore', why: 'Go outside to do science. Uses extra air and adds a little radiation.' },
  maintain: { label: 'Fix and clean', why: 'Fix a broken machine, or wipe dust off the solar panels.' },
  shield: { label: 'Build shield', why: 'Pile space dirt on the base. It blocks radiation and keeps the heat in.' },
  greenhouse: { label: 'Grow food', why: 'Look after the plants so they grow faster.' },
};

export const KID_ROLES = {
  commander: 'Keeps everyone in a good mood.',
  engineer: 'Fixes, cleans and builds faster.',
  botanist: 'Grows bigger harvests.',
  geologist: 'Finds more science outside.',
};

// Short reasons for each base machine, keyed by module id.
export const KID_MODULES = {
  recycler: 'Cleans used water so the crew can drink it again.',
  oxygen: 'Makes fresh air to breathe from water.',
  moxie: 'Makes air to breathe from the thin Mars air.',
  regolithO2: 'Makes air to breathe from Moon dirt.',
  iceDrill: 'Digs up buried ice and melts it into water.',
  greenhouse: 'Grows fresh food. Needs power for its lamps.',
  rover: 'Lets explorers drive farther and find more science.',
  relay: 'Sends more science home to Earth.',
  shelter: 'A safe room for solar storms.',
};

// Short names and "what you lose if it is off" for the power switchboard, keyed by module id.
export const KID_MODULE_NAMES = {
  recycler: 'Water recycler', oxygen: 'Air maker', moxie: 'Mars air maker', regolithO2: 'Moon-dirt air maker',
  iceDrill: 'Ice drill', greenhouse: 'Greenhouse', rover: 'Rover', relay: 'Radio dish',
};
export const KID_MODULE_GIVES = {
  recycler: 'Saves water', oxygen: 'Makes air', moxie: 'Makes air', regolithO2: 'Makes air',
  iceDrill: 'Makes water', greenhouse: 'Grows food', rover: 'More science', relay: 'Happier crew',
};

export const dayWord =(body, { plural = false, cap = false } = {}) => {
  const w = body === 'mars' ? (plural ? 'sols' : 'sol') : (plural ? 'days' : 'day');
  return cap ? w[0].toUpperCase() + w.slice(1) : w;
};

const count = (n, body) => `${n} ${dayWord(body, { plural: n !== 1 })}`;

// "How long will it last?" in plain words. f is one advisor forecast entry ({ rate, sols }) or null.
export function lastsText(f, remaining, body) {
  if (!f) return 'We will know how long it lasts after the first day.';
  if (!Number.isFinite(f.sols)) return f.rate > 0 ? 'Growing. We make more than we use.' : 'Steady. Enough for the whole mission.';
  if (f.sols <= 0) return 'Empty! The crew needs more right now.';
  if (f.sols >= remaining) return `Enough for the rest of the mission (${count(f.sols, body)} left).`;
  if (f.sols <= 3) return `Runs out in ${count(f.sols, body)}!`;
  return `Lasts ${count(f.sols, body)}, but the mission has ${remaining} to go.`;
}

// good | watch | danger for one forecast entry (same thresholds the advisor and gauges already use).
export function lastsLevel(f, remaining) {
  if (!f || !Number.isFinite(f.sols) || f.sols >= remaining) return 'good';
  return f.sols <= 3 ? 'danger' : 'watch';
}

export const LEVEL_WORD = { good: 'Good', watch: 'Watch out', danger: 'Danger' };
export const worstLevel = (...levels) => (levels.includes('danger') ? 'danger' : levels.includes('watch') ? 'watch' : 'good');

export function skyWord(env) {
  if (env.storm) return 'Dust storm';
  if (env.tau >= 2) return 'Very dusty sky';
  if (env.tau >= 1) return 'A little dusty';
  return 'Clear sky';
}

export function delayWords(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
  const min = Math.round(seconds / 60);
  return `${min} minute${min === 1 ? '' : 's'}`;
}

// Rewrites advisor and log sentences (engine strings, read-only) into Cadet-view words.
export function plainify(text, body = 'mars') {
  let out = String(text)
    .replace(/All systems nominal\./g, 'Everything is working well.')
    .replace(/\btau (\d+(?:\.\d+)?)/gi, 'dust level $1')
    .replace(/\bEVAs\b/g, 'trips outside')
    .replace(/\bEVA\b/g, 'trip outside')
    .replace(/the 600 mSv career limit/g, 'the safe limit of 600 mSv')
    .replace(/\bMaintain\b/g, 'Fix and clean')
    .replace(/Lunar night:/g, 'Moon night:')
    .replace(/\bregolith\b/g, 'space dirt')
    .replace(/That is ISRU and life support working together!/g, 'Making what you need where you are is a real NASA idea!')
    .replace(/solar particle dose/g, 'solar storm radiation')
    .replace(/ \(electrolysis, MOXIE\)/g, '')
    .replace(/\bradiation dose\b/g, 'radiation')
    .replace(/\bfission unit\b/g, 'nuclear power unit')
    .replace(/\bhabitat\b/g, 'base')
    .replace(/\bHabitat\b/g, 'Base')
    .replace(/crew-days’ worth/g, 'days of water for one astronaut');
  if (body !== 'mars') {
    out = out.replace(/\bsols\b/g, 'days').replace(/\bsol\b/g, 'day').replace(/\bSols\b/g, 'Days').replace(/\bSol\b/g, 'Day');
  }
  return out;
}

// Kind, specific "what to try next time" for each way a mission can end early (mission.lostReason).
export function lossMessage(mission) {
  const mods = mission?.modules ?? {};
  const has = (id) => (mods[id] ?? 0) > 0;
  switch (mission?.lostReason) {
    case 'oxygen':
      return `Your crew ran low on air. Try packing ${has('oxygen') ? 'one more oxygen generator or extra oxygen tanks' : 'an oxygen generator'} next time.`;
    case 'water':
      return `Your crew ran low on water. Try packing ${has('recycler') ? 'more water' : 'a water recycler'} next time.`;
    case 'food':
      return `Your crew ran low on food. Try packing more food${has('greenhouse') ? '' : ' or a greenhouse'} next time.`;
    case 'cold':
      return `The power ran out and the base got too cold. Try packing ${has('battery') ? 'one more battery or a nuclear power unit' : 'a battery bank'} next time.`;
    case 'heat':
      return `The power ran out and the base got too hot. Try packing ${has('fission') ? 'one more nuclear power unit' : 'a nuclear power unit'} so the coolers never stop.`;
    default:
      return 'Your crew got too worn out. Next time, give tired astronauts a Rest day and build your shield early.';
  }
}

export const LOSS_TITLE = 'Mission ended early';
export const LOSS_CHEER = 'Good try, Commander! Real astronauts practice missions many times before they fly.';

// Plain reasons for the WATCH OUT badge. Keys match status.js.
export const KID_REASONS = {
  o2: 'Air is running low',
  water: 'Water is running low',
  food: 'Food is running low',
  energy: 'Battery is running low',
  storm: 'Dust storm outside',
  sep: 'Solar storm today',
  event: 'Something is happening',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2024-05-10..." or a Date or ms -> "10 May 2024" (UTC, so the date never shifts with the time zone).
export function niceDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Expands symbols and unit abbreviations so text-to-speech reads them as words.
export function speakable(text) {
  return String(text)
    .replace(/(\d\s*°?)\s*[–—]\s*(?=[\d−-])/g, '$1 to ')
    .replace(/(^|[\s(])[−-](?=\d)/g, '$1minus ')
    .replace(/\s*°\s*C\b/g, ' degrees Celsius')
    .replace(/°/g, ' degrees')
    .replace(/\bmSv\b/g, 'millisieverts')
    .replace(/\bkWh\b/g, 'kilowatt hours')
    .replace(/\bkW\b/g, 'kilowatts')
    .replace(/(\d)\s*Pa\b/g, '$1 pascals')
    .replace(/(\d)\s*kg\b/g, '$1 kilograms')
    .replace(/\bm²/g, 'square meters')
    .replace(/\bCO₂|\bCO2\b/g, 'carbon dioxide')
    .replace(/\bO₂|\bO2\b/g, 'oxygen')
    .replace(/\bLs\b/g, 'L S')
    .replace(/τ/g, 'tau')
    .replace(/≈\s*/g, 'about ')
    .replace(/\s*×\s*/g, ' times ')
    .replace(/\s*·\s*/g, ', ')
    .replace(/\s*\/\s*sol\b/g, ' per sol')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
