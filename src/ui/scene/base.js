// Outpost structures drawn from the mission's actual loadout. Each item has a depth for painter ordering
// and an optional emissive() pass (windows, grow lights, beacons) drawn on top of the night overlay.
import { project, roundRect, clamp } from './util.js';

const SLOTS = {
  habitat: [{ x: 0.5, d: 0.42 }],
  shelter: [{ x: 0.35, d: 0.34 }],
  greenhouse: [{ x: 0.69, d: 0.4 }, { x: 0.8, d: 0.47 }, { x: 0.7, d: 0.62 }],
  solar: [{ x: 0.07, d: 0.28 }, { x: 0.16, d: 0.28 }, { x: 0.25, d: 0.28 }, { x: 0.06, d: 0.52 }, { x: 0.16, d: 0.52 }, { x: 0.26, d: 0.52 }, { x: 0.06, d: 0.78 }, { x: 0.17, d: 0.78 }],
  battery: [{ x: 0.37, d: 0.6 }, { x: 0.4, d: 0.63 }, { x: 0.34, d: 0.66 }, { x: 0.37, d: 0.69 }, { x: 0.4, d: 0.72 }, { x: 0.34, d: 0.75 }],
  fission: [{ x: 0.95, d: 0.1 }, { x: 0.89, d: 0.08 }, { x: 0.83, d: 0.06 }],
  recycler: [{ x: 0.58, d: 0.64 }],
  oxygen: [{ x: 0.62, d: 0.67 }, { x: 0.655, d: 0.7 }],
  moxie: [{ x: 0.45, d: 0.7 }, { x: 0.485, d: 0.73 }, { x: 0.52, d: 0.76 }],
  regolithO2: [{ x: 0.45, d: 0.7 }, { x: 0.49, d: 0.73 }],
  iceDrill: [{ x: 0.88, d: 0.62 }, { x: 0.94, d: 0.8 }],
  rover: [{ x: 0.3, d: 0.86 }],
  relay: [{ x: 0.585, d: 0.26 }],
  spares: [{ x: 0.44, d: 0.6 }],
};

