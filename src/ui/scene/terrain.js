// Terrain layer, pre-rendered once per size/site: distant crater rim, hills, ground, rocks and craters.
import { seeded } from './util.js';

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

// Returns an offscreen canvas (device pixels) with the terrain for this body/site.
export function renderTerrain({ W, H, horizon, dpr, body, seed }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
