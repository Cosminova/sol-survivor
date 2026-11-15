import { describe, expect, test } from 'vitest';
import { WORLDS, worldById, generated } from '../src/data/worlds.js';
import { worldLook, lookFor, isLegacyWorld, starColorFromTeff, starAngularSizeDeg, starDirection, fixedSkyDirection, lookSeed } from '../src/render/worldLook.js';
import { makeSurface } from '../src/render/relief.js';
import { skyModel, starDiscGain } from '../src/render/skyModel.js';
import { lightMode } from '../src/engine/worldModel.js';
import { generateDetailTexture, generateGroundMap, generateGasGiantTexture, generateLavaTexture, generateRingTexture, cachedTexture, clearTextureCache, MAX_TEXTURE_SIZE } from '../src/render/textures.js';
import { hexToRgb, blackbodyRgb, mixHex } from '../src/render/color.js';
import { TITAN_LIKE, IO_LIKE, EUROPA_LIKE, HOT_EXOPLANET, RED_DWARF_ROCK, FIXTURE_WORLDS } from '../src/render/__fixtures__/worlds.js';

const withFacts = (world, facts) => ({ ...world, facts: { ...world.facts, ...Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, generated(v)])) } });
const isOrange = (hex) => { const [r, g, b] = hexToRgb(hex); return r > g && g > b && r - b > 0.25; };
const proxima = RED_DWARF_ROCK;

