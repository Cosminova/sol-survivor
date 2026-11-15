// Terrain layer, pre-rendered once per size/site: distant crater rim, hills, ground, rocks and craters.
// Worlds other than the Moon and Mars are painted from their look (src/render/worldLook.js): dunes, ice ridges,
// volcanoes, ice patches, pools and lava, in the world's own colours.
import { seeded } from './util.js';
import { lookFor } from '../../render/worldLook.js';
import { mixHex, darken, lighten, rgbaCss } from '../../render/color.js';

const MAX_ICE_PATCHES = 26;
const MAX_POOLS = 24;
const MAX_ROCKS = 64;
const CRATERS_BY_STYLE = { craters: 14, plains: 4 };

const PALETTE = {
  mars: { far: '#a8684a', mid: '#9a4f2c', groundTop: '#b8643a', groundBottom: '#6e2e14', rock: '#5a2a16', rockLight: '#c98a5e' },
  moon: { far: '#6c6f76', mid: '#85888f', groundTop: '#9b9ea5', groundBottom: '#55585e', rock: '#3c3e44', rockLight: '#c5c8cf' },
};

function ridge(ctx, W, baseY, amp, rng, color, roughness = 6) {
  const pts = Array.from({ length: roughness + 2 }, (_, i) => ({ x: (i / roughness) * W * 1.1 - W * 0.05, y: baseY - rng.next() * amp }));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, baseY + amp);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1];
    const mx = (prev.x + pts[i].x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, (prev.y + pts[i].y) / 2);
  }
  ctx.lineTo(W + 10, baseY + amp);
  ctx.closePath();
  ctx.fill();
}

