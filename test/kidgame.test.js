// Cadet game layer: day plans map onto engine tasks, previews are the engine's own numbers, every event
// card has plain text, the training mission plays out the same way every time, and big results are detected.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createMission, beginSol, resolveEvent, runSol, toggleModule, TASKS, DEFAULT_CREW } from '../src/engine/sim.js';
import { classifySepEvents } from '../src/engine/spaceWeather.js';
import { choiceAvailable } from '../src/engine/events.js';
import { EVENT_CARDS } from '../src/data/eventCards.js';
import { CAMPAIGN, TUTORIAL, missionById } from '../src/data/missions.js';
import { KID_EVENTS, KID_EVENT_ICONS } from '../src/data/kidText.js';
import { PLANS, planTasks, applyPlan, currentPlan, availablePlans, previewPlan, simulateNextDay, planChips, meterStates, METER_WORD } from '../src/ui/kid/plans.js';
import { dayEffects } from '../src/ui/kid/effects.js';
import { KID_MODULE_NAMES, KID_MODULE_GIVES, plainify } from '../src/ui/kid/words.js';
import { MODULES } from '../src/data/modules.js';
import { TUTORIAL_STEPS, RECAP } from '../src/ui/tutorial/tutorial.js';
import { placeBubble } from '../src/ui/tutorial/coach.js';
import { crewStatusLine } from '../src/ui/components/crewPopup.js';

const donki = JSON.parse(fs.readFileSync(new URL('../public/data/donki.json', import.meta.url), 'utf8'));
const ctx = { seps: classifySepEvents(donki), weatherIndex: null };
const training = () => createMission({ config: TUTORIAL, loadout: TUTORIAL.loadout, difficulty: 'cadet', code: TUTORIAL.code }, ctx);
const chapter = (id) => {
  const config = missionById(id);
  return createMission({ config, loadout: config.recommended, difficulty: 'cadet', code: 'TEST01' }, ctx);
};
const tasksOf = (m) => Object.fromEntries(m.crew.map((c) => [c.role, c.task]));

describe('day plans', () => {
  it('maps each plan onto one engine task per astronaut', () => {
    const m = chapter('artemis-dawn');
    expect(tasksOf(applyPlan(m, 'explore'))).toEqual({ commander: 'science', engineer: 'science', botanist: 'science', geologist: 'science' });
    expect(tasksOf(applyPlan(m, 'shield'))).toEqual({ commander: 'shield', engineer: 'shield', botanist: 'shield', geologist: 'shield' });
    expect(tasksOf(applyPlan(m, 'fix'))).toEqual({ commander: 'rest', engineer: 'maintain', botanist: 'rest', geologist: 'rest' });
    expect(tasksOf(applyPlan(m, 'grow'))).toEqual({ commander: 'greenhouse', engineer: 'maintain', botanist: 'greenhouse', geologist: 'greenhouse' });
    for (const plan of PLANS) {
      for (const task of Object.values(planTasks(m, plan.id))) expect(TASKS[task], `${plan.id}:${task}`).toBeTruthy();
    }
  });

  it('only changes crew jobs, and an unknown plan changes nothing', () => {
    const m = chapter('artemis-dawn');
    const next = applyPlan(m, 'shield');
    expect({ ...next, crew: null }).toEqual({ ...m, crew: null });
    expect(next.crew.map((c) => ({ ...c, task: null }))).toEqual(m.crew.map((c) => ({ ...c, task: null })));
    expect(applyPlan(m, 'nope')).toBe(m);
  });

  it('knows which plan is active, and says none when jobs were mixed by hand', () => {
    const m = chapter('artemis-dawn');
    expect(currentPlan(m)).toBe(null); // the engine starts with a mix of jobs
    for (const plan of PLANS) expect(currentPlan(applyPlan(m, plan.id))).toBe(plan.id);
  });

  it('still works without an engineer on the crew', () => {
    const crew = DEFAULT_CREW.map((c) => ({ ...c, role: c.role === 'engineer' ? 'geologist' : c.role }));
    const config = missionById('artemis-dawn');
    const m = createMission({ config, loadout: config.recommended, code: 'TEST01', crew }, ctx);
    expect(applyPlan(m, 'fix').crew.filter((c) => c.task === 'maintain')).toHaveLength(1);
  });

  it('offers Grow food only with a greenhouse, and Build the shield only until it is full', () => {
    expect(availablePlans(chapter('artemis-dawn')).map((p) => p.id)).toEqual(['explore', 'shield', 'fix']);
    expect(availablePlans(chapter('green-thumb')).map((p) => p.id)).toEqual(['explore', 'shield', 'fix', 'grow']);
    const full = { ...chapter('artemis-dawn'), shield: { level: 3, work: 0 } };
    expect(availablePlans(full).map((p) => p.id)).toEqual(['explore', 'fix']);
  });
});

