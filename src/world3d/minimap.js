// North-up circular minimap: stations, crew, artifacts, dust devils and the player arrow.
import { STATION_INFO } from './facts.js';

const RANGE = 55; // metres from the player to the map edge

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const R = S / 2;

  function toMap(x, z, cx, cz) {
    let dx = (x - cx) / RANGE;
    let dz = (z - cz) / RANGE;
    const m = Math.hypot(dx, dz);
    const clamped = m > 0.92;
    if (clamped) { dx *= 0.92 / m; dz *= 0.92 / m; }
    return { x: R + dx * R, y: R + dz * R, clamped };
  }

  function draw({ layout, player, heading, npcs = [], collectibles = [], devils = [], damaged = {}, broken = {} }) {
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    for (const r of [0.33, 0.66]) { ctx.beginPath(); ctx.arc(R, R, R * r, 0, Math.PI * 2); ctx.stroke(); }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of layout.stations) {
      const p = toMap(s.x, s.z, player.x, player.z);
      const alert = broken[s.moduleId] > 0 || damaged[s.moduleId] != null;
      ctx.globalAlpha = p.clamped ? 0.55 : 1;
      ctx.fillStyle = alert ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(p.x, p.y, s.kind === 'habitat' ? 22 : 15, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${s.kind === 'habitat' ? 26 : 20}px system-ui, sans-serif`;
      ctx.fillText(STATION_INFO[s.kind]?.icon ?? '•', p.x, p.y + 1);
    }
    ctx.globalAlpha = 1;
    for (const c of collectibles) {
      const p = toMap(c.x, c.z, player.x, player.z);
      ctx.fillStyle = '#7fe3ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#062030';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText('?', p.x, p.y + 1);
    }
    for (const d of devils) {
      const p = toMap(d.x, d.z, player.x, player.z);
      ctx.strokeStyle = '#e0a36a';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 1.6); ctx.stroke();
    }
    for (const n of npcs) {
      if (n.inside) continue;
      const p = toMap(n.x, n.z, player.x, player.z);
      ctx.fillStyle = n.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Player arrow at the centre.
    ctx.translate(R, R);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(11, 12); ctx.lineTo(0, 6); ctx.lineTo(-11, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('N', R, 18);
  }

  return { draw };
}
