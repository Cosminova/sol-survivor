// Draws a mission patch on a 2D canvas: shape, embroidered border, arc text, stars and emblem.
import { drawEmblem, starPath, EMBLEMS } from './patchEmblems.js';

const TAU = Math.PI * 2;
const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif';
const HEX = /^#[0-9a-f]{6}$/i;

// cx/cy/r: the circle that holds text and emblem; k: inner-shape scale (sets border width).
export const SHAPES = [
  { id: 'circle', label: 'Circle', icon: '⚪', cx: 0.5, cy: 0.5, r: 0.44, k: 0.91 },
  { id: 'shield', label: 'Shield', icon: '🛡️', cx: 0.5, cy: 0.47, r: 0.37, k: 0.9 },
  { id: 'hexagon', label: 'Hexagon', icon: '⬢', cx: 0.5, cy: 0.5, r: 0.4, k: 0.9 },
  { id: 'triangle', label: 'Rounded triangle', icon: '🔻', cx: 0.5, cy: 0.37, r: 0.275, k: 0.86 },
];

export const DEFAULT_DESIGN = Object.freeze({
  shape: 'circle',
  bg: '#0e1736',
  border: '#ff7a3d',
  accent: '#ffd166',
  emblem: 'mars',
  name: 'SOL SURVIVOR',
  crew: Object.freeze(['Ada', 'Kai', 'Mei', 'Arjun']),
  stars: 3,
});

export const MAX_NAME = 24;
export const MAX_CREW_NAME = 12;
export const MAX_STARS = 7;

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : '');

export function sanitizeDesign(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const pick = (v, list, fallback) => (list.some((x) => x.id === v) ? v : fallback);
  const color = (v, fallback) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);
  const crew = Array.isArray(d.crew) ? d.crew : DEFAULT_DESIGN.crew;
  return {
    shape: pick(d.shape, SHAPES, DEFAULT_DESIGN.shape),
    bg: color(d.bg, DEFAULT_DESIGN.bg),
    border: color(d.border, DEFAULT_DESIGN.border),
    accent: color(d.accent, DEFAULT_DESIGN.accent),
    emblem: pick(d.emblem, EMBLEMS, DEFAULT_DESIGN.emblem),
    name: typeof d.name === 'string' ? clean(d.name, MAX_NAME) : DEFAULT_DESIGN.name,
    crew: Array.from({ length: 4 }, (_, i) => clean(crew[i] ?? '', MAX_CREW_NAME)),
    stars: Math.max(0, Math.min(MAX_STARS, Math.round(Number(d.stars) || 0))),
  };
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function roundedPolygon(ctx, pts, radius) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.moveTo(...mid(pts[n - 1], pts[0]));
  pts.forEach((p, i) => ctx.arcTo(p[0], p[1], ...pts[(i + 1) % n], radius));
  ctx.closePath();
}

function shapePath(ctx, shape, S) {
  const P = (x, y) => [x * S, y * S];
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.48, 0, TAU);
  } else if (shape === 'hexagon') {
    roundedPolygon(ctx, Array.from({ length: 6 }, (_, i) => P(0.5 + 0.49 * Math.cos((i * TAU) / 6), 0.5 + 0.49 * Math.sin((i * TAU) / 6))), S * 0.04);
  } else if (shape === 'triangle') {
    roundedPolygon(ctx, [P(0.04, 0.08), P(0.96, 0.08), P(0.5, 0.94)], S * 0.09);
  } else {
    ctx.beginPath();
    ctx.moveTo(...P(0.5, 0.05));
    ctx.arcTo(...P(0.92, 0.05), ...P(0.92, 0.5), S * 0.08);
    ctx.lineTo(...P(0.92, 0.5));
    ctx.bezierCurveTo(...P(0.92, 0.75), ...P(0.72, 0.88), ...P(0.5, 0.97));
    ctx.bezierCurveTo(...P(0.28, 0.88), ...P(0.08, 0.75), ...P(0.08, 0.5));
    ctx.arcTo(...P(0.08, 0.05), ...P(0.5, 0.05), S * 0.08);
    ctx.closePath();
  }
}

function withScale(ctx, ox, oy, k, fn) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(k, k);
  ctx.translate(-ox, -oy);
  fn();
  ctx.restore();
}

