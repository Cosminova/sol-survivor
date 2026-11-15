// Colour helpers for the world looks. Pure: colours are '#rrggbb' strings or [r, g, b] arrays in sRGB 0..1.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function hexToRgb(hex) {
  const text = String(hex ?? '#000000').replace('#', '');
  const full = text.length === 3 ? text.split('').map((c) => c + c).join('') : text.padEnd(6, '0');
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]) {
  const part = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

export const mixRgb = (a, b, t) => {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

export const mixHex = (a, b, t) => rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), t));
export const darken = (hex, amount) => mixHex(hex, '#000000', amount);
export const lighten = (hex, amount) => mixHex(hex, '#ffffff', amount);
export const scaleRgb = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const luminance = ([r, g, b]) => r * 0.2126 + g * 0.7152 + b * 0.0722;
export const rgbaCss = (hex, alpha) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
};

export const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// Colour of a glowing body at a given temperature (Tanner Helland's fit to the black-body locus), 1000 K .. 40000 K.
export function blackbodyRgb(kelvin) {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)];
}
