import { describe, it, expect } from 'vitest';
import { GLOSSARY, CATEGORIES, termById, searchGlossary } from '../src/data/glossary.js';
import { EVENT_CARDS } from '../src/data/eventCards.js';
import { MODULES } from '../src/data/modules.js';
import { SITES } from '../src/data/sites.js';
import { SOURCES } from '../src/data/sources.js';
import { CAMPAIGN } from '../src/data/missions.js';
import { QUIZ } from '../src/data/quiz.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../src/data/achievements.js';
import { LESSONS, NGSS_ALIGNMENT } from '../src/data/lessons.js';
import { NGSS_STANDARDS } from '../src/data/ngss.js';
import { DID_YOU_KNOW, COMPARISON, COMPARISON_ROWS, comparisonSource } from '../src/data/facts.js';
import { TIMELINE } from '../src/data/timeline.js';
import { DOSE_LADDER } from '../src/data/doses.js';

const unique = (list) => new Set(list).size === list.length;
const BODIES = ['earth', 'moon', 'mars'];

const LINK = /\[\[([\w-]+)(?:\|[^\]]+)?\]\]/g;
const linksIn = (text) => [...(text ?? '').matchAll(LINK)].map((m) => m[1]);

describe('Astronaut Dictionary', () => {
  it('has many unique terms in known categories', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(80);
    expect(new Set(GLOSSARY.map((t) => t.id)).size).toBe(GLOSSARY.length);
    for (const t of GLOSSARY) expect(CATEGORIES[t.category], t.id).toBeDefined();
  });
  it('only links to terms that exist', () => {
    for (const t of GLOSSARY) for (const r of t.related ?? []) expect(termById(r), `${t.id} -> ${r}`).not.toBeNull();
  });
  it('searches by word and category', () => {
    expect(searchGlossary('sol').some((t) => t.id === 'sol')).toBe(true);
    expect(searchGlossary('', 'radiation').every((t) => t.category === 'radiation')).toBe(true);
  });
});

describe('Content integrity', () => {
  it('event cards reference real glossary terms and sources', () => {
    for (const card of EVENT_CARDS) {
      for (const id of [...linksIn(card.body), ...linksIn(card.science), ...(card.terms ?? [])]) {
        expect(termById(id), `${card.id} -> ${id}`).not.toBeNull();
      }
      expect(SOURCES[card.source], card.id).toBeDefined();
      expect(card.choices.length).toBeGreaterThan(0);
    }
  });
  it('modules and sites cite sources and glossary terms', () => {
    for (const m of MODULES) {
      expect(SOURCES[m.source], m.id).toBeDefined();
      expect(termById(m.term), m.id).not.toBeNull();
    }
    for (const s of SITES) expect(SOURCES[s.source], s.id).toBeDefined();
  });
  it('campaign missions use real sites and scripted events', () => {
    for (const c of CAMPAIGN) {
      expect(SITES.some((s) => s.id === c.siteId && s.body === c.body), c.id).toBe(true);
      for (const s of c.scripted ?? []) expect(EVENT_CARDS.some((e) => e.id === s.eventId), `${c.id} ${s.eventId}`).toBe(true);
    }
  });
  it('campaign chapters have a teaser and a cited real-world connection', () => {
    for (const c of CAMPAIGN) {
      expect(c.teaser, c.id).toBeTruthy();
      expect(c.realWorld?.text, c.id).toBeTruthy();
      expect(SOURCES[c.realWorld.source], c.id).toBeDefined();
    }
  });
});

describe('Mission Quiz integrity', () => {
  it('has 60+ uniquely identified questions with valid answers', () => {
    expect(QUIZ.length).toBeGreaterThanOrEqual(60);
    expect(unique(QUIZ.map((q) => q.id))).toBe(true);
    for (const q of QUIZ) {
      expect(q.choices.length, q.id).toBeGreaterThanOrEqual(3);
      expect(unique(q.choices), q.id).toBe(true);
      expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, q.id).toBe(true);
      expect([1, 2, 3], q.id).toContain(q.difficulty);
      expect(q.question.length && q.explain.length, q.id).toBeTruthy();
    }
  });
  it('links every question to a real term, category, source and chapter', () => {
    for (const q of QUIZ) {
      expect(termById(q.term), `${q.id} -> ${q.term}`).not.toBeNull();
      expect(CATEGORIES[q.category], q.id).toBeDefined();
      expect(termById(q.term).category, q.id).toBe(q.category);
      if (q.source) expect(SOURCES[q.source], `${q.id} -> ${q.source}`).toBeDefined();
      if (q.missionId) expect(CAMPAIGN.some((c) => c.id === q.missionId), q.id).toBe(true);
    }
  });
  it('covers every category and every campaign chapter', () => {
    for (const cat of Object.keys(CATEGORIES)) expect(QUIZ.filter((q) => q.category === cat).length, cat).toBeGreaterThanOrEqual(4);
    for (const c of CAMPAIGN) expect(QUIZ.filter((q) => q.missionId === c.id).length, c.id).toBeGreaterThanOrEqual(4);
    expect(QUIZ.filter((q) => q.dataLab).length).toBeGreaterThanOrEqual(4);
  });
  it('spreads correct answers across positions', () => {
    const counts = [0, 1, 2, 3].map((i) => QUIZ.filter((q) => q.answer === i).length);
    for (const n of counts) expect(n).toBeGreaterThan(QUIZ.length * 0.15);
  });
});

