// Live NASA cards: "The real Sun right now", the latest Curiosity reading, a crew-health finding and the
// pre-launch radiation briefing. Owned by the live-data work; the game UI mounts them.
// Every card says where its numbers came from: a pulsing LIVE dot only when they were fetched from NASA
// in this browser, an ARCHIVE tag when they are saved records.
import { h, s } from '../dom.js';
import { relativeTime, kidDate, liveHealth, liveRadiationBriefing, requestMars } from '../../live/liveData.js';

const RISK_WORD = ['Low', 'Low', 'Raised', 'High'];
const LEVEL_WORD = { calm: 'Calm', busy: 'Busy', stormy: 'Stormy' };
const KIND_WORD = { flare: 'Flare', cme: 'Eruption', sep: 'Radiation storm', storm: 'Magnetic storm', alert: 'NASA notice' };

const rays = (n, r1, r2) => Array.from({ length: n }, (_, i) => {
  const a = (i * 2 * Math.PI) / n;
  return s('line', { x1: 24 + r1 * Math.cos(a), y1: 24 + r1 * Math.sin(a), x2: 24 + r2 * Math.cos(a), y2: 24 + r2 * Math.sin(a) });
});

/** Level icon: a calm sun, a busy sun throwing a flare, or a storm sun with a bolt. Decorative. */
export function sunIcon(level = 'calm', size = 48) {
  const common = { viewBox: '0 0 48 48', width: size, height: size, class: ['live-sun-icon', `is-${level}`], 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  if (level === 'stormy') {
    return s('svg', common,
      s('circle', { cx: 24, cy: 24, r: 10 }),
      s('g', { class: 'live-sun-rays' }, rays(12, 14, 21)),
      s('path', { d: 'M26 16l-6 9h6l-3 8', fill: 'none', 'stroke-width': 2.4 }));
  }
  if (level === 'busy') {
    return s('svg', common,
      s('circle', { cx: 22, cy: 26, r: 10 }),
      s('g', { class: 'live-sun-rays', transform: 'translate(-2 2)' }, rays(8, 14, 18)),
      s('path', { d: 'M29 19c4-7 11-7 13-1', 'stroke-width': 2.4 }),
      s('path', { d: 'M33 22c3-3 6-3 8-1' }));
  }
  return s('svg', common,
    s('circle', { cx: 24, cy: 24, r: 10 }),
    s('g', { class: 'live-sun-rays' }, rays(8, 15, 19)));
}

/** LIVE (pulsing dot) or ARCHIVE tag. The dot is static under reduced motion (CSS). */
export function liveTag(source) {
  const live = source === 'live';
  return h('span', { class: ['live-tag', live ? 'is-live' : 'is-archive'] },
    live ? h('span', { class: 'live-dot', 'aria-hidden': 'true' }) : null,
    live ? 'Live' : 'Archive');
}

const newTab = () => h('span', { class: 'sr-only' }, ' (opens in a new tab)');
const ext = (href, text, cls = 'live-link') => h('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer' }, text, newTab());

function sunStamp(sun) {
  if (sun.source === 'live') {
    return h('p', { class: 'live-stamp' }, `Updated ${relativeTime(sun.fetchedAt)} from NASA DONKI`,
      sun.recordedAt ? ` · newest record ${kidDate(sun.recordedAt)}` : '');
  }
  return h('p', { class: 'live-stamp is-archive' }, 'Saved NASA records, not live',
    sun.recordedAt ? ` · newest record ${kidDate(sun.recordedAt, 0)}` : '');
}

function riskMeter(risk) {
  return h('div', { class: 'live-risk', role: 'img', 'aria-label': `Radiation risk for crews: ${RISK_WORD[risk]}, level ${risk} of 3` },
    h('span', { class: 'live-risk-label' }, 'Radiation risk'),
    h('span', { class: 'live-risk-pips', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => h('i', { class: i <= risk ? 'on' : '' }))),
    h('strong', null, RISK_WORD[risk]));
}

