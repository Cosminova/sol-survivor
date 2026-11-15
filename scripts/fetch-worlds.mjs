#!/usr/bin/env node
// Saves a snapshot of nearby rocky exoplanets from the NASA Exoplanet Archive into
// src/data/exoWorlds.generated.js (npm run fetch-worlds). The game reads the snapshot, never the live table,
// so a build is reproducible and works offline.
//
// Table: pscomppars (Planetary Systems Composite Parameters), one row per planet.
// Scope: host star within 50 light-years, and rocky: radius <= 1.6 Earth radii, or, when there is no usable
// radius, mass <= 5 Earth masses.
//
// Honesty about what was measured: pscomppars fills gaps with computed values (a radius from a mass-radius
// relation for planets found by radial velocity, a density from mass and radius, ...). The archive marks those
// with the reference "Calculated Value", and marks limits with a *lim flag. This script keeps that marking in
// the *Calc and massKind fields so the game can label such numbers "derived" instead of "real".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data', 'exoWorlds.generated.js');
const TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

const PARSECS_PER_50_LY = 15.33; // 50 ly / 3.26156 ly per parsec
const MAX_ROCKY_RADIUS_EARTH = 1.6;
const MAX_ROCKY_MASS_EARTH = 5;
const MIN_EXPECTED_PLANETS = 40; // far fewer means the query or the service is broken: refuse to overwrite

const COLUMNS = [
  'pl_name', 'hostname', 'sy_dist', 'ra', 'dec', 'sy_snum', 'sy_pnum',
  'pl_orbsmax', 'pl_orbsmax_reflink', 'pl_orbper', 'pl_orbeccen',
  'pl_rade', 'pl_radelim', 'pl_rade_reflink',
  'pl_bmasse', 'pl_bmasselim', 'pl_bmassprov', 'pl_bmasse_reflink',
  'pl_dens', 'pl_dens_reflink', 'pl_eqt', 'pl_eqt_reflink', 'pl_insol', 'pl_insol_reflink',
  'st_teff', 'st_rad', 'st_mass', 'st_lum', 'st_lum_reflink', 'st_spectype',
  'discoverymethod', 'disc_year', 'tran_flag', 'rv_flag', 'pl_controv_flag',
];

const QUERY = `select ${COLUMNS.join(',')} from pscomppars where sy_dist<=${PARSECS_PER_50_LY} `
  + `and (pl_rade<=${MAX_ROCKY_RADIUS_EARTH} or pl_bmasse<=${MAX_ROCKY_MASS_EARTH}) order by sy_dist,hostname,pl_orbper`;

const ENTITIES = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç', ouml: 'ö', uuml: 'ü', amp: '&' };
const CALCULATED = 'Calculated Value';

// "<a refstr=... href=...>Agol et al. 2021</a>" -> "Agol et al. 2021"
export const refName = (reflink) => {
  if (!reflink) return null;
  const text = String(reflink).replace(/<[^>]*>/g, '').replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m).replace(/\s+/g, ' ').trim();
  return text || null;
};
const isCalculated = (reflink) => refName(reflink) === CALCULATED;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// The archive says where a mass came from: a true mass, a minimum mass (M sin i), or a mass-radius relation.
export const massKind = (row) => {
  if (num(row.pl_bmasse) === null) return null;
  if (row.pl_bmasselim === 1) return 'upper-limit';
  if (row.pl_bmasselim === -1) return 'lower-limit';
  if (row.pl_bmassprov === 'M-R relationship' || isCalculated(row.pl_bmasse_reflink)) return 'estimated';
  if (/sin/i.test(row.pl_bmassprov ?? '')) return 'minimum';
  return 'measured';
};

// A radius that is only a limit is not a radius: fall back to the mass rule.
export const isRocky = (row) => {
  const radius = num(row.pl_rade);
  if (radius !== null && row.pl_radelim === 0) return radius <= MAX_ROCKY_RADIUS_EARTH;
  const mass = num(row.pl_bmasse);
  return mass !== null && row.pl_bmasselim !== -1 && mass <= MAX_ROCKY_MASS_EARTH;
};

