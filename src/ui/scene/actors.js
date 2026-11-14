// Moving things: astronauts on EVA, the rover on traverse, dust motes, storm streaks, solar-particle streaks.
import { project, clamp, seeded } from './util.js';
import { rover } from './base.js';

const SUIT_STRIPES = ['#ff7a3d', '#4fe3ff', '#a3e635', '#b197fc'];

function astronaut(ctx, x, y, s, { walk, tool, stripe }) {
  const swing = Math.sin(walk) * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 1, 7 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e9edf5'; ctx.lineCap = 'round'; ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(x, y - 12 * s); ctx.lineTo(x + swing * 6 * s, y); ctx.moveTo(x, y - 12 * s); ctx.lineTo(x - swing * 6 * s, y); ctx.stroke();
  ctx.fillStyle = '#f4f6fb';
  ctx.beginPath(); ctx.ellipse(x, y - 18 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c5ccd9'; ctx.fillRect(x - 8 * s, y - 24 * s, 4 * s, 10 * s);
  ctx.fillStyle = stripe; ctx.fillRect(x - 5 * s, y - 19 * s, 10 * s, 2 * s);
  ctx.fillStyle = '#f4f6fb';
  ctx.beginPath(); ctx.arc(x, y - 29 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill();
  const visor = ctx.createLinearGradient(x - 4 * s, y - 32 * s, x + 4 * s, y - 26 * s);
  visor.addColorStop(0, '#ffd166'); visor.addColorStop(1, '#b86b12');
  ctx.fillStyle = visor;
  ctx.beginPath(); ctx.ellipse(x + 1.5 * s, y - 29 * s, 3.5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e9edf5'; ctx.lineWidth = 3 * s;
  const arm = tool ? Math.sin(walk * 2) * 0.6 : -swing;
  ctx.beginPath(); ctx.moveTo(x, y - 21 * s); ctx.lineTo(x + 7 * s, y - 14 * s + arm * 5 * s); ctx.stroke();
  if (tool === 'shovel') {
    ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(x + 7 * s, y - 14 * s + arm * 5 * s); ctx.lineTo(x + 13 * s, y - 2 * s + arm * 3 * s); ctx.stroke();
  }
}

const pingPong = (t) => 1 - Math.abs((t % 2) - 1);

// Returns depth-tagged drawables for crew outside (and the rover when it is on traverse).
export function actors(vm, W, H, horizon, time) {
  const list = [];
  let roverUsed = false;
  vm.eva.forEach((c, i) => {
    const stripe = SUIT_STRIPES[i % SUIT_STRIPES.length];
    if (c.task === 'science' && vm.modules.rover > 0 && !roverUsed) {
      roverUsed = true;
      const k = pingPong(time / 14 + i * 0.3);
      const d = 0.9;
      const { y, scale } = project(d, W, H, horizon);
      const facing = Math.sin((time / 14 + i * 0.3) * Math.PI) >= 0 ? 1 : -1;
      list.push({ depth: d, draw: (ctx) => rover(ctx, W * (0.12 + 0.76 * k), y, scale, facing) });
      return;
    }
    let x; let d; let tool = null; let walk = time * 6 + i;
    if (c.task === 'shield') {
      x = 0.4 + 0.2 * pingPong(time / 9 + i * 0.37); d = 0.66 + (i % 2) * 0.05; tool = 'shovel';
    } else if (c.task === 'maintain') {
      x = 0.08 + 0.2 * pingPong(time / 11 + i * 0.5); d = 0.66; tool = 'brush';
    } else {
      x = 0.15 + 0.75 * pingPong(time / (18 + i * 3) + i * 0.4); d = 0.8 + (i % 3) * 0.06;
    }
    if (tool) walk = time * 4 + i;
    const { y, scale } = project(d, W, H, horizon);
    list.push({ depth: d, draw: (ctx) => astronaut(ctx, x * W, y, scale, { walk, tool, stripe }) });
  });
  return { list, roverOut: roverUsed };
}

export function makeDust(seed, count) {
  const rng = seeded(`dust-${seed}`);
  return Array.from({ length: count }, () => ({ x: rng.next(), y: rng.next(), z: rng.next() * 0.8 + 0.2, wob: rng.next() * 6.28 }));
}

export function drawDust(ctx, W, H, motes, { tau, storm, time, body }) {
  if (body !== 'mars') return;
  const visible = Math.min(motes.length, Math.round(20 + tau * 30 + (storm ? 80 : 0)));
  const wind = storm ? 0.09 : 0.012;
  ctx.fillStyle = storm ? 'rgba(220,150,95,0.55)' : 'rgba(235,190,150,0.45)';
  for (let i = 0; i < visible; i += 1) {
    const m = motes[i];
    const x = ((m.x + time * wind * m.z) % 1) * W;
    const y = (m.y * 0.9 + 0.08) * H + Math.sin(time * 1.3 + m.wob) * 6;
    ctx.globalAlpha = 0.25 + 0.6 * m.z;
    ctx.fillRect(x, y, 1.2 + m.z * 2.2, 1.2 + m.z * 1.4);
  }
  if (storm) {
    ctx.strokeStyle = 'rgba(230,170,120,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i += 1) {
      const m = motes[i];
      const x = ((m.x + time * 0.25 * m.z) % 1) * W;
      const y = m.y * H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 40 * m.z, y + 3); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// Solar particle storm: periodic flash plus diagonal proton streaks.
export function drawFlare(ctx, W, H, { time, severity }) {
  const strength = severity === 'major' ? 1 : severity === 'moderate' ? 0.7 : 0.45;
  const cycle = (time % 6) / 6;
  const flash = clamp(1 - cycle * 5) * 0.45 * strength;
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,236,250,${flash})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,120,200,${0.5 * strength})`;
  ctx.lineWidth = 1.4;
  const rng = seeded(`flare-${Math.floor(time * 4)}`);
  for (let i = 0; i < 26 * strength; i += 1) {
    const x = rng.next() * W * 1.2;
    const y = rng.next() * H;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26, y + 18); ctx.stroke();
  }
  ctx.restore();
}
