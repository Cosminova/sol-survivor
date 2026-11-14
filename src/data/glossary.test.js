import { describe, it, expect } from 'vitest';
import { GLOSSARY, termById } from './glossary.js';
import { SOURCES } from '../data/sources.js';
import { EVENT_CARDS } from './eventCards.js';
import { MODULES, SUPPLIES } from './modules.js';
import { SITES } from './sites.js';

// Collect every term id the data files reference: [[term]] / [[term|label]] in text, `term`, and `terms`.
function referencedTerms() {
  const ids = new Set();
  const scanText = (text) => {
    if (typeof text !== 'string') return;
    for (const m of text.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]*)?\]\]/g)) ids.add(m[1]);
  };
  const scanObject = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'term' && typeof value === 'string') ids.add(value);
      else if (key === 'terms' && Array.isArray(value)) value.forEach((t) => ids.add(t));
      else if (typeof value === 'string') scanText(value);
      else if (Array.isArray(value)) value.forEach(scanObject);
      else if (typeof value === 'object') scanObject(value);
    }
  };
  [...EVENT_CARDS, ...MODULES, ...SUPPLIES, ...SITES].forEach(scanObject);
  return [...ids].sort();
}

describe('glossary', () => {
  it('defines every term referenced by cards, modules, supplies and sites', () => {
    const missing = referencedTerms().filter((id) => !GLOSSARY[id]);
    expect(missing).toEqual([]);
  });

  it('covers the core trainer vocabulary', () => {
    for (const id of ['sol', 'radiation-dose', 'galactic-cosmic-rays', 'kilowatt-hour', 'oxygen', 'morale', 'battery-bank']) {
      expect(termById(id), id).not.toBeNull();
    }
  });

  it('entries are well formed and kid-sized', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.id).toBe(key);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.short.split(/\s+/).length, `${key}.short word count`).toBeLessThanOrEqual(25);
      if (entry.long) expect(entry.long.length).toBeGreaterThan(20);
    }
  });

  it('every source id points at the bibliography', () => {
    const bad = Object.values(GLOSSARY).filter((e) => e.source && !SOURCES[e.source]).map((e) => `${e.id} -> ${e.source}`);
    expect(bad).toEqual([]);
  });

  it('termById returns null for unknown ids', () => {
    expect(termById('not-a-term')).toBeNull();
  });
});
