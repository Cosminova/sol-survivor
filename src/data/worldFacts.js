// Fact builders for world profiles. A fact is { v, origin, src } (see the contract in worlds.js).
// Leaf module: worlds.js re-exports everything here, so the solar-system and exoplanet files can share the
// builders without importing worlds.js back (which would be a circular import).
//
// Optional extra field: note, a short plain-words caveat about the value (for example "minimum mass").

export const GAME_MODEL_SRC = 'game-model';
export const ORIGINS = ['real', 'derived', 'generated'];

const withNote = (fact, note) => (note ? { ...fact, note } : fact);

export const real = (v, src, note) => withNote({ v, origin: 'real', src }, note);
export const derived = (v, src, note) => withNote({ v, origin: 'derived', src }, note);
export const generated = (v, note) => withNote({ v, origin: 'generated', src: GAME_MODEL_SRC }, note);

export const isMeasured = (fact) => fact?.origin === 'real' || fact?.origin === 'derived';
export const factLabel = (fact) => (isMeasured(fact) ? 'Real · NASA' : 'Generated · game model');

export const round = (value, digits = 2) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

// 1234.5 -> 1200 with 2 significant figures: generated numbers should not look more exact than they are.
export const roundSig = (value, figures = 2) => {
  if (!Number.isFinite(value) || value === 0) return 0;
  const digits = figures - 1 - Math.floor(Math.log10(Math.abs(value)));
  return round(value, Math.max(digits, -6));
};

export const kelvinToC = (kelvin) => Math.round(kelvin - 273.15);