describe('worldLook: facts to look', () => {
  test('Titan-like world gets a dark methane liquid layer and orange haze', () => {
    const look = worldLook(TITAN_LIKE, TITAN_LIKE.sites[0]);

    expect(look.liquid).toMatchObject({ kind: 'methane', color: '#17110c' });
    expect(look.liquid.coverage).toBeGreaterThan(0);
    expect(look.airless).toBe(false);
    expect(look.haze).toBeGreaterThan(0.6);
    expect(isOrange(look.hazeColor)).toBe(true);
    expect(isOrange(look.skyHorizon)).toBe(true);
    expect(look.reliefStyle).toBe('dunes');
    expect(look.particles).toMatchObject({ methaneRain: true, dust: false });
  });

  test('airless worlds get a black sky and no dust', () => {
    for (const world of [worldById('moon'), proxima, IO_LIKE, EUROPA_LIKE, HOT_EXOPLANET]) {
      const look = worldLook(world);

      expect(look.airless).toBe(true);
      expect(look.skyTop).toBe('#000000');
      expect(look.skyHorizon).toBe('#000000');
      expect(look.haze).toBe(0);
      expect(look.particles.dust).toBe(false);
    }
  });

  test('dust needs both air and dust storms', () => {
    expect(worldLook(worldById('mars')).particles.dust).toBe(true);
    expect(worldLook(withFacts(worldById('mars'), { pressurePa: 0 })).particles.dust).toBe(false);
    expect(worldLook(withFacts(worldById('mars'), { hazards: ['flares'] })).particles.dust).toBe(false);
  });

  test('ice coverage grows with waterIce', () => {
    const coverages = [0, 0.2, 0.5, 0.9].map((waterIce) => worldLook(withFacts(proxima, { waterIce })).iceCoverage);

    expect(coverages[0]).toBe(0);
    for (let i = 1; i < coverages.length; i += 1) expect(coverages[i]).toBeGreaterThan(coverages[i - 1]);
  });

  test('an icy site shows more ice than a dry site on the same world', () => {
    const dry = worldLook(proxima, { id: 'a', iceAccess: 0 }).iceCoverage;
    const icy = worldLook(proxima, { id: 'b', iceAccess: 1 }).iceCoverage;

    expect(icy).toBeGreaterThan(dry);
  });

  test('haze thickens with pressure', () => {
    const haze = [610, 101325, 9200000].map((pressurePa) => worldLook(withFacts(worldById('mars'), { pressurePa })).haze);

    expect(haze[0]).toBeLessThan(haze[1]);
    expect(haze[1]).toBeLessThan(haze[2]);
    expect(haze[2]).toBeGreaterThan(0.95);
  });

  test('ground type picks the relief style and accents', () => {
    expect(worldLook(IO_LIKE).reliefStyle).toBe('lava-flows');
    expect(worldLook(IO_LIKE).groundColors.accents).toContain('#d9c341');
    expect(worldLook(IO_LIKE).lava).toBeGreaterThan(0);
    expect(worldLook(EUROPA_LIKE).reliefStyle).toBe('ice-chaos');
    expect(worldLook(EUROPA_LIKE).iceCoverage).toBeGreaterThanOrEqual(0.6);
    expect(worldLook(EUROPA_LIKE).liquid).toBeNull();
    expect(worldLook(HOT_EXOPLANET).reliefStyle).toBe('lava-flows');
    expect(worldLook(withFacts(HOT_EXOPLANET, { ground: 'basalt' })).reliefStyle).toBe('fractured-basalt');
    expect(worldLook(proxima).reliefStyle).toBe('craters');
    expect(worldLook(withFacts(worldById('mars'), { tempDayC: 460, pressurePa: 9200000 })).reliefStyle).toBe('fractured-basalt');
  });

  test('lava glows on lava ground and on volcanic worlds only', () => {
    expect(worldLook(HOT_EXOPLANET).lava).toBeGreaterThan(worldLook(IO_LIKE).lava);
    expect(worldLook(proxima).lava).toBe(0);
    expect(worldLook(TITAN_LIKE).lava).toBe(0);
  });

  test('plumes come from cryovolcanism and airless volcanism', () => {
    expect(worldLook(EUROPA_LIKE).particles.plumes).toBe(true);
    expect(worldLook(IO_LIKE).particles.plumes).toBe(true);
    expect(worldLook(proxima).particles.plumes).toBe(false);
  });

  test('missing palette and facts fall back instead of throwing', () => {
    const look = worldLook({ id: 'bare', kind: 'planet' });

    expect(look.reliefStyle).toBe('craters');
    expect(look.groundColors.base).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('star and sky bodies', () => {
  test('a red dwarf looks big and orange-red from a close-in planet', () => {
    const look = worldLook(proxima);
    const [r, g, b] = hexToRgb(look.starColor);

    expect(look.starAngularSizeDeg).toBeGreaterThan(1.2);
    expect(look.starAngularSizeDeg).toBeLessThan(2);
    expect(r).toBeGreaterThan(0.9);
    expect(g).toBeLessThan(0.6);
    expect(b).toBeLessThan(0.3);
    expect(starDiscGain(look)).toBeLessThan(starDiscGain(worldLook(worldById('mars'))));
  });

  test('the Sun keeps its real size and near-white colour', () => {
    expect(starAngularSizeDeg(1, 1)).toBeCloseTo(0.533, 2);
    expect(worldLook(worldById('mars')).starAngularSizeDeg).toBeCloseTo(0.35, 2);
    const [r, g, b] = hexToRgb(starColorFromTeff(5772));
    expect(Math.min(r, g, b)).toBeGreaterThan(0.85);
    expect(blackbodyRgb(9000)[2]).toBeGreaterThan(blackbodyRgb(9000)[0]);
  });

  test('a moon sees the Sun from its planet distance even when its own orbit is tiny', () => {
    const look = worldLook(withFacts(IO_LIKE, { orbitAu: 0.0028 }));

    expect(look.starAngularSizeDeg).toBeCloseTo(starAngularSizeDeg(1, 5.203), 3);
  });

  test('Jupiter and Saturn hang in the sky of their moons, but haze hides Saturn from Titan', () => {
    expect(worldLook(IO_LIKE).parent).toMatchObject({ id: 'jupiter', rings: false, visible: true });
    expect(worldLook(TITAN_LIKE).parent).toMatchObject({ id: 'saturn', rings: true, visible: false });
    expect(worldLook({ ...IO_LIKE, id: 'io' }).parent.angularSizeDeg).toBeCloseTo(19.3, 0);
    expect(worldLook(proxima).parent).toBeNull();
    expect(worldLook(worldById('moon')).parent).toBeNull();
  });

  test('tidally locked worlds keep the star fixed in the sky', () => {
    const look = worldLook(proxima);
    const site = { id: 's', lat: 10, lon: 30 };

    expect(look.starFixed).toBe(true);
    expect(starDirection(look, site, 0.1)).toEqual(starDirection(look, site, 0.9));
    expect(look.light).toBe('day');
    expect(starDirection(look, site, 0.5).elevationDeg).toBeGreaterThan(40);
    expect(starDirection(look, site, 0.5, false).elevationDeg).toBeGreaterThan(40); // no night on the day side
    expect(fixedSkyDirection({ lat: 0, lon: 0 }).elevationDeg).toBeCloseTo(90, 3);
    expect(starDirection(worldLook(proxima, { id: 't', lat: 0, lon: 90 }), null, 0.5).elevationDeg).toBeCloseTo(6, 3); // twilight ring
    expect(starDirection(worldLook(proxima, { id: 'n', lat: 0, lon: 180 }), null, 0.5).elevationDeg).toBeLessThan(0); // night side
  });

  test('other worlds see the star rise, peak at midday and set', () => {
    const look = worldLook(TITAN_LIKE);
    const site = { id: 's', lat: 20, lon: 0 };

    expect(look.starFixed).toBe(false);
    expect(starDirection(look, site, 0.5).elevationDeg).toBeCloseTo(70, 0);
    expect(starDirection(look, site, 0.05).elevationDeg).toBeLessThan(15);
    expect(starDirection(look, site, 0.5, false).elevationDeg).toBeLessThan(0);
    const dir = starDirection(look, site, 0.3);
    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1, 6);
  });
});

describe('skyModel', () => {
  test('airless sky stays black with stars out by day', () => {
    const sky = skyModel(worldLook(IO_LIKE), { sunElevDeg: 40 });

    expect(sky.zenith).toBe('#000000');
    expect(sky.fogDensity).toBe(0);
    expect(sky.stars).toBeGreaterThan(0);
    expect(sky.sunIntensity).toBeGreaterThan(0);
  });

  test('thick haze means more fog, a hidden star disc and less direct light than thin air', () => {
    const thin = skyModel(worldLook(withFacts(TITAN_LIKE, { pressurePa: 600 })), { sunElevDeg: 40 });
    const thick = skyModel(worldLook(TITAN_LIKE), { sunElevDeg: 40 });

    expect(thick.fogDensity).toBeGreaterThan(thin.fogDensity * 3);
    expect(thick.sunIntensity).toBeLessThan(thin.sunIntensity);
    expect(thick.dust).toBeGreaterThan(thin.dust);
    expect(thick.stars).toBe(0);
    expect(isOrange(thick.horizon)).toBe(true);
  });

  test('night is dark and a storm only matters on dusty worlds', () => {
    const titan = worldLook(TITAN_LIKE);

    expect(skyModel(titan, { sunElevDeg: -20 }).sunIntensity).toBe(0);
    expect(skyModel(worldLook(IO_LIKE), { sunElevDeg: 30, lit: false }).sunIntensity).toBe(0);
    expect(skyModel(titan, { sunElevDeg: 40, tau: 4 }).zenith).toBe(skyModel(titan, { sunElevDeg: 40, tau: 0.5 }).zenith);
  });
});

describe('makeSurface', () => {
  const pads = [{ x: 0, z: 0, r: 9 }, { x: 20, z: 10, r: 4 }];

  test('same seed gives the same ground, a different site gives different ground', () => {
    const look = worldLook(EUROPA_LIKE, EUROPA_LIKE.sites[0]);
    const a = makeSurface(look, { pads });
    const b = makeSurface(look, { pads });
    const other = makeSurface(worldLook(EUROPA_LIKE, { id: 'elsewhere' }), { pads });

    expect(a.heightAt(37, -52)).toBe(b.heightAt(37, -52));
    expect(a.colorAt(37, -52)).toEqual(b.colorAt(37, -52));
    expect(a.heightAt(37, -52)).not.toBe(other.heightAt(37, -52));
  });

  test('building pads stay flat and dry on every style', () => {
    for (const world of [...FIXTURE_WORLDS, proxima]) {
      const surface = makeSurface(worldLook(world, world.sites[0] ?? null), { pads });

      expect(Math.abs(surface.heightAt(0, 0))).toBeLessThan(0.01);
      expect(Math.abs(surface.heightAt(3, -4) - surface.heightAt(-5, 2))).toBeLessThan(0.02);
      expect(Math.abs(surface.heightAt(21, 11))).toBeLessThan(0.05);
      if (surface.poolLevel !== null) expect(surface.poolLevel).toBeLessThan(-0.4);
      for (let i = 0; i < 200; i += 1) {
        const h = surface.heightAt(Math.sin(i) * 90, Math.cos(i * 1.7) * 90);
        expect(Number.isFinite(h)).toBe(true);
        expect(Math.abs(h)).toBeLessThan(12); // walkable near the base
        surface.colorAt(Math.sin(i) * 300, Math.cos(i * 1.7) * 300).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1.0001); });
      }
    }
  });

  test('Titan-like ground has pools and the airless rock has none', () => {
    const titan = makeSurface(worldLook(TITAN_LIKE, TITAN_LIKE.sites[0]), { pads });
    const rock = makeSurface(worldLook(proxima), { pads });
    let flooded = 0;
    for (let x = -200; x <= 200; x += 10) for (let z = -200; z <= 200; z += 10) if (titan.heightAt(x, z) < titan.poolLevel) flooded += 1;

    expect(flooded).toBeGreaterThan(20);
    expect(flooded / 1681).toBeLessThan(0.4);
    expect(rock.poolLevel).toBeNull();
    expect(rock.craters.length).toBeGreaterThan(10);
  });

  test('lava stays inside fenced pits within walking range', () => {
    const surface = makeSurface(worldLook(HOT_EXOPLANET, HOT_EXOPLANET.sites[0]), { pads });
    const inPit = (x, z) => surface.basins.some((b) => Math.hypot(x - b.x, z - b.z) < b.r);

    for (let x = -95; x <= 95; x += 5) {
      for (let z = -95; z <= 95; z += 5) {
        if (Math.hypot(x, z) < 95 && !inPit(x, z)) expect(surface.heightAt(x, z)).toBeGreaterThan(surface.poolLevel);
      }
    }
    surface.poolColliders.forEach((c) => expect(c.r).toBeGreaterThan(0));
  });

  test('more ice on the world means more icy ground', () => {
    const iceShare = (waterIce) => {
      const look = worldLook(withFacts(proxima, { waterIce, tempDayC: -60 }));
      const surface = makeSurface(look, { pads });
      const ice = hexToRgb(look.groundColors.ice);
      let near = 0;
      for (let x = -150; x <= 150; x += 6) for (let z = -150; z <= 150; z += 6) {
        const c = surface.colorAt(x, z);
        if (Math.hypot(c[0] - ice[0], c[1] - ice[1], c[2] - ice[2]) < 0.2) near += 1;
      }
      return near;
    };

    expect(iceShare(0)).toBe(0);
    expect(iceShare(0.9)).toBeGreaterThan(iceShare(0.3));
    expect(iceShare(0.3)).toBeGreaterThan(0);
  });

  test('distant ground rises into hills and small worlds curve away', () => {
    const surface = makeSurface(worldLook(EUROPA_LIKE), { pads });
    const far = Array.from({ length: 60 }, (_, i) => surface.landformAt(Math.sin(i) * 2000, Math.cos(i) * 2000));

    expect(Math.max(...far) - Math.min(...far)).toBeGreaterThan(10);
    expect(surface.landformAt(10, 10)).toBe(0);
    expect(surface.extent).toBeGreaterThan(1000);
  });
});

