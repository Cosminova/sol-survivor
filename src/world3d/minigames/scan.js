// Spectrometer scan: sweep a reticle over the rock to find the mineral hot spot.
import { el } from '../hud.js';
import { scanSignal, scanLocked, scanRadius, timedQuality } from '../minigameScoring.js';

const W = 480;
const H = 300;

export function createScan({ root, assist, ease, rng, role, audio, limit, setStatus, finish }) {
  const canvas = el('canvas', { width: W, height: H, 'aria-label': 'Rock surface. Find the hot spot.' });
  const bar = el('div', { class: 'w3d-fill', style: 'width:0%;background:#3ddc84' });
  root.append(canvas, el('div', { class: 'w3d-meter', role: 'meter', 'aria-label': 'Signal strength' }, bar));
  const ctx = canvas.getContext('2d');
  const radius = scanRadius(role, ease * (assist ? 1.4 : 1));
  const hot = { x: 0.15 + rng.next() * 0.7, y: 0.2 + rng.next() * 0.6 };
  const ret = { x: 0.5, y: 0.5 };
  const keys = new Set();
  let hold = 0;
  let beep = 0;
  let time = 0;
  if (role === 'geologist') setStatus('Geologist bonus: your scanner has a wider beam!');

  // Static rock texture.
  const rock = document.createElement('canvas');
  rock.width = W; rock.height = H;
  const r = rock.getContext('2d');
  r.fillStyle = '#7a5038';
  r.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i += 1) {
    r.fillStyle = `rgba(${170 + rng.next() * 50},${110 + rng.next() * 40},${70 + rng.next() * 30},0.35)`;
    r.fillRect(0, rng.next() * H, W, 4 + rng.next() * 18); // sedimentary layers
  }
  for (let i = 0; i < 500; i += 1) {
    r.fillStyle = `rgba(${rng.next() * 60},${rng.next() * 40},${rng.next() * 30},0.4)`;
    r.beginPath(); r.arc(rng.next() * W, rng.next() * H, 1 + rng.next() * 3, 0, Math.PI * 2); r.fill();
  }

  function render() {
    ctx.drawImage(rock, 0, 0);
    if (assist) {
      const g = ctx.createRadialGradient(hot.x * W, hot.y * H, 0, hot.x * W, hot.y * H, radius * W * 2.5);
      g.addColorStop(0, `rgba(127,227,255,${0.25 + 0.15 * Math.sin(time * 4)})`);
      g.addColorStop(1, 'rgba(127,227,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const sig = scanSignal(ret, hot, radius);
    ctx.strokeStyle = sig > 0.75 ? '#3ddc84' : '#ffd23f';
    ctx.lineWidth = 3;
    const x = ret.x * W;
    const y = ret.y * H;
    const rr = radius * W;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - rr - 10, y); ctx.lineTo(x + rr + 10, y); ctx.moveTo(x, y - rr - 10); ctx.lineTo(x, y + rr + 10); ctx.stroke();
    if (hold > 0) {
      ctx.strokeStyle = '#3ddc84';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, rr + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, hold / 0.7)); ctx.stroke();
    }
  }

  const move = (e) => {
    const b = canvas.getBoundingClientRect();
    ret.x = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    ret.y = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
  };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', move);

  return {
    tick(dt) {
      time += dt;
      let dx = 0;
      let dy = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
      ret.x = Math.max(0, Math.min(1, ret.x + dx * 0.55 * dt));
      ret.y = Math.max(0, Math.min(1, ret.y + dy * 0.55 * dt));
      const sig = scanSignal(ret, hot, radius);
      bar.style.width = `${sig * 100}%`;
      beep -= dt;
      if (beep <= 0 && sig > 0.05) { audio.sfx.tick(); beep = 0.6 - sig * 0.5; }
      hold = scanLocked(ret, hot, radius) ? hold + dt : 0;
      if (hold >= 0.7) { audio.sfx.perfect(); finish(timedQuality(time, limit)); }
      render();
    },
    keydown(e) {
      if (/^(Arrow|Key[WASD])/.test(e.code)) { keys.add(e.code); return true; }
      return false;
    },
    keyup(e) { keys.delete(e.code); },
    timeout: () => 0.35,
    destroy() {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', move);
    },
  };
}