function arcText(ctx, text, { cx, cy, r, top, size, maxAngle, color }) {
  if (!text) return;
  let px = size;
  const spacing = () => px * 0.12;
  const measure = () => [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing(), -spacing());
  ctx.font = `800 ${px}px ${FONT}`;
  while (measure() / r > maxAngle && px > size * 0.55) {
    px -= 1;
    ctx.font = `800 ${px}px ${FONT}`;
  }
  const total = measure() / r;
  const dir = top ? 1 : -1;
  let a = (top ? -Math.PI / 2 : Math.PI / 2) - (dir * total) / 2;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...text].forEach((ch) => {
    const half = ctx.measureText(ch).width / 2 / r;
    a += dir * half;
    ctx.save();
    ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += dir * (half + spacing() / r);
  });
}

function starfield(ctx, S, cx, cy, r) {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 46; i += 1) {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * r;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, S * (0.0015 + rand() * 0.003), 0, TAU);
    ctx.fill();
  }
}

function drawStars(ctx, n, { cx, cy, r, color }) {
  const step = 0.2;
  const start = Math.PI / 2 + ((n - 1) * step) / 2;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i += 1) {
    const a = start - i * step;
    starPath(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.085);
    ctx.fill();
  }
}

function background(ctx, d, S, geo, k) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = S * 0.03;
  ctx.shadowOffsetY = S * 0.012;
  shapePath(ctx, d.shape, S);
  ctx.fillStyle = d.border;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.setLineDash([S * 0.014, S * 0.01]);
  ctx.lineWidth = S * 0.005;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  withScale(ctx, geo.cx, geo.cy, 1 - (1 - k) / 2, () => { shapePath(ctx, d.shape, S); ctx.stroke(); });
  ctx.restore();

  withScale(ctx, geo.cx, geo.cy, k, () => {
    shapePath(ctx, d.shape, S);
    const g = ctx.createRadialGradient(geo.cx, geo.cy - geo.r * 0.4, geo.r * 0.1, geo.cx, geo.cy, S * 0.6);
    g.addColorStop(0, `${d.bg}`);
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = d.bg;
    ctx.fill();
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = S * 0.012 / k;
    ctx.strokeStyle = d.accent;
    ctx.stroke();
    ctx.clip();
    starfield(ctx, S, geo.cx, geo.cy, S * 0.5);
  });
}

function gloss(ctx, d, S) {
  ctx.save();
  shapePath(ctx, d.shape, S);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, S * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S * 0.6);
  ctx.restore();
}

// drawPatch(ctx, design, size): ctx must already be scaled so 1 unit = 1 CSS pixel.
export function drawPatch(ctx, rawDesign, S) {
  const d = sanitizeDesign(rawDesign);
  const shape = SHAPES.find((s) => s.id === d.shape) ?? SHAPES[0];
  const geo = { cx: shape.cx * S, cy: shape.cy * S, r: shape.r * S };
  const textR = geo.r * 0.8;
  const size = geo.r * 0.16;
  const band = size * 0.78;
  const ink = luminance(d.bg) > 0.45 ? '#0b1330' : '#ffffff';

  ctx.clearRect(0, 0, S, S);
  background(ctx, d, S, geo, shape.k);

  ctx.save();
  ctx.beginPath();
  ctx.arc(geo.cx, geo.cy, textR + band, 0, TAU);
  ctx.arc(geo.cx, geo.cy, textR - band, 0, TAU, true);
  ctx.fillStyle = ink === '#ffffff' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.45)';
  ctx.fill('evenodd');
  ctx.lineWidth = S * 0.006;
  ctx.strokeStyle = d.accent;
  [textR + band, textR - band].forEach((rr) => { ctx.beginPath(); ctx.arc(geo.cx, geo.cy, rr, 0, TAU); ctx.stroke(); });
  ctx.restore();

  const inner = textR - band;
  ctx.save();
  ctx.translate(geo.cx, geo.cy - inner * 0.1);
  drawEmblem(ctx, d.emblem, inner * 0.62, d.accent, ink === '#ffffff' ? '#eef3ff' : '#1b2a55');
  ctx.restore();
  drawStars(ctx, d.stars, { cx: geo.cx, cy: geo.cy, r: inner * 0.8, color: d.accent });

  const crew = d.crew.map((c) => c.trim()).filter(Boolean).join(' • ').toUpperCase();
  arcText(ctx, d.name.trim().toUpperCase(), { cx: geo.cx, cy: geo.cy, r: textR, top: true, size, maxAngle: Math.PI * 0.92, color: ink });
  arcText(ctx, crew, { cx: geo.cx, cy: geo.cy, r: textR, top: false, size: size * 0.82, maxAngle: Math.PI * 0.8, color: ink });
  gloss(ctx, d, S);
}

export function paintCanvas(canvas, design, cssSize) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPatch(ctx, design, cssSize);
}

export function patchBlob(design, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas is not available'));
  drawPatch(ctx, design, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'));
}