export function glow(ctx, x, y, r, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.35, `rgba(${rgb},${alpha * 0.5})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
}

function brokenMarker(ctx, x, y, s, time) {
  ctx.fillStyle = Math.sin(time * 8) > 0 ? '#ff3b4e' : '#5a1018';
  ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i += 1) {
    const k = (time * 0.6 + i / 3) % 1;
    ctx.fillStyle = `rgba(60,60,60,${0.45 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 6 + i) * 6 * s, y - k * 40 * s, (4 + k * 10) * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function berm(ctx, x, y, w, hgt, s, level, body) {
  const bh = hgt * (0.38 * level) + 6 * s;
  ctx.fillStyle = body === 'mars' ? '#8f4423' : '#7b7e85';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.75, y + 12 * s);
  ctx.quadraticCurveTo(x - w * 0.55, y - bh * 1.15, x, y - bh);
  ctx.quadraticCurveTo(x + w * 0.55, y - bh * 1.15, x + w * 0.75, y + 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 18; i += 1) ctx.fillRect(x - w * 0.6 + (i * w * 1.2) / 18, y - bh * 0.5 + ((i * 7) % 5) * s, 3 * s, 2 * s);
}

function habitat(ctx, x, y, s, o) {
  const w = 120 * s; const hgt = 50 * s; const base = y - 12 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 2 * s, w * 0.62, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#555c6b'; ctx.lineWidth = 3 * s;
  [-0.35, 0.35].forEach((k) => { ctx.beginPath(); ctx.moveTo(x + k * w, y); ctx.lineTo(x + k * w * 1.1, base); ctx.stroke(); });
  const g = ctx.createLinearGradient(0, base - hgt, 0, base);
  g.addColorStop(0, '#f4f6fb'); g.addColorStop(0.6, '#c9cfdb'); g.addColorStop(1, '#8a93a6');
  ctx.fillStyle = g;
  roundRect(ctx, x - w / 2, base - hgt, w, hgt, hgt / 2); ctx.fill();
  ctx.fillStyle = '#ff7a3d';
  ctx.fillRect(x - w / 2 + hgt / 3, base - hgt * 0.28, w - hgt * 0.66, 4 * s);
  ctx.fillStyle = '#a3abbd';
  roundRect(ctx, x - w / 2 - 16 * s, base - hgt * 0.75, 22 * s, hgt * 0.6, 5 * s); ctx.fill();
  ctx.fillStyle = '#3b4252';
  roundRect(ctx, x - w / 2 - 12 * s, base - hgt * 0.68, 10 * s, hgt * 0.46, 3 * s); ctx.fill();
  const windows = [0, 1, 2, 3].map((i) => ({ x: x - w * 0.28 + i * w * 0.19, y: base - hgt * 0.62, r: 6 * s }));
  ctx.fillStyle = '#1d2433';
  windows.forEach((wn) => { ctx.beginPath(); ctx.arc(wn.x, wn.y, wn.r, 0, Math.PI * 2); ctx.fill(); });
  if (o.shieldLevel > 0) berm(ctx, x, base, w, hgt, s, o.shieldLevel, o.body);
  return windows;
}

function solar(ctx, x, y, s, o) {
  const w = 62 * s; const hgt = 24 * s;
  ctx.strokeStyle = '#4b5263'; ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 18 * s); ctx.stroke();
  ctx.save();
  ctx.translate(x, y - 20 * s);
  ctx.transform(1, 0, -0.35, 1, 0, 0);
  ctx.fillStyle = '#16346e';
  ctx.fillRect(-w / 2, -hgt, w, hgt);
  ctx.strokeStyle = 'rgba(140,190,255,0.5)'; ctx.lineWidth = 0.8;
  for (let i = 1; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(-w / 2 + (i * w) / 6, -hgt); ctx.lineTo(-w / 2 + (i * w) / 6, 0); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-w / 2, -hgt / 2); ctx.lineTo(w / 2, -hgt / 2); ctx.stroke();
  const shine = ctx.createLinearGradient(-w / 2, -hgt, w / 2, 0);
  shine.addColorStop(0, `rgba(180,220,255,${0.35 * o.light})`); shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine; ctx.fillRect(-w / 2, -hgt, w, hgt);
  if (o.dust > 0.01) {
    ctx.fillStyle = o.body === 'mars' ? `rgba(196,120,70,${clamp(o.dust * 1.1, 0, 0.92)})` : `rgba(160,160,165,${clamp(o.dust * 2, 0, 0.8)})`;
    ctx.fillRect(-w / 2, -hgt, w, hgt);
  }
  ctx.strokeStyle = '#c0c7d4'; ctx.lineWidth = 1.2 * s; ctx.strokeRect(-w / 2, -hgt, w, hgt);
  ctx.restore();
}

function box(ctx, x, y, s, { w = 22, hgt = 16, color = '#d7dbe5', accent = '#4fe3ff', tank = false }) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 1, w * 0.7 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x - (w / 2) * s, y - hgt * s, w * s, hgt * s, 3 * s); ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(x - (w / 2 - 3) * s, y - (hgt - 4) * s, (w - 6) * s, 2.5 * s);
  if (tank) { ctx.fillStyle = '#eef2f8'; ctx.beginPath(); ctx.ellipse(x + (w / 2 + 4) * s, y - hgt * 0.55 * s, 5 * s, hgt * 0.5 * s, 0, 0, Math.PI * 2); ctx.fill(); }
}