export const toPlanet = (row) => ({
  name: row.pl_name,
  aAu: num(row.pl_orbsmax), aCalc: num(row.pl_orbsmax) === null ? null : isCalculated(row.pl_orbsmax_reflink), periodDays: num(row.pl_orbper), ecc: num(row.pl_orbeccen),
  radiusEarth: num(row.pl_rade), radiusCalc: isCalculated(row.pl_rade_reflink), radiusRef: refName(row.pl_rade_reflink),
  massEarth: num(row.pl_bmasse), massKind: massKind(row), massRef: refName(row.pl_bmasse_reflink),
  densityGcc: num(row.pl_dens), densityCalc: num(row.pl_dens) === null ? null : isCalculated(row.pl_dens_reflink),
  eqK: num(row.pl_eqt), eqCalc: num(row.pl_eqt) === null ? null : isCalculated(row.pl_eqt_reflink),
  insol: num(row.pl_insol), insolCalc: num(row.pl_insol) === null ? null : isCalculated(row.pl_insol_reflink),
  method: row.discoverymethod, year: row.disc_year,
  transits: row.tran_flag === 1, controversial: row.pl_controv_flag === 1,
});

export const toSystems = (rows) => {
  const byHost = new Map();
  for (const row of rows) {
    const system = byHost.get(row.hostname) ?? {
      host: row.hostname, distPc: num(row.sy_dist), ra: num(row.ra), dec: num(row.dec),
      teffK: num(row.st_teff), radiusSol: num(row.st_rad), massSol: num(row.st_mass),
      logLumSol: num(row.st_lum), lumCalc: num(row.st_lum) === null ? null : isCalculated(row.st_lum_reflink),
      spectralType: row.st_spectype ?? null, starCount: row.sy_snum, planetCount: row.sy_pnum, planets: [],
    };
    byHost.set(row.hostname, { ...system, planets: [...system.planets, toPlanet(row)] });
  }
  return [...byHost.values()];
};

const fetchRows = async () => {
  const url = `${TAP_URL}?query=${encodeURIComponent(QUERY)}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Exoplanet Archive answered ${res.status} ${res.statusText}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('Exoplanet Archive did not return a list of rows');
  return rows;
};

const render = ({ systems, ...header }) => `// GENERATED by scripts/fetch-worlds.mjs (npm run fetch-worlds). Do not edit by hand.
// Source: NASA Exoplanet Archive, table pscomppars, retrieved ${header.retrieved} (UTC).
// *Calc: true = the archive computed this value (reference "Calculated Value"), it was not measured.
// massKind: 'measured' | 'minimum' (M sin i from radial velocity) | 'estimated' (mass-radius relation) | 'upper-limit'.
export const EXO_SNAPSHOT = {
${Object.entries(header).map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`).join('\n')}
  systems: [
${systems.map((system) => `    ${JSON.stringify(system)},`).join('\n')}
  ],
};
`;

const main = async () => {
  const rows = await fetchRows();
  const rocky = rows.filter(isRocky);
  if (rocky.length < MIN_EXPECTED_PLANETS) {
    throw new Error(`Only ${rocky.length} rocky planets came back (expected at least ${MIN_EXPECTED_PLANETS}); snapshot left untouched`);
  }
  const dropped = rows.filter((row) => !isRocky(row)).map((row) => row.pl_name);
  const snapshot = {
    source: 'NASA Exoplanet Archive, pscomppars',
    url: 'https://exoplanetarchive.ipac.caltech.edu/',
    retrieved: new Date().toISOString().slice(0, 10),
    query: QUERY,
    systems: toSystems(rocky),
  };
  fs.writeFileSync(OUT, render(snapshot));
  console.log(`Wrote ${rocky.length} planets in ${snapshot.systems.length} systems to ${path.relative(ROOT, OUT)}`);
  if (dropped.length) console.log(`Not rocky after the limit-flag check, left out: ${dropped.join(', ')}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`fetch-worlds failed: ${err.message}`);
    process.exit(1);
  });
}
