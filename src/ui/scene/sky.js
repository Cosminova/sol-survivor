// Sky layer: Mars butterscotch day / blue sunset / night, Moon black sky with Earth, stars, Phobos, aurora.
import { clamp, mix, smoothstep, seeded } from './util.js';
import { lookFor } from '../../render/worldLook.js';
import { darken, mixHex, rgbaCss } from '../../render/color.js';

const SUN_DEG = 0.53;
const FIXED_STAR_ELEV = { day: 0.55, twilight: 0.16, night: -0.4 }; // tidally locked: the star never moves
const FIXED_STAR_X = 0.3;
const RING_COLOR = 'rgba(226,208,168,0.8)';

export function makeStars(seed, count = 160) {
  const rng = seeded(`stars-${seed}`);
  return Array.from({ length: count }, () => ({ x: rng.next(), y: rng.next() ** 1.3, r: rng.next() ** 4 * 1.6 + 0.4, tw: rng.next() * 6.28 }));
}

function marsSkyColors(sunElev, tau) {
  const day = smoothstep(-0.04, 0.3, sunElev);
  const dusk = clamp(1 - Math.abs(sunElev) / 0.22);
  const murk = clamp(tau / 6);
  const topDay = mix('#b9825a', '#5d3d2a', murk);
  const horizonDay = mix('#e7bd91', '#8a5a3c', murk);
  const top = mix(mix('#06070f', '#2c1f22', dusk), topDay, day);
  const horizon = mix(mix('#0d1022', '#5a6f8f', dusk * (1 - murk * 0.7)), horizonDay, day);
  return { top, horizon, day, dusk };
}

export function skyState(body, t, lit) {
  if (body === 'moon') {
    return { sunElev: lit ? 0.18 : -0.4, sunX: 0.18 + 0.04 * Math.sin(t * 0.05), day: lit ? 1 : 0, dusk: 0 };
  }
  const angle = t * Math.PI * 2;
  const sunElev = Math.sin(angle) * 0.85 + 0.12;
  const sunX = 0.5 - Math.cos(angle) * 0.48;
  return { sunElev, sunX, day: smoothstep(-0.04, 0.3, sunElev), dusk: clamp(1 - Math.abs(sunElev) / 0.22) };
}