function greenhouse(ctx, x, y, s, o) {
  const r = 34 * s; const floor = y - 5 * s;
  ctx.fillStyle = '#6b7385'; ctx.fillRect(x - r, floor, r * 2, 5 * s);
  const growth = clamp(o.growth / 25);
  ctx.fillStyle = '#2f8a3c';
  for (let i = 0; i < 9; i += 1) {
    const px = x - r * 0.75 + (i * r * 1.5) / 8;
    const ph = (5 + growth * 16 + (i % 3) * 3) * s;
    ctx.beginPath(); ctx.ellipse(px, floor - ph / 2, 3.5 * s, ph / 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.3, floor - r * 0.8, r * 0.1, x, floor - r * 0.4, r * 1.1);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(200,240,255,0.18)'); g.addColorStop(1, 'rgba(160,220,255,0.3)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, floor, r, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(220,235,255,0.7)'; ctx.lineWidth = 1.2 * s;
  ctx.beginPath(); ctx.arc(x, floor, r, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x, floor - r); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, floor, r * 0.5, r, 0, Math.PI, 0); ctx.stroke();
}

function fission(ctx, x, y, s) {
  ctx.fillStyle = '#7d8597';
  for (let i = 0; i < 6; i += 1) {
    ctx.save(); ctx.translate(x, y - 26 * s); ctx.rotate((i - 2.5) * 0.28);
    ctx.fillRect(-2 * s, -34 * s, 4 * s, 34 * s); ctx.restore();
  }
  ctx.fillStyle = '#c9cfdb'; roundRect(ctx, x - 9 * s, y - 30 * s, 18 * s, 30 * s, 4 * s); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y - 15 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y - 15 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
}

