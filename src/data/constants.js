// Every number a player sees is traceable to a source in SOURCES (src/data/sources.js).
// Values are rounded for gameplay; the source id is noted next to each group.

export const MARS = {
  name: 'Mars',
  dayHours: 24.6597, // sol length [mars-fact]
  gravity: 0.379, // relative to Earth [mars-fact]
  meanSolarFlux: 586.2, // W/m² at top of atmosphere [mars-fact]
  semiMajorAU: 1.52371,
  eccentricity: 0.0934,
  perihelionLs: 251,
  obliquityDeg: 25.19,
  surfacePressurePa: 610,
  lightMinutesMin: 3.0,
  lightMinutesMax: 22.3,
};

export const MOON = {
  name: 'Moon',
  dayHours: 24, // game turns on the Moon are Earth days
  gravity: 0.1654,
  meanSolarFlux: 1361, // [moon-fact]
  synodicDays: 29.53,
  lightSeconds: 1.28,
};

export const EARTH_SOLAR_CONSTANT = 1361; // W/m² [moon-fact]

// NASA Life Support Baseline Values and Assumptions Document [bvad]
export const LIFE_SUPPORT = {
  o2KgPerCrewDay: 0.82,
  waterKgPerCrewDay: 3.5, // drinking + food prep + hygiene, rounded
  foodKgPerCrewDay: 1.8,
  co2KgPerCrewDay: 1.04,
  evaO2Multiplier: 1.3, // EVA work raises metabolic rate [bvad]
  waterToO2Ratio: 0.889, // electrolysis: 1 kg H2O -> 0.889 kg O2 (chemistry)
};

// Radiation [rad-2014] [rad-cruise] [lnd-2020] [nasa-std-3001] [rad-2024]
export const RADIATION = {
  marsSurfaceGcrMsvPerSol: 0.64,
  marsCruiseMsvPerDay: 1.84,
  marsCruiseDays: 180,
  moonSurfaceMsvPerDay: 1.37,
  earthBackgroundMsvPerDay: 0.0066,
  careerLimitMsv: 600,
  chestXrayMsv: 0.1,
  sepDoseMsv: { minor: 1.5, moderate: 5, major: 15 },
  may2024RadMicroGray: 8100,
};

// Inside-habitat multipliers by shielding level (0 = bare habitat walls).
// Galactic cosmic rays are hard to stop; solar particles are easy to stop.
export const SHIELDING = {
  gcrFactor: [0.9, 0.75, 0.62, 0.52],
  sepFactor: [1, 0.4, 0.15, 0.05],
  shelterSepFactor: 0.05,
  maxLevel: 3,
  bermWorkPerLevel: 8, // crew-sols of regolith moving per level
  waterWallKg: 1500, // stored water this large acts as one extra level
};

export const POWER = {
  solarEfficiency: 0.22,
  dustPerSol: 0.002, // fraction of panel covered per sol [mer-dust]
  stormDustPerSol: 0.01,
  maxDust: 0.9,
  habitatBaseKw: 3,
  heatKwPerDegree: 0.012, // heat leak per °C below 21 °C
  habitatTargetC: 21,
};

export const CREW = {
  maxHealth: 100,
  maxMorale: 100,
  restHeal: 4,
  evaScience: 3,
  sciencePerGeologistBonus: 1.5,
  roverScienceBonus: 1.5,
};