describe('plan previews are the engine', () => {
  it('matches what the engine really does on a day with no surprise', () => {
    for (const plan of ['explore', 'shield', 'fix']) {
      const m = applyPlan(training(), plan);
      const preview = previewPlan(m, plan, ctx);
      const started = beginSol(m, ctx);
      expect(started.phase, 'day 1 of training has no event').toBe('plan');
      const real = runSol(started);
      expect(preview.air).toBeCloseTo(real.resources.o2 - m.resources.o2, 5);
      expect(preview.batteryKwh).toBeCloseTo(real.resources.batteryKwh - m.resources.batteryKwh, 5);
      expect(preview.science).toBe(real.lastReport.scienceToday);
      expect(preview.dose).toBe(real.lastReport.doseToday);
      expect(preview.shed).toEqual(real.lastReport.power.shed);
    }
  });

  it('never changes the mission it previews', () => {
    const m = training();
    const frozen = JSON.stringify(m);
    previewPlan(m, 'explore', ctx);
    simulateNextDay(m, ctx);
    expect(JSON.stringify(m)).toBe(frozen);
  });

  it('shows the real trade-offs: exploring costs air, the shield costs science', () => {
    const m = training();
    const explore = previewPlan(m, 'explore', ctx);
    const shield = previewPlan(m, 'shield', ctx);
    const inside = previewPlan(m, 'fix', ctx);
    expect(explore.science).toBeGreaterThan(0);
    expect(explore.air).toBeLessThan(inside.air);
    expect(explore.dose).toBeGreaterThan(inside.dose);
    expect(shield.shieldWork).toBeGreaterThan(0);
    expect(shield.science).toBe(0);
    expect(shield.air).toBeLessThan(inside.air);
    expect(inside.science).toBe(0);
    const chips = (id, sim) => planChips(id, sim, inside);
    expect(chips('explore', explore).gets.map((c) => c.text)).toContain('Science');
    expect(chips('explore', explore).costs.map((c) => c.text)).toEqual(['Uses more air', 'A little radiation']);
    expect(chips('shield', shield).gets.map((c) => c.text)).toEqual(['Stronger shield']);
    expect(chips('shield', shield).costs.map((c) => c.text)).toContain('No science');
    for (const id of ['explore', 'shield', 'fix']) {
      const c = chips(id, previewPlan(m, id, ctx));
      expect(c.gets.length, `${id} gives something`).toBeGreaterThan(0);
      expect(c.costs.length, `${id} costs something: no choice is free`).toBeGreaterThan(0);
    }
  });

  it('returns nothing to preview once the mission is over or an event card is waiting', () => {
    expect(simulateNextDay({ ...training(), status: 'won' }, ctx)).toBe(null);
    expect(simulateNextDay({ ...training(), phase: 'event' }, ctx)).toBe(null);
  });

  it('gives each meter one of three words', () => {
    const m = training();
    const st = meterStates(m, simulateNextDay(m, ctx));
    expect(Object.keys(METER_WORD)).toEqual(['good', 'low', 'danger']);
    expect(st.air.level).toBe('good');
    expect(st.power.level).toBe('good');
    expect(st.shield.level).toBe('low'); // no shield built yet
    expect(st.shield.segments).toBe(0);
    const dry = { ...m, resources: { ...m.resources, o2: 0.5 } };
    expect(meterStates(dry, simulateNextDay(dry, ctx)).air.level).toBe('danger');
  });
});