function iceDrill(ctx, x, y, s, time, running) {
  ctx.strokeStyle = '#c0c7d4'; ctx.lineWidth = 2.4 * s;
  ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.lineTo(x, y - 46 * s); ctx.lineTo(x + 14 * s, y); ctx.moveTo(x, y - 46 * s); ctx.lineTo(x, y); ctx.stroke();
  const bob = running ? Math.sin(time * 6) * 4 * s : 0;
  ctx.fillStyle = '#ff7a3d'; ctx.fillRect(x - 5 * s, y - 30 * s + bob, 10 * s, 12 * s);
  ctx.fillStyle = '#e6f4ff'; ctx.beginPath(); ctx.ellipse(x + 20 * s, y - 4 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
}

export function rover(ctx, x, y, s, facing = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(facing, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2 * s, 34 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8ebf2'; roundRect(ctx, -30 * s, -26 * s, 60 * s, 18 * s, 8 * s); ctx.fill();
  ctx.fillStyle = '#ff7a3d'; ctx.fillRect(-26 * s, -14 * s, 52 * s, 3 * s);
  ctx.fillStyle = '#1d2433'; roundRect(ctx, 12 * s, -23 * s, 15 * s, 8 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#2b303b';
  [-22, -4, 14].forEach((wx) => { ctx.beginPath(); ctx.arc(wx * s, -6 * s, 6 * s, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

function relay(ctx, x, y, s) {
  ctx.strokeStyle = '#aab2c2'; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 52 * s); ctx.stroke();
  ctx.fillStyle = '#e8ebf2';
  ctx.beginPath(); ctx.ellipse(x - 4 * s, y - 56 * s, 13 * s, 6 * s, -0.6, 0, Math.PI * 2); ctx.fill();
}

function shelter(ctx, x, y, s) {
  ctx.fillStyle = '#6f6a67'; ctx.beginPath(); ctx.moveTo(x - 30 * s, y); ctx.quadraticCurveTo(x, y - 44 * s, x + 30 * s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a2a2e'; roundRect(ctx, x - 6 * s, y - 16 * s, 12 * s, 16 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(x - 10 * s, y - 20 * s, 20 * s, 2 * s);
}

function spares(ctx, x, y, s) {
  [[0, 0], [12, 0], [6, -10]].forEach(([dx, dy]) => {
    ctx.fillStyle = '#c08a3e'; ctx.fillRect(x + (dx - 10) * s, y + (dy - 10) * s, 11 * s, 10 * s);
    ctx.strokeStyle = '#7a5520'; ctx.lineWidth = 1; ctx.strokeRect(x + (dx - 10) * s, y + (dy - 10) * s, 11 * s, 10 * s);
  });
}

// Builds a depth-sorted list of drawable items for the current mission view model.
export function buildBase(vm, W, H, horizon) {
  const items = [];
  const add = (id, i, draw, emissive = null) => {
    const slot = SLOTS[id]?.[i];
    if (!slot) return;
    const { y, scale } = project(slot.d, W, H, horizon);
    items.push({ id, depth: slot.d, x: slot.x * W, y, s: scale, broken: i < (vm.broken[id] ?? 0), draw, emissive });
  };
  const count = (id) => vm.modules[id] ?? 0;
  const on = (id) => vm.enabled[id] !== false && (vm.running[id] ?? 1) > 0;
  let windows = [];
  add('habitat', 0, (ctx, it) => { windows = habitat(ctx, it.x, it.y, it.s, { shieldLevel: vm.shieldLevel, body: vm.body }); },
    (ctx, it, st) => windows.forEach((wn, k) => glow(ctx, wn.x, wn.y, wn.r, vm.sheltering && k === 0 ? '255,90,90' : '255,214,140', 0.55 + 0.45 * st.night)));
  for (let i = 0; i < count('solar'); i += 1) add('solar', i, (ctx, it, st) => solar(ctx, it.x, it.y, it.s, { dust: vm.dust, light: st.light, body: vm.body }));
  for (let i = 0; i < count('battery'); i += 1) add('battery', i, (ctx, it) => box(ctx, it.x, it.y, it.s, { w: 18, hgt: 20, color: '#3a4256', accent: vm.batteryPct > 30 ? '#4ade80' : '#ff5d6c' }));
  for (let i = 0; i < count('fission'); i += 1) add('fission', i, (ctx, it) => fission(ctx, it.x, it.y, it.s), (ctx, it) => glow(ctx, it.x, it.y - 15 * it.s, 5 * it.s, '255,200,80', 0.6));
  for (let i = 0; i < count('greenhouse'); i += 1) {
    add('greenhouse', i, (ctx, it) => greenhouse(ctx, it.x, it.y, it.s, { growth: vm.growth }),
      on('greenhouse') ? (ctx, it, st) => glow(ctx, it.x, it.y - 18 * it.s, 30 * it.s, '255,90,220', 0.25 + 0.35 * st.night) : null);
  }
  if (count('recycler')) add('recycler', 0, (ctx, it) => box(ctx, it.x, it.y, it.s, { accent: '#60a5fa', tank: true }));
  for (let i = 0; i < count('oxygen'); i += 1) add('oxygen', i, (ctx, it) => box(ctx, it.x, it.y, it.s, { accent: '#7dd3fc', tank: true }));
  for (let i = 0; i < count('moxie'); i += 1) add('moxie', i, (ctx, it) => box(ctx, it.x, it.y, it.s, { w: 18, hgt: 14, color: '#c9a66b', accent: '#ffd166' }));
  for (let i = 0; i < count('regolithO2'); i += 1) add('regolithO2', i, (ctx, it) => box(ctx, it.x, it.y, it.s, { w: 24, hgt: 18, color: '#8d8f96', accent: '#ff7a3d' }));
  for (let i = 0; i < count('iceDrill'); i += 1) add('iceDrill', i, (ctx, it, st) => iceDrill(ctx, it.x, it.y, it.s, st.time, on('iceDrill')));
  if (count('rover') && !vm.roverOut) add('rover', 0, (ctx, it) => rover(ctx, it.x, it.y, it.s));
  if (count('relay')) add('relay', 0, (ctx, it) => relay(ctx, it.x, it.y, it.s), (ctx, it, st) => { if (Math.sin(st.time * 3) > 0.6) glow(ctx, it.x, it.y - 52 * it.s, 4 * it.s, '255,60,60', 1); });
  if (count('shelter')) add('shelter', 0, (ctx, it) => shelter(ctx, it.x, it.y, it.s));
  if (count('spares')) add('spares', 0, (ctx, it) => spares(ctx, it.x, it.y, it.s));
  return items.sort((a, b) => a.depth - b.depth);
}

export function drawBroken(ctx, it, time) {
  if (it.broken) brokenMarker(ctx, it.x, it.y - 34 * it.s, it.s, time);
}
