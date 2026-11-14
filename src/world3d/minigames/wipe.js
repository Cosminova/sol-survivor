// Solar panel dust wipe: drag (or arrow keys) to clear a dust layer off the cells.
import { el } from '../hud.js';
import { wipeQuality } from '../minigameScoring.js';

const W = 480;
const H = 280;
const GX = 24;
const GY = 14;

export function createWipe({ root, assist, audio, setStatus, finish }) {
  const canvas = el('canvas', { width: W, height: H, 'aria-label': 'Dusty solar panel. Wipe it clean.' });
  root.append(canvas);
  const ctx = canvas.getContext('2d');
  const dust = document.createElement('canvas');
  dust.width = W; dust.height = H;
  const dctx = dust.getContext('2d');
  dctx.fillStyle = '#b88355';
  dctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i += 1) {
    dctx.fillStyle = `rgba(${150 + Math.random() * 60},${100 + Math.random() * 40},${60 + Math.random() * 30},${0.4 + Math.random() * 0.5})`;
    dctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }
  const cleaned = new Uint8Array(GX * GY);
  const radius = assist ? 52 : 36;
  const cloth = { x: W / 2, y: H / 2 };
  const keys = new Set();
  let coverage = 0;
  let lastSound = 0;

  function drawPanel() {
    ctx.fillStyle = '#1d3a7a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#5c7cc4';
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function render() {
    drawPanel();
    ctx.drawImage(dust, 0, 0);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cloth.x, cloth.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText(`${Math.round(coverage * 100)}% clean`, 12, 28);
  }

  function wipeAt(x, y) {
    dctx.globalCompositeOperation = 'destination-out';
    dctx.beginPath(); dctx.arc(x, y, radius, 0, Math.PI * 2); dctx.fill();
    dctx.globalCompositeOperation = 'source-over';
    let n = 0;
    for (let j = 0; j < GY; j += 1) {
      for (let i = 0; i < GX; i += 1) {
        const cx = (i + 0.5) * (W / GX);
        const cy = (j + 0.5) * (H / GY);
        if (!cleaned[j * GX + i] && Math.hypot(cx - x, cy - y) < radius) cleaned[j * GX + i] = 1;
        n += cleaned[j * GX + i];
      }
    }
    coverage = n / (GX * GY);
    const now = performance.now();
    if (now - lastSound > 120) { audio.sfx.scoop(); lastSound = now; }
    setStatus(`${Math.round(coverage * 100)}% clean`);
    if (coverage >= 0.93) finish(wipeQuality(coverage));
  }

  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  let down = false;
  const pd = (e) => { down = true; canvas.setPointerCapture?.(e.pointerId); Object.assign(cloth, toLocal(e)); wipeAt(cloth.x, cloth.y); };
  const pm = (e) => { Object.assign(cloth, toLocal(e)); if (down) wipeAt(cloth.x, cloth.y); };
  const pu = () => { down = false; };
  canvas.addEventListener('pointerdown', pd);
  canvas.addEventListener('pointermove', pm);
  canvas.addEventListener('pointerup', pu);
  canvas.addEventListener('pointercancel', pu);
  render();

  return {
    tick(dt) {
      let dx = 0;
      let dy = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
      if (dx || dy) {
        cloth.x = Math.max(0, Math.min(W, cloth.x + dx * 340 * dt));
        cloth.y = Math.max(0, Math.min(H, cloth.y + dy * 340 * dt));
        wipeAt(cloth.x, cloth.y);
      }
      render();
    },
    keydown(e) {
      if (/^(Arrow|Key[WASD])/.test(e.code)) { keys.add(e.code); return true; }
      if (e.code === 'Space') { wipeAt(cloth.x, cloth.y); return true; }
      return false;
    },
    keyup(e) { keys.delete(e.code); },
    timeout: () => wipeQuality(coverage),
    destroy() {
      canvas.removeEventListener('pointerdown', pd);
      canvas.removeEventListener('pointermove', pm);
      canvas.removeEventListener('pointerup', pu);
      canvas.removeEventListener('pointercancel', pu);
    },
  };
}