/**
 * "The real Sun right now".
 * @param {import('../../live/liveData.js').LiveNow} live
 * @param {{ compact?: boolean, events?: number }} [opts] compact: one-row strip for the HUD and home page.
 * @returns {HTMLElement}
 */
export function liveSunCard(live, opts = {}) {
  const sun = live?.sun;
  if (!sun) {
    return h('section', { class: ['card', 'live-card', 'live-sun', opts.compact && 'compact', 'is-loading'], 'aria-label': 'The real Sun right now' },
      h('strong', { class: 'live-headline' }, 'Checking the real Sun…'),
      h('p', { class: 'live-line' }, 'Asking NASA what the Sun is doing.'));
  }
  const link = sun.reason?.event?.url ?? sun.attribution.url;
  const head = h('div', { class: 'live-head' },
    liveTag(sun.source),
    h('span', { class: 'live-kicker' }, 'The real Sun'),
    h('span', { class: ['live-level', `is-${sun.level}`] }, LEVEL_WORD[sun.level]));

  if (opts.compact) {
    return h('section', { class: ['card', 'live-card', 'live-sun', 'compact', `is-${sun.level}`, `src-${sun.source}`], 'aria-label': 'The real Sun right now', dataset: { source: sun.source, level: sun.level } },
      sunIcon(sun.level, 40),
      h('div', { class: 'live-body' },
        head,
        h('strong', { class: 'live-headline' }, sun.kidHeadline),
        h('p', { class: 'live-line' }, sun.kidLine),
        sunStamp(sun)),
      riskMeter(sun.radiationRisk));
  }

  // Flares, radiation storms, magnetic storms and eruptions aimed at Earth or Mars first; other eruptions fill the rest.
  const past = sun.events.filter((e) => e.kind !== 'alert' && Date.parse(e.time) <= Date.now());
  const notable = past.filter((e) => e.kind !== 'cme' || e.arrivals?.length);
  const shown = [...notable, ...past.filter((e) => !notable.includes(e))].slice(0, opts.events ?? 4);
  return h('section', { class: ['card', 'live-card', 'live-sun', `is-${sun.level}`, `src-${sun.source}`], 'aria-label': 'The real Sun right now', dataset: { source: sun.source, level: sun.level } },
    head,
    h('div', { class: 'live-main' },
      sunIcon(sun.level, 72),
      h('div', { class: 'live-body' },
        h('h3', { class: 'live-headline' }, sun.kidHeadline),
        h('p', { class: 'live-line' }, sun.kidLine),
        riskMeter(sun.radiationRisk))),
    shown.length ? h('ul', { class: 'live-events', 'aria-label': 'Newest Sun events' }, shown.map((e) => h('li', null,
      h('span', { class: ['live-kind', `k-${e.kind}`] }, KIND_WORD[e.kind]),
      h('span', { class: 'live-event-line' }, e.kidLine),
      e.url ? ext(e.url, 'NASA record') : null))) : null,
    h('div', { class: 'live-foot' },
      sunStamp(sun),
      ext(link, sun.reason?.event?.url ? 'See this event at NASA DONKI' : 'Open NASA DONKI')));
}

/**
 * Latest Curiosity weather reading. Always dated: the public feed lags, so it is never called "today".
 * @param {import('../../live/liveData.js').LiveNow} live
 * @returns {HTMLElement}
 */
