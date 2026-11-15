// Where things are in the night sky, for a date and a place on Earth. Pure math, no three.js and no DOM.
//
// Planets: JPL "Keplerian Elements for Approximate Positions of the Major Planets" (E. M. Standish, Table 1,
// valid 1800-2050, https://ssd.jpl.nasa.gov/planets/approx_pos.html). Good to a few arcminutes for the inner
// planets, far finer than a child can see.
// Moon: the main periodic terms of Meeus, Astronomical Algorithms (2nd ed.), chapter 47 (ELP-2000/82), with a
// topocentric parallax correction because the Moon is close enough to shift by up to a degree.

export const DEG = Math.PI / 180;
const J2000 = 2451545.0;
const DAYS_PER_CENTURY = 36525;
const OBLIQUITY_J2000 = 23.43928 * DEG;
const EARTH_RADIUS_KM = 6378.14;
const AU_KM = 149597870.7;
const KEPLER_TOLERANCE = 1e-9;
const KEPLER_MAX_STEPS = 30;
const PRECESSION_DEG_PER_CENTURY = 1.3969713; // general precession in ecliptic longitude

const norm360 = (deg) => ((deg % 360) + 360) % 360;
const sinD = (deg) => Math.sin(deg * DEG);
const cosD = (deg) => Math.cos(deg * DEG);

/** Julian Day for a JS Date (UTC). */
export const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;

const centuries = (jd) => (jd - J2000) / DAYS_PER_CENTURY;

// [value at J2000, rate per Julian century] for a, e, I, L, long. perihelion, long. ascending node (AU, deg).
export const PLANET_ELEMENTS = {
  mercury: [[0.38709927, 0.00000037], [0.20563593, 0.00001906], [7.00497902, -0.00594749], [252.25032350, 149472.67411175], [77.45779628, 0.16047689], [48.33076593, -0.12534081]],
  venus: [[0.72333566, 0.00000390], [0.00677672, -0.00004107], [3.39467605, -0.00078890], [181.97909950, 58517.81538729], [131.60246718, 0.00268329], [76.67984255, -0.27769418]],
  earth: [[1.00000261, 0.00000562], [0.01671123, -0.00004392], [-0.00001531, -0.01294668], [100.46457166, 35999.37244981], [102.93768193, 0.32327364], [0, 0]],
  mars: [[1.52371034, 0.00001847], [0.09339410, 0.00007882], [1.84969142, -0.00813131], [-4.55343205, 19140.30268499], [-23.94362959, 0.44441088], [49.55953891, -0.29257343]],
  jupiter: [[5.20288700, -0.00011607], [0.04838624, -0.00013253], [1.30439695, -0.00183714], [34.39644051, 3034.74612775], [14.72847983, 0.21252668], [100.47390909, 0.20469106]],
  saturn: [[9.53667594, -0.00125060], [0.05386179, -0.00050991], [2.48599187, 0.00193609], [49.95424423, 1222.49362201], [92.59887831, -0.41897216], [113.66242448, -0.28867794]],
};

/** Solves Kepler's equation M = E - e sin E (radians) by Newton's method. */
export function solveKepler(meanAnomaly, e) {
  let E = meanAnomaly + e * Math.sin(meanAnomaly);
  for (let i = 0; i < KEPLER_MAX_STEPS; i += 1) {
    const dE = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < KEPLER_TOLERANCE) break;
  }
  return E;
}

/** Heliocentric ecliptic (J2000) position of a planet in AU. */
export function heliocentric(planet, jd) {
  const el = PLANET_ELEMENTS[planet];
  if (!el) throw new Error(`No orbital elements for ${planet}`);
  const T = centuries(jd);
  const [a, e, I, L, peri, node] = el.map(([v0, rate]) => v0 + rate * T);
  const omega = (peri - node) * DEG;
  const M = (norm360(L - peri + 180) - 180) * DEG;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [cw, sw, cO, sO, cI, sI] = [Math.cos(omega), Math.sin(omega), Math.cos(node * DEG), Math.sin(node * DEG), Math.cos(I * DEG), Math.sin(I * DEG)];
  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: sw * sI * xp + cw * sI * yp,
  };
}

/** Ecliptic (J2000) to equatorial (J2000) rectangular coordinates. */
export const eclipticToEquatorial = ({ x, y, z }) => ({
  x,
  y: y * Math.cos(OBLIQUITY_J2000) - z * Math.sin(OBLIQUITY_J2000),
  z: y * Math.sin(OBLIQUITY_J2000) + z * Math.cos(OBLIQUITY_J2000),
});

/** Rectangular equatorial coordinates to { ra, dec } in degrees (ra 0..360) and distance in the same unit. */
export function toRaDec({ x, y, z }) {
  const dist = Math.hypot(x, y, z);
  return { ra: norm360(Math.atan2(y, x) / DEG), dec: Math.asin(z / dist) / DEG, dist };
}

/** Unit vector (equatorial frame: x to the vernal equinox, z to the north celestial pole) for RA/Dec in degrees. */
export const raDecToVector = (ra, dec) => [cosD(dec) * cosD(ra), cosD(dec) * sinD(ra), sinD(dec)];

