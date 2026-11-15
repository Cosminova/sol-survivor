import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TRACKS, trackFor, stormCardOpen, effectiveVolume } from '../src/audio/tracks.js';

const mission = (body, extra = {}) => ({ config: { body }, phase: 'plan', pendingEvent: null, ...extra });
const withCard = (body, id) => mission(body, { phase: 'event', pendingEvent: { id } });

describe('route to track mapping', () => {
  it('menus play Pale Blue', () => {
    for (const route of ['home', 'campaign', 'dictionary', 'academy', 'datalab', 'tools', 'badges', 'educators', 'settings', 'patch']) {
      expect(trackFor(route), route).toBe('pale-blue');
    }
  });

  it('packing the lander plays Near Earth and the debrief plays Lantern Moss', () => {
    expect(trackFor('loadout')).toBe('near-earth');
    expect(trackFor('debrief', mission('mars'))).toBe('lantern-moss');
  });

  it('missions play a track per world', () => {
    expect(trackFor('play', mission('moon'))).toBe('deep-space');
    expect(trackFor('play', mission('mars'))).toBe('alien-world');
  });

  it('solar storm and dust storm cards switch to Far Shore, then back', () => {
    expect(trackFor('play', withCard('mars', 'sep_alert'))).toBe('far-shore');
    expect(trackFor('play', withCard('mars', 'dust_storm'))).toBe('far-shore');
    expect(trackFor('play', withCard('moon', 'global_storm'))).toBe('far-shore');
    expect(trackFor('play', mission('moon', { phase: 'resolved', pendingEvent: { id: 'sep_alert' } }))).toBe('deep-space');
  });

  it('other event cards keep the mission track', () => {
    expect(stormCardOpen(withCard('mars', 'birthday'))).toBe(false);
    expect(trackFor('play', withCard('mars', 'birthday'))).toBe('alien-world');
  });

  it('the play screen without a mission falls back to the menu track', () => {
    expect(trackFor('play', null)).toBe('pale-blue');
    expect(trackFor('unknown-route')).toBe('pale-blue');
  });

  it('every mapped track has a file in public/audio', () => {
    for (const t of Object.values(TRACKS)) {
      expect(fs.existsSync(path.join('public', 'audio', t.file)), t.file).toBe(true);
    }
  });
});

describe('effective volume', () => {
  it('applies mute, ducking and clamping', () => {
    expect(effectiveVolume({ volume: 0.35 })).toBeCloseTo(0.35);
    expect(effectiveVolume({ volume: 0.35, muted: true })).toBe(0);
    expect(effectiveVolume({ volume: 0.5, duck: 0.3 })).toBeCloseTo(0.15);
    expect(effectiveVolume({ volume: 4 })).toBe(1);
    expect(effectiveVolume({ volume: Number.NaN })).toBe(0);
  });
});

describe('music settings', () => {
  const KEY = 'sol-survivor:v1';
  const fakeStorage = (initial = {}) => {
    const data = { ...initial };
    return {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: (k) => { delete data[k]; },
      data,
    };
  };
  const loadStore = async (storage) => {
    vi.resetModules();
    vi.stubGlobal('localStorage', storage);
    return import('../src/state/store.js');
  };

  afterEach(() => vi.unstubAllGlobals());

  it('defaults to music on at 35% volume', async () => {
    const store = await loadStore(fakeStorage());
    expect(store.DEFAULT_SETTINGS.musicOn).toBe(true);
    expect(store.DEFAULT_SETTINGS.musicVolume).toBe(0.35);
    expect(store.getState().settings.musicOn).toBe(true);
    expect(store.getState().settings.musicVolume).toBe(0.35);
  });

  it('saves music choices and restores them on the next visit', async () => {
    const storage = fakeStorage();
    const first = await loadStore(storage);
    first.setSettings({ musicOn: false, musicVolume: 0.6 });
    expect(JSON.parse(storage.data[KEY]).settings).toMatchObject({ musicOn: false, musicVolume: 0.6 });

    const second = await loadStore(storage);
    expect(second.getState().settings).toMatchObject({ musicOn: false, musicVolume: 0.6 });
  });

  it('older saves without music fields get the defaults', async () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ settings: { sound: true } }) });
    const store = await loadStore(storage);
    expect(store.getState().settings).toMatchObject({ sound: true, musicOn: true, musicVolume: 0.35 });
  });
});