function rocks(ctx, W, H, horizon, rng, pal, count) {
  for (let i = 0; i < count; i += 1) {
    const d = rng.next() ** 0.7;
    const y = horizon + (H - horizon) * (0.05 + 0.95 * d);
    const x = rng.next() * W;
    const r = (1 + rng.next() * 5) * (0.4 + d * 1.4) * (H / 420);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.5, y + r * 0.35, r * 1.2, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.rock;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.65, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = pal.rockLight;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function craters(ctx, W, H, horizon, rng, count) {
  for (let i = 0; i < count; i += 1) {
    const d = rng.next();
    const y = horizon + (H - horizon) * (0.1 + 0.85 * d);
    const x = rng.next() * W;
    const rx = (8 + rng.next() * 30) * (0.4 + d) * (H / 420);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, rx, rx * 0.22, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
}

// A spot on the ground: depth 0 at the horizon, 1 at the bottom edge. Wet and molten things keep to the sides
// and the far ground so the base never stands in a pool.
function groundSpot(rng, W, H, horizon, { clearOfBase = false } = {}) {
  const d = rng.next();
  const side = rng.next() < 0.5 ? rng.next() * 0.2 : 0.8 + rng.next() * 0.2;
  const x = (clearOfBase && d > 0.2 ? side : rng.next()) * W;
  return { x, y: horizon + (H - horizon) * (0.08 + 0.88 * d), d, k: (0.35 + d) * (H / 420) };
}

function blob(ctx, x, y, rx, ry, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function duneRidges(ctx, W, H, horizon, rng, pal) {
  for (let layer = 0; layer < 3; layer += 1) {
    const baseY = horizon + 2 + layer * H * 0.02;
    const phase = rng.next() * 6;
    ctx.fillStyle = mixHex(pal.far, pal.mid, layer / 2);
    ctx.beginPath();
    ctx.moveTo(-10, baseY + H * 0.1);
    for (let x = -10; x <= W + 10; x += 8) ctx.lineTo(x, baseY - (Math.sin(x * 0.012 + phase) * 0.5 + 0.5) ** 1.6 * H * (0.06 - layer * 0.015));
    ctx.lineTo(W + 10, baseY + H * 0.1);
    ctx.fill();
  }
}

function volcano(ctx, W, H, horizon, rng, look, pal) {
  const x = W * (0.18 + rng.next() * 0.2);
  const w = W * 0.2;
  const top = horizon - H * 0.16;
  ctx.fillStyle = pal.far;
  ctx.beginPath();
  ctx.moveTo(x - w, horizon + 4); ctx.quadraticCurveTo(x - w * 0.3, top + H * 0.03, x - w * 0.08, top);
  ctx.lineTo(x + w * 0.08, top); ctx.quadraticCurveTo(x + w * 0.3, top + H * 0.03, x + w, horizon + 4);
  ctx.fill();
  const glow = ctx.createRadialGradient(x, top, 0, x, top, w * 0.35);
  glow.addColorStop(0, rgbaCss(look.lavaColor, 0.75));
  glow.addColorStop(1, rgbaCss(look.lavaColor, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - w, top - w * 0.4, w * 2, w * 0.8);
  if (!look.particles.plumes) return;
  const plume = ctx.createRadialGradient(x, top - H * 0.1, 0, x, top - H * 0.1, H * 0.16); // the plume fans out high above the vent
  plume.addColorStop(0, rgbaCss(look.particles.plumeColor, 0.3));
  plume.addColorStop(1, rgbaCss(look.particles.plumeColor, 0));
  ctx.fillStyle = plume;
  ctx.fillRect(x - H * 0.2, top - H * 0.28, H * 0.4, H * 0.3);
}

function geysers(ctx, W, H, horizon, rng, look) {
  for (let i = 0; i < 2; i += 1) {
    const x = W * (0.12 + rng.next() * 0.76);
    const jet = ctx.createLinearGradient(0, horizon, 0, horizon - H * 0.3);
    jet.addColorStop(0, rgbaCss(look.particles.plumeColor, 0.55));
    jet.addColorStop(1, rgbaCss(look.particles.plumeColor, 0));
    ctx.fillStyle = jet;
    ctx.beginPath();
    ctx.moveTo(x - 2, horizon); ctx.lineTo(x - H * 0.05, horizon - H * 0.3); ctx.lineTo(x + H * 0.05, horizon - H * 0.3); ctx.lineTo(x + 2, horizon);
    ctx.fill();
  }
}

function farLandform(ctx, W, H, horizon, rng, look, pal) {
  const style = look.reliefStyle;
  if (style === 'dunes') { duneRidges(ctx, W, H, horizon, rng, pal); return; }
  ridge(ctx, W, horizon + 2, H * (style === 'ice-chaos' ? 0.06 : 0.09), rng, pal.far, style === 'ice-chaos' ? 22 : style === 'fractured-basalt' ? 4 : 7);
  if (style === 'lava-flows') volcano(ctx, W, H, horizon, rng, look, pal);
  else if (look.particles.plumes) geysers(ctx, W, H, horizon, rng, look);
}

// Dune crest lines with a shaded slip face.
function duneCrests(ctx, W, H, horizon, rng, look) {
  for (let i = 0; i < 9; i += 1) {
    const d = (i + rng.next()) / 9;
    const y = horizon + (H - horizon) * (0.1 + 0.85 * d);
    const amp = (4 + d * 10) * (H / 420);
    const phase = rng.next() * 6;
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.01 + phase) * amp);
    ctx.strokeStyle = rgbaCss(look.groundColors.accents[0], 0.22);
    ctx.lineWidth = (6 + d * 22) * (H / 420);
    ctx.stroke();
  }
}

// Cracks; on ice every fourth one is a long red-brown stained stripe.
function cracks(ctx, W, H, horizon, rng, look) {
  const icy = look.reliefStyle === 'ice-chaos';
  const [stain, fresh] = look.groundColors.accents;
  for (let i = 0; i < 46; i += 1) {
    const p = groundSpot(rng, W, H, horizon);
    const len = (20 + rng.next() * 90) * p.k;
    const tilt = (rng.next() - 0.5) * 0.5;
    ctx.strokeStyle = icy ? rgbaCss(i % 4 === 0 ? stain : fresh, 0.55) : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = (icy && i % 4 === 0 ? 2.4 : 1) * p.k;
    ctx.beginPath();
    ctx.moveTo(p.x - len / 2, p.y - tilt * len * 0.12);
    ctx.lineTo(p.x, p.y + (rng.next() - 0.5) * 4);
    ctx.lineTo(p.x + len / 2, p.y + tilt * len * 0.12);
    ctx.stroke();
  }
}

function pools(ctx, W, H, horizon, rng, look, pal) {
  const wet = look.lava > 0 ? { color: look.lavaColor, amount: look.lava, glow: true } : look.liquid ? { color: look.liquid.color, amount: look.liquid.coverage, glow: false } : null;
  if (!wet) return;
  for (let i = 0; i < Math.min(MAX_POOLS, Math.round(wet.amount * MAX_POOLS * 2.2)); i += 1) {
    const p = groundSpot(rng, W, H, horizon, { clearOfBase: true });
    const rx = (16 + rng.next() * 60) * p.k;
    if (wet.glow) blob(ctx, p.x, p.y, rx * 1.5, rx * 0.36, rgbaCss(wet.color, 0.22));
    blob(ctx, p.x, p.y, rx, rx * 0.2, wet.glow ? '#1a0d08' : darken(pal.groundBottom, 0.35)); // dark bank
    blob(ctx, p.x, p.y + 1, rx * 0.9, rx * 0.16, wet.color);
    blob(ctx, p.x - rx * 0.25, p.y - rx * 0.03, rx * 0.4, rx * 0.035, wet.glow ? 'rgba(255,230,140,0.8)' : 'rgba(255,255,255,0.28)'); // glint
  }
}

function groundMarks(ctx, W, H, horizon, rng, look, pal) {
  const style = look.reliefStyle;
  if (style === 'dunes') duneCrests(ctx, W, H, horizon, rng, look);
  if (style === 'ice-chaos' || style === 'fractured-basalt') cracks(ctx, W, H, horizon, rng, look);
  if (look.ground === 'sulfur') { // yellow, orange and white frost patches
    for (let i = 0; i < 30; i += 1) {
      const p = groundSpot(rng, W, H, horizon);
      blob(ctx, p.x, p.y, (14 + rng.next() * 50) * p.k, (3 + rng.next() * 7) * p.k, rgbaCss(look.groundColors.accents[i % 3], 0.4));
    }
  }
  for (let i = 0; i < Math.round(look.iceCoverage * MAX_ICE_PATCHES) && style !== 'ice-chaos'; i += 1) {
    const p = groundSpot(rng, W, H, horizon);
    const rx = (10 + rng.next() * 36) * p.k;
    blob(ctx, p.x, p.y, rx, rx * 0.2, rgbaCss(look.groundColors.ice, 0.8));
    blob(ctx, p.x - rx * 0.2, p.y - rx * 0.04, rx * 0.5, rx * 0.07, 'rgba(255,255,255,0.5)');
  }
  pools(ctx, W, H, horizon, rng, look, pal);
}

function renderLookTerrain(ctx, { W, H, horizon, seed }, look) {
  const { base, rock } = look.groundColors;
  const air = look.airless ? '#000000' : look.skyHorizon;
  const pal = {
    far: mixHex(darken(base, 0.3), air, look.airless ? 0.15 : 0.35 + look.haze * 0.3), mid: mixHex(darken(base, 0.15), air, look.airless ? 0 : 0.15 + look.haze * 0.2),
    groundTop: mixHex(lighten(base, 0.08), air, look.haze * 0.35), groundBottom: darken(base, 0.45), rock, rockLight: lighten(rock, 0.45),
  };
  const rng = seeded(`terrain-${look.worldId}-${seed}`);
  farLandform(ctx, W, H, horizon, rng, look, pal);
  ctx.fillStyle = look.airless ? 'rgba(0,0,0,0.12)' : rgbaCss(look.hazeColor, 0.12 + look.haze * 0.4);
  ctx.fillRect(0, horizon - H * 0.1, W, H * 0.12);
  if (look.reliefStyle !== 'dunes') ridge(ctx, W, horizon + H * 0.04, H * 0.05, rng, pal.mid, 5);

  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, pal.groundTop);
  ground.addColorStop(1, pal.groundBottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon + H * 0.035, W, H);
  for (let i = 0; i < 260; i += 1) {
    const d = rng.next();
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(rng.next() * W, horizon + (H - horizon) * (0.06 + 0.94 * d), (2 + rng.next() * 10) * (0.3 + d), 1 + d * 1.5);
  }
  groundMarks(ctx, W, H, horizon, rng, look, pal);
  craters(ctx, W, H, horizon, rng, CRATERS_BY_STYLE[look.reliefStyle] ?? 0);
  rocks(ctx, W, H, horizon, rng, pal, Math.round(MAX_ROCKS * look.rockDensity));
}

// Returns an offscreen canvas (device pixels) with the terrain for this body/site.
// worldId / site pick the world look; without them (or for the Moon and Mars) the body's own painting is used.
export function renderTerrain({ W, H, horizon, dpr, body, seed, worldId = body, site = null }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const look = lookFor(worldId, site);
  if (look) {
    renderLookTerrain(ctx, { W, H, horizon, seed }, look);
    return canvas;
  }
  const pal = PALETTE[body] ?? PALETTE.mars;
  const rng = seeded(`terrain-${seed}`);

  ridge(ctx, W, horizon + 2, H * 0.09, rng, pal.far, 7);
  ctx.fillStyle = body === 'mars' ? 'rgba(230,170,120,0.18)' : 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, horizon - H * 0.1, W, H * 0.12);
  ridge(ctx, W, horizon + H * 0.04, H * 0.05, rng, pal.mid, 5);

  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, pal.groundTop);
  ground.addColorStop(1, pal.groundBottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon + H * 0.035, W, H);

  for (let i = 0; i < 260; i += 1) {
    const d = rng.next();
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    const y = horizon + (H - horizon) * (0.06 + 0.94 * d);
    ctx.fillRect(rng.next() * W, y, (2 + rng.next() * 10) * (0.3 + d), 1 + d * 1.5);
  }
  if (body === 'moon') craters(ctx, W, H, horizon, rng, 14);
  else craters(ctx, W, H, horizon, rng, 4);
  rocks(ctx, W, H, horizon, rng, pal, body === 'mars' ? 46 : 30);
  return canvas;
}