export function liveMarsCard(live) {
  const mars = live?.mars;
  // Showing Mars weather is what triggers the (large) Curiosity feed; onLive subscribers get the result.
  if (mars?.source !== 'live') requestMars();
  if (!mars) {
    return h('section', { class: 'card live-card live-mars is-loading', 'aria-label': 'Latest Curiosity weather reading' },
      h('strong', { class: 'live-headline' }, 'No Curiosity reading yet'),
      h('p', { class: 'live-line' }, 'The weather report from Mars has not arrived.'));
  }
  const cell = (label, value) => h('div', { class: 'live-cell' }, h('span', null, label), h('strong', null, value));
  return h('section', { class: ['card', 'live-card', 'live-mars', `src-${mars.source}`], 'aria-label': 'Latest Curiosity weather reading', dataset: { source: mars.source } },
    h('div', { class: 'live-head' },
      liveTag(mars.source),
      h('span', { class: 'live-kicker' }, 'Mars weather at Gale Crater'),
      h('span', { class: 'live-level is-mars' }, `Sol ${mars.sol}`)),
    h('h3', { class: 'live-headline' }, mars.recordedLabel),
    h('div', { class: 'live-cells' },
      cell('Coldest', `${mars.minC} °C`),
      cell('Warmest', `${mars.maxC} °C`),
      cell('Air pressure', mars.pressurePa != null ? `${mars.pressurePa} Pa` : 'Not reported'),
      cell('Sky', mars.sky),
      cell('Sunburn rays (UV)', mars.uv)),
    h('p', { class: 'live-line' }, `On that sol it warmed up to ${mars.maxC} °C and dropped to ${mars.minC} °C at night. The air pressure was under 1% of Earth’s.`),
    h('div', { class: 'live-foot' },
      h('p', { class: ['live-stamp', mars.source !== 'live' && 'is-archive'] },
        mars.source === 'live' ? `Read ${relativeTime(mars.fetchedAt)} from NASA’s Curiosity feed. Curiosity’s public reports arrive weeks late.` : 'Saved NASA records, not live'),
      ext(mars.attribution.url, 'Curiosity weather at NASA')));
}

/**
 * One real space-biology finding from NASA OSDR (saved at build time). Fills itself in when the file loads.
 * @param {{ index?: number, topic?: string }} [opts] pick a finding by position or topic; default rotates by day.
 * @returns {HTMLElement}
 */
export function liveHealthFact(opts = {}) {
  const el = h('section', { class: 'card live-card live-health is-loading', 'aria-label': 'Real space health science' },
    h('p', { class: 'live-line' }, 'Loading a real space health finding…'));
  liveHealth().then((health) => {
    const list = opts.topic ? health.findings.filter((f) => f.topic === opts.topic) : health.findings;
    if (!list.length) { el.hidden = true; return; }
    const f = list[(opts.index ?? Math.floor(Date.now() / 864e5)) % list.length];
    el.classList.remove('is-loading');
    el.replaceChildren(...healthFactBody(f, health).childNodes);
  });
  return el;
}

/** The inside of a health card, also used by the Data Lab list. */
export function healthFactBody(f, health) {
  return h('div', null,
    h('div', { class: 'live-head' },
      liveTag('archive'),
      h('span', { class: 'live-kicker' }, `Real space science · ${f.topic}`),
      h('span', { class: 'live-level is-health' }, f.id)),
    h('p', { class: 'live-line live-kid' }, f.kid),
    h('p', { class: 'live-setting' }, f.setting, f.organism ? ` · studied: ${f.organism}` : ''),
    h('div', { class: 'live-foot' },
      h('p', { class: 'live-stamp is-archive' }, health.label),
      ext(f.url, `Read study ${f.id} at NASA`)));
}

/**
 * Pre-launch radiation briefing built from the real Sun.
 * @param {import('../../live/liveData.js').LiveNow} live
 * @returns {HTMLElement}
 */
export function liveBriefingCard(live) {
  const b = liveRadiationBriefing(live);
  return h('section', { class: ['card', 'live-card', 'live-briefing', `is-${b.level}`, `src-${b.source}`], 'aria-label': 'Radiation briefing from the real Sun', dataset: { source: b.source } },
    h('div', { class: 'live-head' },
      liveTag(b.source),
      h('span', { class: 'live-kicker' }, 'Radiation briefing'),
      h('span', { class: ['live-level', `is-${b.level}`] }, `Risk ${b.radiationRisk} of 3`)),
    h('div', { class: 'live-main' },
      sunIcon(b.level, 56),
      h('div', { class: 'live-body' },
        h('h3', { class: 'live-headline' }, b.title),
        h('p', { class: 'live-line' }, b.sun),
        h('p', { class: 'live-line live-meaning' }, b.meaning),
        h('p', { class: 'live-line' }, h('strong', null, 'Tip: '), b.tip))),
    h('p', { class: ['live-stamp', b.source !== 'live' && 'is-archive'] }, b.label));
}
