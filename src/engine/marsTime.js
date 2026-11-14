// Mars24 algorithm (Allison & McEwen 2000, NASA GISS) plus JPL approximate planet positions.
const DEG = Math.PI / 180;
const TT_MINUS_UTC_S = 69.184;
const SOL_DAYS = 1.0274912517;
const LIGHT_SECONDS_PER_AU = 499.004784;

const PBS_TERMS = [
  [0.0071, 2.2353, 49.409],
  [0.0057, 2.7543, 168.173],
  [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736],
  [0.0021, 2.1354, 15.704],
  [0.002, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
];

const mod = (x, m) => ((x % m) + m) % m;

export const julianDateUT = (date) => date.getTime() / 86400000 + 2440587.5;

export function marsTime(date) {
  const jdTT = julianDateUT(date) + TT_MINUS_UTC_S / 86400;
  const dt = jdTT - 2451545.0;
  const M = 19.3871 + 0.52402073 * dt;
  const alphaFMS = 270.3871 + 0.524038496 * dt;
  const pbs = PBS_TERMS.reduce((sum, [A, tau, phi]) => sum + A * Math.cos(DEG * ((0.985626 * dt) / tau + phi)), 0);
  const nuMinusM = (10.691 + 3.0e-7 * dt) * Math.sin(DEG * M)
    + 0.623 * Math.sin(2 * DEG * M)
    + 0.05 * Math.sin(3 * DEG * M)
    + 0.005 * Math.sin(4 * DEG * M)
    + 0.0005 * Math.sin(5 * DEG * M)
    + pbs;
  const ls = mod(alphaFMS + nuMinusM, 360);
  const msd = (dt - 4.5) / SOL_DAYS + 44796.0 - 0.0009626;
  const mtcHours = mod(24 * msd, 24);
  return { msd, mtcHours, ls, marsYear: marsYearFor(date, ls) };
}

// Mars Year 1 began on 11 April 1955 (Clancy et al. 2000 convention).
const MY1_START = Date.UTC(1955, 3, 11);
const MARS_YEAR_DAYS = 686.9726;

function marsYearFor(date, ls) {
  const approx = 1 + (date.getTime() - MY1_START) / 864e5 / MARS_YEAR_DAYS;
  const whole = Math.floor(approx);
  const frac = approx - whole;
  if (frac < 0.1 && ls > 300) return whole - 1;
  if (frac > 0.9 && ls < 60) return whole + 1;
  return whole;
}

export function localSolarHours(date, lonEastDeg) {
  return mod(marsTime(date).mtcHours + lonEastDeg / 15, 24);
}

export function missionSol(date, landingDate, lonEastDeg) {
  const local = (d) => marsTime(d).msd + lonEastDeg / 360;
  return Math.floor(local(date)) - Math.floor(local(landingDate));
}

export const MISSIONS = {
  curiosity: { name: 'Curiosity', landing: new Date('2012-08-06T05:17:57Z'), lon: 137.42, site: 'Gale Crater' },
  perseverance: { name: 'Perseverance', landing: new Date('2021-02-18T20:55:00Z'), lon: 77.45, site: 'Jezero Crater' },
};

export function seasonName(ls, northern = true) {
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const index = Math.floor(mod(ls, 360) / 90);
  return northern ? seasons[index] : seasons[(index + 2) % 4];
}

export const formatHours = (hours) => {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor(((hours - h) * 60 - m) * 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

// JPL "Approximate Positions of the Planets", Table 1 (valid 1800–2050).
const ELEMENTS = {
  earth: {
    base: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  },
  mars: {
    base: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  },
};

function solveKepler(Mdeg, e) {
  const M = DEG * mod(Mdeg + 180, 360) - Math.PI;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i += 1) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

export function heliocentric(planet, date) {
  const T = (julianDateUT(date) - 2451545.0) / 36525;
  const { base, rate } = ELEMENTS[planet];
  const [a, e, I, L, varpi, Omega] = base.map((v, i) => v + rate[i] * T);
  const omega = varpi - Omega;
  const E = solveKepler(L - varpi, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [co, so] = [Math.cos(DEG * omega), Math.sin(DEG * omega)];
  const [cO, sO] = [Math.cos(DEG * Omega), Math.sin(DEG * Omega)];
  const [cI, sI] = [Math.cos(DEG * I), Math.sin(DEG * I)];
  return {
    x: (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    y: (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    z: so * sI * xp + co * sI * yp,
  };
}

export function earthMarsDistanceAU(date) {
  const e = heliocentric('earth', date);
  const m = heliocentric('mars', date);
  return Math.hypot(m.x - e.x, m.y - e.y, m.z - e.z);
}

export function lightDelaySeconds(date) {
  return earthMarsDistanceAU(date) * LIGHT_SECONDS_PER_AU;
}

// Angle Sun–Earth–Mars. Under ~3° radio contact is blocked (solar conjunction).
export function sunEarthMarsAngleDeg(date) {
  const e = heliocentric('earth', date);
  const m = heliocentric('mars', date);
  const toSun = { x: -e.x, y: -e.y, z: -e.z };
  const toMars = { x: m.x - e.x, y: m.y - e.y, z: m.z - e.z };
  const dot = toSun.x * toMars.x + toSun.y * toMars.y + toSun.z * toMars.z;
  const norms = Math.hypot(toSun.x, toSun.y, toSun.z) * Math.hypot(toMars.x, toMars.y, toMars.z);
  return Math.acos(Math.max(-1, Math.min(1, dot / norms))) / DEG;
}

export const earthDaysToSols = (days) => days / SOL_DAYS;
export const solsToEarthDays = (sols) => sols * SOL_DAYS;