describe('texture generators', () => {
  test('same seed gives the same texture bytes', () => {
    const look = worldLook(IO_LIKE, IO_LIKE.sites[0]);
    const a = generateDetailTexture(look, 64);
    const b = generateDetailTexture(worldLook(IO_LIKE, IO_LIKE.sites[0]), 64);

    expect(a.width).toBe(64);
    expect(a.data.length).toBe(64 * 64 * 4);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  test('a different site or world gives different bytes', () => {
    const a = generateDetailTexture(worldLook(IO_LIKE, IO_LIKE.sites[0]), 64);
    const otherSite = generateDetailTexture(worldLook(IO_LIKE, { id: 'other' }), 64);
    const otherWorld = generateDetailTexture(worldLook(EUROPA_LIKE, EUROPA_LIKE.sites[0]), 64);

    expect(Buffer.from(a.data).equals(Buffer.from(otherSite.data))).toBe(false);
    expect(Buffer.from(a.data).equals(Buffer.from(otherWorld.data))).toBe(false);
    expect(lookSeed('fx-io', 'a')).not.toBe(lookSeed('fx-io', 'b'));
  });

  test('ground map is deterministic, opaque and takes its colours from the world', () => {
    const look = worldLook(IO_LIKE, IO_LIKE.sites[0]);
    const surface = makeSurface(look);
    const a = generateGroundMap(look, surface, { size: 48, extentM: 260 });
    const b = generateGroundMap(look, makeSurface(look), { size: 48, extentM: 260 });
    let red = 0; let blue = 0;
    for (let i = 0; i < a.data.length; i += 4) { red += a.data[i]; blue += a.data[i + 2]; expect(a.data[i + 3]).toBe(255); }

    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    expect(red).toBeGreaterThan(blue * 1.3); // sulfur yellows, not grey
  });

  test('textures never exceed 1024 px and the cache generates once', () => {
    const look = worldLook(EUROPA_LIKE);
    let calls = 0;
    clearTextureCache();
    const make = () => { calls += 1; return generateLavaTexture(4096, 3); };
    const first = cachedTexture('k', make);
    const second = cachedTexture('k', make);

    expect(first.width).toBe(MAX_TEXTURE_SIZE);
    expect(second).toBe(first);
    expect(calls).toBe(1);
    expect(generateDetailTexture(look, 16).data.length).toBe(16 * 16 * 4);
  });

  test('giant planet, ring and lava textures are deterministic and coloured', () => {
    const parent = worldLook(IO_LIKE).parent;
    const giant = generateGasGiantTexture(parent, 64, 5);
    const ring = generateRingTexture(64, 7);
    const lava = generateLavaTexture(32, 11);

    expect(giant.height).toBe(32);
    expect(Buffer.from(giant.data).equals(Buffer.from(generateGasGiantTexture(parent, 64, 5).data))).toBe(true);
    expect(ring.height).toBe(1);
    expect(ring.data[3]).toBe(0); // rings fade out at the inner edge
    expect(lava.data[0]).toBeGreaterThan(lava.data[2]);
    expect(Buffer.from(lava.data).equals(Buffer.from(generateLavaTexture(32, 11).data))).toBe(true);
  });
});

describe('legacy worlds and lookups', () => {
  test('Moon and Mars keep their existing look (no procedural look is handed out)', () => {
    expect(isLegacyWorld(worldById('moon'))).toBe(true);
    expect(isLegacyWorld(worldById('mars'))).toBe(true);
    expect(lookFor('moon')).toBeNull();
    expect(lookFor('mars')).toBeNull();
    expect(lookFor(undefined)).toBeNull();
    expect(lookFor('no-such-world')).toBeNull();
  });

  test('other worlds get a cached look per site', () => {
    const a = lookFor('proxima-cen-b', { id: 'north' });

    expect(a).toBe(lookFor('proxima-cen-b', { id: 'north' }));
    expect(a.seed).not.toBe(lookFor('proxima-cen-b', { id: 'south' }).seed);
    expect(a.worldId).toBe('proxima-cen-b');
  });

  test('the real Titan gets methane lakes, orange haze and drizzle; Io sulfur and Jupiter; Enceladus plumes', () => {
    const titan = worldLook(worldById('titan'), worldById('titan').sites[0]);
    const io = worldLook(worldById('io'));
    const enceladus = worldLook(worldById('enceladus'));

    expect(titan.liquid).toMatchObject({ kind: 'methane', color: worldById('titan').palette.liquid });
    expect(isOrange(titan.hazeColor)).toBe(true);
    expect(titan.particles.methaneRain).toBe(true);
    expect(titan.reliefStyle).toBe('dunes');
    expect(io).toMatchObject({ reliefStyle: 'lava-flows', airless: true });
    expect(io.parent.id).toBe('jupiter');
    expect(io.lava).toBeGreaterThan(0);
    expect(enceladus.particles.plumes).toBe(true);
    expect(enceladus.reliefStyle).toBe('ice-chaos');
    expect(worldLook(worldById('europa')).parent.angularSizeDeg).toBeGreaterThan(10);
  });

  test('every world in the catalogue produces a complete look', () => {
    expect(WORLDS.length).toBeGreaterThan(3);
    for (const world of WORLDS) {
      const look = worldLook(world, world.sites?.[0] ?? null);
      const sky = skyModel(look, { sunElevDeg: 30 });

      expect(look.airless).toBe(world.facts.pressurePa.v < 10);
      if (look.airless) expect(look.skyTop).toBe('#000000');
      if (look.airless) expect(look.particles.dust).toBe(false);
      for (const site of world.sites ?? []) {
        const siteLook = worldLook(world, site);
        const el = starDirection(siteLook, site, 0.3).elevationDeg;
        expect(siteLook.light).toBe(lightMode(world, site));
        if (siteLook.light === 'night') expect(el).toBeLessThan(0);
        if (siteLook.light === 'twilight') expect(el).toBeLessThan(8);
        if (siteLook.light === 'day') expect(el).toBeGreaterThan(10);
        if (siteLook.starFixed) expect(starDirection(siteLook, site, 0.9)).toEqual(starDirection(siteLook, site, 0.1));
      }
      expect(sky.zenith).toMatch(/^#[0-9a-f]{6}$/);
      expect(Number.isFinite(sky.sunIntensity + sky.fogDensity + sky.hemiIntensity)).toBe(true);
      expect(look.starColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(Number.isFinite(starDirection(look, world.sites?.[0] ?? null, 0.4).elevationDeg)).toBe(true);

      expect(look.groundColors.base).toMatch(/^#[0-9a-f]{6}$/i);
      expect(look.starAngularSizeDeg).toBeGreaterThan(0);
      expect(look.iceCoverage).toBeGreaterThanOrEqual(0);
      expect(look.iceCoverage).toBeLessThanOrEqual(1);
      expect(mixHex(look.skyTop, look.skyHorizon, 0.5)).toMatch(/^#[0-9a-f]{6}$/);
      expect(makeSurface(look).heightAt(12, 30)).toEqual(expect.any(Number));
    }
  });
});