function drawStars(ctx, W, horizon, stars, alpha, time) {
  if (alpha <= 0.02) return;
  ctx.fillStyle = '#fff';
  for (const st of stars) {
    ctx.globalAlpha = alpha * (0.55 + 0.45 * Math.sin(time * 1.4 + st.tw));
    ctx.beginPath();
    ctx.arc(st.x * W, st.y * horizon * 0.95, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, x, y, size, { dusk, tau, body }) {
  const dim = body === 'mars' ? clamp(1 - tau / 9, 0.12, 1) : 1;
  const haloColor = body === 'mars' && dusk > 0.2 ? `rgba(120,170,235,${0.55 * dusk * dim})` : `rgba(255,240,215,${0.35 * dim})`;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, size * (body === 'mars' ? 7 : 4));
  halo.addColorStop(0, haloColor);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - size * 8, y - size * 8, size * 16, size * 16);
  ctx.globalAlpha = dim;
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawEarth(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#9fd3ff');
  g.addColorStop(0.6, '#2f6fd1');
  g.addColorStop(1, '#0c2f73');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(80,170,90,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.15, y + r * 0.1, r * 0.35, r * 0.22, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y - r * 0.35, r * 0.4, r * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,10,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.35, Math.PI * 1.35);
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createRadialGradient(x, y, r, x, y, r * 1.8);
  glow.addColorStop(0, 'rgba(120,180,255,0.35)');
  glow.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawAurora(ctx, W, horizon, alpha, time) {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let band = 0; band < 3; band += 1) {
    const g = ctx.createLinearGradient(0, horizon * 0.15, 0, horizon);
    g.addColorStop(0, 'rgba(60,255,160,0)');
    g.addColorStop(0.6, `rgba(70,255,170,${0.22 * alpha})`);
    g.addColorStop(1, `rgba(90,200,255,${0.12 * alpha})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= W; x += 16) {
      const y = horizon * (0.25 + 0.12 * band) + Math.sin(x * 0.008 + time * (0.6 + band * 0.2) + band) * horizon * 0.08;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function lookSkyState(look, t, lit) {
  let sunElev;
  let sunX = FIXED_STAR_X;
  if (look.starFixed) sunElev = FIXED_STAR_ELEV[look.light] ?? FIXED_STAR_ELEV.day;
  else if (!lit) sunElev = -0.4;
  else {
    sunElev = Math.sin(t * Math.PI * 2) * 0.85 + 0.12;
    sunX = 0.5 - Math.cos(t * Math.PI * 2) * 0.48;
  }
  const day = look.airless ? (sunElev > -0.04 ? 1 : 0) : smoothstep(-0.04, 0.3, sunElev);
  return { sunElev, sunX, day, dusk: look.airless ? 0 : clamp(1 - Math.abs(sunElev) / 0.22) };
}

function ringHalf(ctx, x, y, r, from, to) {
  ctx.strokeStyle = RING_COLOR;
  ctx.lineWidth = r * 0.28;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.85, r * 0.42, -0.25, Math.PI * from, Math.PI * to);
  ctx.stroke();
}

// Jupiter or Saturn in a moon's sky: our own banded disc, with rings for Saturn.
function drawParent(ctx, x, y, r, parent) {
  if (parent.rings) ringHalf(ctx, x, y, r, 1.03, 1.97); // far half, behind the planet
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const bandH = (r * 2) / (parent.bands.length * 2);
  for (let i = 0; i < parent.bands.length * 2; i += 1) {
    ctx.fillStyle = parent.bands[i % parent.bands.length];
    ctx.fillRect(x - r, y - r + i * bandH, r * 2, bandH + 1);
  }
  const shade = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.2, x, y, r * 1.1);
  shade.addColorStop(0, 'rgba(255,255,255,0.12)');
  shade.addColorStop(1, 'rgba(0,0,10,0.6)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  if (parent.rings) ringHalf(ctx, x, y, r, 0.03, 0.97); // near half, in front
}

function drawLookStar(ctx, W, horizon, sky, look) {
  const size = (horizon / 9) * 0.3 * clamp(look.starAngularSizeDeg / SUN_DEG, 0.75, 14) ** 0.6;
  const x = sky.sunX * W;
  const y = horizon - sky.sunElev * horizon * 0.95;
  const dim = 1 - look.haze * 0.75;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, size * (look.airless ? 3 : 5));
  halo.addColorStop(0, rgbaCss(look.starColor, 0.4 * dim));
  halo.addColorStop(1, rgbaCss(look.starColor, 0));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, horizon + 2); // a star on the horizon is cut by the ground
  ctx.clip();
  ctx.fillStyle = halo;
  ctx.fillRect(x - size * 6, y - size * 6, size * 12, size * 12);
  ctx.globalAlpha = dim;
  ctx.fillStyle = mixHex(look.starColor, '#ffffff', 0.25);
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Sky of a world with a look: colours from its air, a star sized and coloured like its real star, the giant
// planet it orbits, and haze that hides the stars.
function drawLookSky(ctx, W, horizon, st, look) {
  const sky = lookSkyState(look, st.t, st.lit);
  const top = look.airless ? '#000003' : mix(mix('#06070f', darken(look.skyTop, 0.6), sky.dusk), look.skyTop, sky.day);
  const low = look.airless ? (sky.day ? '#06070c' : '#020205') : mix(mix('#0d1022', mixHex(look.skyHorizon, look.starColor, 0.4), sky.dusk), look.skyHorizon, sky.day);
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, top);
  g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 2);

  const night = look.airless ? (sky.day ? 0.45 : 1) : 1 - sky.day;
  drawStars(ctx, W, horizon, st.stars, night * (1 - look.haze), st.time);
  if (look.parent?.visible) drawParent(ctx, W * 0.76, horizon * 0.3, (horizon / 9) * clamp(look.parent.angularSizeDeg / 9, 0.6, 2.4), look.parent);
  drawAurora(ctx, W, horizon, (st.aurora ? 1 : 0) * night, st.time);
  if (sky.sunElev > -0.08) drawLookStar(ctx, W, horizon, sky, look);
  if (look.haze > 0.4) { // thick air: an even glow over the whole sky
    ctx.fillStyle = rgbaCss(look.hazeColor, (look.haze - 0.4) * 0.5 * (0.3 + 0.7 * sky.day));
    ctx.fillRect(0, 0, W, horizon + 2);
  }
  return { ...sky, night };
}

// st: { body, t (0..1 day phase), time (s), tau, lit, aurora, stars, siteLat, worldId?, site? }
export function drawSky(ctx, W, horizon, st) {
  const look = lookFor(st.worldId ?? st.body, st.site ?? null);
  if (look) return drawLookSky(ctx, W, horizon, st, look);
  const sky = skyState(st.body, st.t, st.lit);
  let colors;
  if (st.body === 'moon') colors = { top: '#000003', horizon: st.lit ? '#06070c' : '#020205' };
  else colors = marsSkyColors(sky.sunElev, st.tau);
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, colors.top);
  g.addColorStop(1, colors.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 2);

  const night = st.body === 'moon' ? (st.lit ? 0.45 : 1) : 1 - sky.day;
  drawStars(ctx, W, horizon, st.stars, night * (st.body === 'mars' ? clamp(1 - st.tau / 4) : 1), st.time);

  const unit = horizon / 9;
  if (st.body === 'mars') {
    if (night > 0.4) {
      const px = ((st.time * 0.012) % 1.3) - 0.15;
      ctx.fillStyle = `rgba(190,170,150,${night})`;
      ctx.beginPath();
      ctx.ellipse(px * W, horizon * 0.35, unit * 0.22, unit * 0.15, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(150,200,255,${night * 0.9})`;
      ctx.beginPath();
      ctx.arc(W * 0.82, horizon * 0.72, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    drawAurora(ctx, W, horizon, (st.aurora ? 1 : 0) * night, st.time);
  } else {
    const high = Math.abs(st.siteLat ?? 0) < 45;
    drawEarth(ctx, W * (high ? 0.72 : 0.8), horizon * (high ? 0.22 : 0.78), unit * 0.75);
  }
  if (sky.sunElev > -0.08) {
    const sunSize = st.body === 'mars' ? unit * 0.28 : unit * 0.42;
    drawSun(ctx, sky.sunX * W, horizon - sky.sunElev * horizon * 0.95, sunSize, { dusk: sky.dusk, tau: st.tau, body: st.body });
  }
  if (st.body === 'mars' && st.tau > 1) {
    ctx.fillStyle = `rgba(150,95,55,${clamp((st.tau - 1) / 10, 0, 0.6) * (0.4 + 0.6 * sky.day)})`;
    ctx.fillRect(0, 0, W, horizon + 2);
  }
  return { ...sky, night };
}

export const skyMood = (body, sky, tau) => (body === 'moon' ? sky.day : sky.day * clamp(1 - tau / 12, 0.35, 1));