describe('plain event text', () => {
  it('covers every event card and every choice', () => {
    // Every card in the deck has plain text. (kidText may also carry cards that another branch adds.)
    for (const card of EVENT_CARDS) expect(KID_EVENTS[card.id], card.id).toBeTruthy();
    for (const id of ['sun_live_sep', 'sun_live_flare', 'sun_forecast']) expect(KID_EVENTS[id].choices, id).toHaveLength(3);
    for (const card of EVENT_CARDS) {
      const kid = KID_EVENTS[card.id];
      expect(kid.title, card.id).toBeTruthy();
      expect(kid.choices, card.id).toHaveLength(card.choices.length);
      expect(KID_EVENT_ICONS[card.id], card.id).toBeTruthy();
    }
  });

  it('retells each card in one short sentence without jargon marks', () => {
    for (const [id, kid] of Object.entries(KID_EVENTS)) {
      expect(kid.line.split(/\s+/).length, id).toBeLessThanOrEqual(26);
      expect(kid.line.match(/[.!?]/g) ?? [], id).toHaveLength(1);
      expect(`${kid.title} ${kid.line} ${kid.choices.join(' ')}`, id).not.toMatch(/\[\[|τ|°|EVA|regolith|tau\b/);
    }
  });

  it('keeps every number from the original choice labels', () => {
    for (const card of EVENT_CARDS) {
      card.choices.forEach((choice, i) => {
        for (const n of choice.label.match(/\d+/g) ?? []) expect(KID_EVENTS[card.id].choices[i], `${card.id} choice ${i}`).toContain(n);
      });
    }
  });

  it('only uses placeholders the engine fills in', () => {
    for (const [id, kid] of Object.entries(KID_EVENTS)) {
      for (const key of `${kid.title} ${kid.line} ${kid.choices.join(' ')}`.match(/\{(\w+)\}/g) ?? []) {
        expect(['{crewName}', '{bodyName}'], id).toContain(key);
      }
    }
  });

  it('names every machine the power switchboard can show', () => {
    for (const mod of MODULES.filter((x) => x.kw > 0)) {
      expect(KID_MODULE_NAMES[mod.id], mod.id).toBeTruthy();
      expect(KID_MODULE_GIVES[mod.id], mod.id).toBeTruthy();
    }
  });

  it('puts debrief lessons into plain words without touching the numbers', () => {
    expect(plainify('Power was short on 3 sols, so machines switched off. More panels, a battery, or a fission unit would help.', 'moon'))
      .toBe('Power was short on 3 days, so machines switched off. More panels, a battery, or a nuclear power unit would help.');
    expect(plainify('The habitat got dangerously cold on 2 sols.')).toBe('The base got dangerously cold on 2 sols.');
  });
});

// Plays the training mission with the engine: plans[i] is the plan for day i + 1, storm is the storm choice.
function playTraining(plans, storm, switchOff = null) {
  let m = training();
  const days = [];
  for (let d = 0; d < TUTORIAL.targetSols; d += 1) {
    m = applyPlan(m, plans[d]);
    if (d === 2 && switchOff) m = toggleModule(m, switchOff);
    const before = m;
    const preview = simulateNextDay(m, ctx);
    m = beginSol(m, ctx);
    const event = m.pendingEvent?.id ?? null;
    const vars = m.pendingEvent?.vars ?? null;
    if (event) {
      const card = EVENT_CARDS.find((c) => c.id === event);
      expect(choiceAvailable(m, card.choices[storm])).toBe(true);
      m = resolveEvent(m, storm);
    }
    m = runSol(m);
    days.push({ event, vars, preview, before, after: m });
  }
  return { m, days };
}

describe('training mission', () => {
  it('is separate from the campaign and reuses real places and real data', () => {
    expect(CAMPAIGN.some((c) => c.id === TUTORIAL.id)).toBe(false);
    expect(missionById('tutorial')).toBe(null);
    expect(TUTORIAL.scripted).toEqual([]);
  });

  it('follows the walkthrough script: quiet day, real storm at nightfall, then a power shortage', () => {
    const { m, days } = playTraining(['explore', 'shield', 'fix'], 0);
    expect(days[0].event).toBe(null);
    expect(days[0].preview.science).toBeGreaterThan(0);
    // Day 2: the real DONKI solar storm of 9 October 2024 arrives as the Sun sets.
    expect(days[1].event).toBe('sep_alert');
    expect(days[1].vars.eventDate).toBe('2024-10-09');
    expect(days[1].before.env.lit).toBe(true);
    expect(days[1].after.env.lit).toBe(false);
    expect(days[1].preview.shieldWork).toBeGreaterThan(0);
    expect(days[1].preview.batteryPct).toBeLessThan(0); // "tonight the Sun sets, so the battery drains"
    expect(days[1].preview.shed).toEqual([]);
    // Day 3: night, not enough power for every machine, so the switchboard appears.
    expect(days[2].event).toBe(null);
    expect(days[2].preview.shed.length).toBeGreaterThan(0);
    expect(days[2].preview.cold).toBe(false);
    expect(m.status).toBe('won');
    expect(m.sol).toBe(3);
  });

  it('lets one switch fix the shortage, and makes that switch cost something', () => {
    const night = playTraining(['explore', 'shield', 'fix'], 0).days[2].before;
    const off = (id) => simulateNextDay(toggleModule(night, id), ctx);
    expect(off('regolithO2').shed).toEqual([]);
    expect(off('regolithO2').air).toBeLessThan(simulateNextDay(night, ctx).air); // saves power, makes less air
    expect(off('rover').shed).toEqual([]);
    expect(off('relay').shed.length).toBeGreaterThan(0); // the radio dish alone is not enough
  });

  it('cannot really be failed: every plan and storm choice ends with a healthy crew', () => {
    const ids = ['explore', 'shield', 'fix'];
    for (const a of ids) for (const b of ids) for (const c of ids) for (const storm of [0, 1, 2]) {
      for (const sw of [null, 'regolithO2', 'rover', 'relay']) {
        const { m, days } = playTraining([a, b, c], storm, sw);
        const label = `${a}/${b}/${c} storm ${storm} switch ${sw}`;
        expect(m.status, label).toBe('won');
        expect(Math.min(...m.crew.map((x) => x.health)), label).toBeGreaterThanOrEqual(95);
        expect(days.map((d) => d.event), label).toEqual([null, 'sep_alert', null]);
        expect(m.broken, label).toEqual({});
      }
    }
  });

  it('has steps that each wait for the player or offer Next, in short sentences', () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(10);
    for (const step of TUTORIAL_STEPS) {
      expect(['do', 'read']).toContain(step.kind);
      if (step.kind === 'do') expect(typeof step.on, step.id).toBe('function');
      expect(step.text.split(/\s+/).length, step.id).toBeLessThanOrEqual(step.id === 'real-sun' ? 16 : 15);
      if (step.why) expect(step.why.split(/\s+/).length, step.id).toBeLessThanOrEqual(15);
      expect(step.target, step.id).toBeTruthy();
    }
    const text = (id) => TUTORIAL_STEPS.find((s) => s.id === id).text;
    expect(text('air-cost')).toMatch(/science.*air/i);
    expect(text('real-sun')).toBe('Real NASA scientists watch the Sun every day. Want to see the real Sun today?');
    expect(text('power-cost')).toMatch(/trade-off/);
    expect(RECAP).toHaveLength(3);
  });
});

describe('coach bubble placement', () => {
  const size = { w: 280, h: 150 };
  const desktop = { vw: 1280, vh: 800, top: 102, bottom: 34 };
  const phone = { vw: 390, vh: 844, top: 100, bottom: 34 };
  const overlaps = (pos, box, s = size) => pos.left < box.right && pos.left + s.w > box.left && pos.top < box.bottom && pos.top + s.h > box.top;
  const inside = (pos, view, s = size) => pos.left >= 0 && pos.top >= (view.top ?? 0) && pos.left + s.w <= view.vw && pos.top + s.h <= view.vh - (view.bottom ?? 0);

  it('sits beside a sidebar control, over the outpost, never on the control', () => {
    const next = { left: 807, top: 673, right: 1225, bottom: 743 };
    const pos = placeBubble(next, size, desktop);
    expect(pos.side).toBe('left');
    expect(overlaps(pos, next)).toBe(false);
    expect(inside(pos, desktop)).toBe(true);
  });

  it('flips to whichever side has room and stays on screen', () => {
    const boxes = [
      { left: 38, top: 112, right: 787, bottom: 756 }, // the outpost window
      { left: 807, top: 224, right: 950, bottom: 305 }, // a meter
      { left: 180, top: 160, right: 1100, bottom: 270 }, // the story row of an event card
      { left: 500, top: 300, right: 700, bottom: 360 }, // a button in the middle
      { left: 10, top: 110, right: 200, bottom: 160 }, // top-left corner
    ];
    for (const box of boxes) {
      const pos = placeBubble(box, size, desktop);
      expect(pos.side, JSON.stringify(box)).not.toBe('corner');
      expect(overlaps(pos, box), JSON.stringify(box)).toBe(false);
      expect(inside(pos, desktop), JSON.stringify(box)).toBe(true);
    }
  });

  it('becomes a bar on the far edge on phones', () => {
    const bar = { w: 358, h: 120 };
    const low = placeBubble({ left: 15, top: 630, right: 375, bottom: 696 }, bar, phone);
    expect(low.side).toBe('bar-top');
    expect(low.top).toBe(108);
    const high = placeBubble({ left: 2, top: 104, right: 388, bottom: 386 }, bar, phone);
    expect(high.side).toBe('bar-bottom');
    expect(high.top + bar.h).toBe(844 - 34 - 8);
  });

  it('tucks into a corner only when the target fills the screen', () => {
    expect(placeBubble({ left: 0, top: 0, right: 1280, bottom: 800 }, size, desktop).side).toBe('corner');
  });
});

describe('big results of a day', () => {
  it('stays quiet on ordinary days, so the popup is rare', () => {
    let m = applyPlan(chapter('artemis-dawn'), 'explore');
    let quiet = 0;
    let days = 0;
    while (m.status === 'active') {
      const before = m;
      m = beginSol(m, ctx);
      if (m.phase === 'event') m = resolveEvent(m, EVENT_CARDS.find((c) => c.id === m.pendingEvent.id).choices.findIndex((ch) => choiceAvailable(m, ch)));
      m = runSol(m);
      days += 1;
      if (dayEffects(before, m, ctx) === null) quiet += 1;
    }
    expect(days).toBe(14);
    expect(quiet).toBeGreaterThanOrEqual(9);
    expect(dayEffects(m, m, ctx)).toBe(null);
  });

  it('reports the storm and nightfall with the engine numbers, at most four lines', () => {
    const { days } = playTraining(['explore', 'shield', 'fix'], 2);
    const fx = dayEffects(days[1].before, days[1].after, ctx);
    const all = fx.items.map((i) => i.text).join(' ');
    expect(fx.title).toBe('Day 2: what happened');
    expect(fx.items.length).toBeLessThanOrEqual(4);
    expect(all).toContain(`${days[1].after.lastReport.doseToday} mSv`);
    expect(all).toMatch(/The Sun has set/);
  });

  it('reports a new shield level', () => {
    let m = applyPlan(chapter('artemis-dawn'), 'shield');
    let fx = null;
    for (let d = 0; d < 3 && !fx?.items.some((i) => /Shield is now level 1/.test(i.text)); d += 1) {
      const before = m;
      m = beginSol(m, {});
      if (m.phase === 'event') m = resolveEvent(m, EVENT_CARDS.find((c) => c.id === m.pendingEvent.id).choices.findIndex((ch) => choiceAvailable(m, ch)));
      m = runSol(m);
      fx = dayEffects(before, m, {});
    }
    expect(fx.items.map((i) => i.text).join(' ')).toMatch(/Shield is now level 1 of 3/);
  });

  it('describes an astronaut in one plain line', () => {
    expect(crewStatusLine({ name: 'Ada Reyes', health: 100, morale: 90, doseMsv: 2 })).toBe('Ada feels great.');
    expect(crewStatusLine({ name: 'Ada Reyes', health: 20, morale: 90, doseMsv: 2 })).toMatch(/needs rest now/);
    expect(crewStatusLine({ name: 'Ada Reyes', health: 80, morale: 20, doseMsv: 2 })).toMatch(/worn out/);
    expect(crewStatusLine({ name: 'Ada Reyes', health: 80, morale: 80, doseMsv: 590 })).toMatch(/safe radiation limit/);
  });
});