describe('Achievements integrity', () => {
  it('has about 25+ badges, each with a check function', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);
    expect(unique(ACHIEVEMENTS.map((a) => a.id))).toBe(true);
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.check, a.id).toBe('function');
      expect(ACHIEVEMENT_CATEGORIES[a.category], a.id).toBeDefined();
      expect(a.icon && a.title && a.desc, a.id).toBeTruthy();
    }
    for (const cat of Object.keys(ACHIEVEMENT_CATEGORIES)) expect(ACHIEVEMENTS.some((a) => a.category === cat), cat).toBe(true);
  });
});

describe('Lessons and standards', () => {
  it('has one lesson per campaign chapter plus standalone lessons', () => {
    expect(unique(LESSONS.map((l) => l.id))).toBe(true);
    for (const c of CAMPAIGN) expect(LESSONS.filter((l) => l.missionId === c.id), c.id).toHaveLength(1);
    expect(LESSONS.filter((l) => !l.missionId).length).toBeGreaterThanOrEqual(2);
  });
  it('references real dictionary terms, missions and NGSS codes', () => {
    const code = /^(K|[1-5]|3-5|MS|HS)-(PS|LS|ESS|ETS)\d-\d$/;
    for (const l of LESSONS) {
      for (const t of l.terms) expect(termById(t), `${l.id} -> ${t}`).not.toBeNull();
      if (l.missionId) expect(CAMPAIGN.some((c) => c.id === l.missionId), l.id).toBe(true);
      for (const n of l.ngss) {
        expect(n, l.id).toMatch(code);
        expect(NGSS_STANDARDS[n], `${l.id} -> ${n}`).toBeDefined();
      }
      expect(l.objectives.length && l.steps.length && l.discussion.length, l.id).toBeTruthy();
      expect(l.warmUp && l.extension && l.gradeBand && l.minutes > 0, l.id).toBeTruthy();
    }
  });
  it('summarizes coverage for every standard used', () => {
    const used = new Set(LESSONS.flatMap((l) => l.ngss));
    expect(new Set(NGSS_ALIGNMENT.map((r) => r.code))).toEqual(used);
    for (const row of NGSS_ALIGNMENT) expect(row.lessons.length, row.code).toBeGreaterThan(0);
  });
});

describe('Facts, comparison, timeline and doses', () => {
  it('has 40+ cited facts', () => {
    expect(DID_YOU_KNOW.length).toBeGreaterThanOrEqual(40);
    expect(unique(DID_YOU_KNOW.map((f) => f.text))).toBe(true);
    for (const f of DID_YOU_KNOW) {
      expect(SOURCES[f.source], f.text).toBeDefined();
      if (f.term) expect(termById(f.term), f.text).not.toBeNull();
    }
  });
  it('fills every comparison row for Earth, Moon and Mars with a source', () => {
    for (const row of COMPARISON_ROWS) {
      if (row.term) expect(termById(row.term), row.key).not.toBeNull();
      for (const body of BODIES) {
        expect(COMPARISON[body][row.key], `${body}.${row.key}`).not.toBeUndefined();
        expect(SOURCES[comparisonSource(row, body)], `${body}.${row.key}`).toBeDefined();
      }
    }
    expect(COMPARISON.mars.gravityPct).toBeCloseTo(100 * COMPARISON.mars.gravity / COMPARISON.earth.gravity, -1);
  });
  it('timeline and dose ladder cite real sources', () => {
    for (const t of TIMELINE) {
      expect(SOURCES[t.source], t.title).toBeDefined();
      expect(BODIES, t.title).toContain(t.body);
    }
    for (const d of DOSE_LADDER) expect(SOURCES[d.source], d.id).toBeDefined();
  });
});