/** Geocentric RA/Dec (J2000, degrees) of a planet, with distance in AU. Light time is ignored (under 1 arcmin). */
export function planetRaDec(planet, date) {
  const jd = julianDay(date);
  const p = heliocentric(planet, jd);
  const earth = heliocentric('earth', jd);
  return toRaDec(eclipticToEquatorial({ x: p.x - earth.x, y: p.y - earth.y, z: p.z - earth.z }));
}

// Meeus table 47.A (longitude in 1e-6 deg, distance in 1e-3 km) and 47.B (latitude in 1e-6 deg).
// Each row: [D, M, M', F, sin coefficient for l, cos coefficient for r].
const MOON_LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
];
const MOON_B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
];

/** Geocentric ecliptic longitude/latitude (degrees, equinox J2000) and distance (km) of the Moon. */
export function moonEcliptic(jd) {
  const T = centuries(jd);
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.2720950 + 483202.0175233 * T;
  const E = 1 - 0.002516 * T;
  const eFactor = (m) => (m === 0 ? 1 : E ** Math.abs(m));
  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, l, r] of MOON_LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    sumL += l * eFactor(m) * sinD(arg);
    sumR += r * eFactor(m) * cosD(arg);
  }
  let sumB = 0;
  for (const [d, m, mp, f, b] of MOON_B) sumB += b * eFactor(m) * sinD(d * D + m * M + mp * Mp + f * F);
  return {
    lon: norm360(Lp + sumL / 1e6 - PRECESSION_DEG_PER_CENTURY * T),
    lat: sumB / 1e6,
    distKm: 385000.56 + sumR / 1000,
  };
}

/** Greenwich mean sidereal time in degrees (IAU 1982, Meeus 12.4). */
export function gmstDeg(jd) {
  const T = centuries(jd);
  return norm360(280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Observer position in the equatorial frame, in km. */
function observerVector(observer, jd) {
  const lst = gmstDeg(jd) + observer.lon;
  return raDecToVector(lst, observer.lat).map((c) => c * EARTH_RADIUS_KM);
}

/**
 * RA/Dec of the Moon in degrees. With an observer the position is topocentric (as seen from that spot).
 * @param {Date} date
 * @param {{ lat: number, lon: number }} [observer]
 */
export function moonRaDec(date, observer) {
  const jd = julianDay(date);
  const { lon, lat, distKm } = moonEcliptic(jd);
  const [ex, ey, ez] = raDecToVector(lon, lat).map((c) => c * distKm);
  const eq = eclipticToEquatorial({ x: ex, y: ey, z: ez });
  if (!observer) return toRaDec(eq);
  const [ox, oy, oz] = observerVector(observer, jd);
  return toRaDec({ x: eq.x - ox, y: eq.y - oy, z: eq.z - oz });
}

/** Approximate Sun RA/Dec (degrees): the reverse of Earth's heliocentric position. */
export function sunRaDec(date) {
  const earth = heliocentric('earth', julianDay(date));
  return toRaDec(eclipticToEquatorial({ x: -earth.x, y: -earth.y, z: -earth.z }));
}

/**
 * Equatorial RA/Dec to the local horizon. Azimuth is measured from north through east (degrees).
 * @param {{ ra: number, dec: number }} pos
 * @param {{ lat: number, lon: number }} observer east-positive longitude
 * @param {Date} date
 */
export function toHorizontal({ ra, dec }, observer, date) {
  const ha = gmstDeg(julianDay(date)) + observer.lon - ra;
  const sinAlt = sinD(dec) * sinD(observer.lat) + cosD(dec) * cosD(observer.lat) * cosD(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;
  const az = Math.atan2(-cosD(dec) * sinD(ha), sinD(dec) * cosD(observer.lat) - cosD(dec) * sinD(observer.lat) * cosD(ha)) / DEG;
  return { alt, az: norm360(az) };
}

/** Local horizon to a three.js-style unit vector: y up, north is -z, east is +x. */
export const horizontalToVector = (alt, az) => [cosD(alt) * sinD(az), sinD(alt), -cosD(alt) * cosD(az)];

/** AU to kilometres. */
export const auToKm = (au) => au * AU_KM;

/**
 * Star colour from the B-V index: blue-white hot stars to orange-red cool ones. Returns [r, g, b] in 0..1.
 * Uses Ballesteros (2012) for temperature, then a simple blackbody-ish ramp.
 */
export function bvToRgb(bv) {
  const b = Math.max(-0.4, Math.min(2.0, Number.isFinite(bv) ? bv : 0.65));
  const t = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  return kelvinToRgb(t);
}

/** Rough colour of a blackbody at a temperature in kelvin (Tanner Helland's fit), [r, g, b] in 0..1. */
export function kelvinToRgb(kelvin) {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  const clamp01 = (v) => Math.max(0, Math.min(255, v)) / 255;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const bl = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp01(r), clamp01(g), clamp01(bl)];
}
