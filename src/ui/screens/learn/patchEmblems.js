// Vector emblems for the mission patch. Each draws centred on (0,0) inside a box of radius r.
const TAU = Math.PI * 2;

function disc(ctx, r, stops) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

function blob(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

function mars(ctx, r) {
  const R = r * 0.82;
  disc(ctx, R, [[0, '#ffb07a'], [0.55, '#d4521c'], [1, '#6e1f08']]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.clip();
  blob(ctx, -R * 0.2, R * 0.1, R * 0.55, R * 0.12, 'rgba(110,30,8,0.55)', -0.2);
  blob(ctx, R * 0.35, -R * 0.25, R * 0.25, R * 0.14, 'rgba(110,30,8,0.45)', 0.4);
  blob(ctx, -R * 0.45, -R * 0.45, R * 0.18, R * 0.1, 'rgba(110,30,8,0.4)');
  blob(ctx, 0, -R * 0.93, R * 0.42, R * 0.16, 'rgba(255,255,255,0.92)');
  ctx.restore();
}

function moon(ctx, r) {
  const R = r * 0.82;
  disc(ctx, R, [[0, '#f4f7ff'], [0.6, '#aeb8cc'], [1, '#4d5670']]);
  [[-0.3, -0.25, 0.22], [0.35, 0.1, 0.16], [-0.1, 0.45, 0.13], [0.25, -0.5, 0.1], [-0.55, 0.2, 0.09]]
    .forEach(([x, y, s]) => {
      blob(ctx, x * R, y * R, s * R, s * R, 'rgba(70,80,105,0.45)');
      blob(ctx, x * R + s * R * 0.18, y * R + s * R * 0.18, s * R * 0.75, s * R * 0.75, 'rgba(225,231,245,0.35)');
    });
}

function rocket(ctx, r, accent) {
  const s = r / 100;
  ctx.save();
  ctx.rotate(-0.35);
  const flame = ctx.createLinearGradient(0, 40 * s, 0, 95 * s);
  flame.addColorStop(0, '#fff3b0');
  flame.addColorStop(0.5, '#ff9a3c');
  flame.addColorStop(1, 'rgba(255,90,40,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-14 * s, 45 * s);
  ctx.quadraticCurveTo(0, 110 * s, 14 * s, 45 * s);
  ctx.fill();
  ctx.fillStyle = accent;
  [[-1], [1]].forEach(([dir]) => {
    ctx.beginPath();
    ctx.moveTo(dir * 18 * s, 10 * s);
    ctx.lineTo(dir * 42 * s, 50 * s);
    ctx.lineTo(dir * 18 * s, 42 * s);
    ctx.fill();
  });
  const body = ctx.createLinearGradient(-20 * s, 0, 20 * s, 0);
  body.addColorStop(0, '#c9d3e8');
  body.addColorStop(0.45, '#ffffff');
  body.addColorStop(1, '#8a96b0');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -85 * s);
  ctx.bezierCurveTo(30 * s, -55 * s, 22 * s, 0, 18 * s, 48 * s);
  ctx.lineTo(-18 * s, 48 * s);
  ctx.bezierCurveTo(-22 * s, 0, -30 * s, -55 * s, 0, -85 * s);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, -85 * s);
  ctx.bezierCurveTo(14 * s, -72 * s, 19 * s, -62 * s, 21 * s, -55 * s);
  ctx.lineTo(-21 * s, -55 * s);
  ctx.bezierCurveTo(-19 * s, -62 * s, -14 * s, -72 * s, 0, -85 * s);
  ctx.fill();
  blob(ctx, 0, -22 * s, 11 * s, 11 * s, '#1b2a55');
  blob(ctx, -3 * s, -25 * s, 4 * s, 4 * s, 'rgba(160,230,255,0.9)');
  ctx.restore();
}

function rover(ctx, r, accent) {
  const s = r / 100;
  ctx.fillStyle = '#d7deee';
  ctx.fillRect(-55 * s, -8 * s, 110 * s, 30 * s);
  ctx.fillStyle = accent;
  ctx.fillRect(-60 * s, -20 * s, 120 * s, 12 * s);
  ctx.fillStyle = '#8a96b0';
  ctx.fillRect(28 * s, -70 * s, 7 * s, 52 * s);
  ctx.fillStyle = '#eef3ff';
  ctx.fillRect(18 * s, -82 * s, 28 * s, 16 * s);
  blob(ctx, 38 * s, -74 * s, 4 * s, 4 * s, '#1b2a55');
  ctx.strokeStyle = '#8a96b0';
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(-50 * s, 22 * s);
  ctx.lineTo(-30 * s, 40 * s);
  ctx.lineTo(0, 22 * s);
  ctx.lineTo(30 * s, 40 * s);
  ctx.lineTo(50 * s, 22 * s);
  ctx.stroke();
  [-52, -8, 36].forEach((x) => {
    blob(ctx, x * s, 48 * s, 15 * s, 15 * s, '#2a3354');
    blob(ctx, x * s, 48 * s, 6 * s, 6 * s, '#aeb8cc');
  });
}

function habitat(ctx, r, accent) {
  const s = r / 100;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-85 * s, 40 * s, 170 * s, 8 * s);
  const g = ctx.createLinearGradient(0, -60 * s, 0, 40 * s);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#9aa6c4');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 40 * s, 70 * s, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,45,90,0.35)';
  ctx.lineWidth = 3 * s;
  [-35, 0, 35].forEach((x) => {
    ctx.beginPath();
    ctx.ellipse(0, 40 * s, Math.abs(x) * s || 0.1, 70 * s, 0, Math.PI, TAU);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.ellipse(0, 40 * s, 70 * s, 28 * s, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 40 * s, 18 * s, Math.PI, 0);
  ctx.fill();
  blob(ctx, 55 * s, 30 * s, 22 * s, 14 * s, '#c9d3e8');
}

function plant(ctx, r) {
  const s = r / 100;
  ctx.fillStyle = '#c0703a';
  ctx.beginPath();
  ctx.moveTo(-34 * s, 30 * s);
  ctx.lineTo(34 * s, 30 * s);
  ctx.lineTo(24 * s, 75 * s);
  ctx.lineTo(-24 * s, 75 * s);
  ctx.fill();
  ctx.fillStyle = '#e08a4c';
  ctx.fillRect(-38 * s, 22 * s, 76 * s, 12 * s);
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.moveTo(0, 24 * s);
  ctx.quadraticCurveTo(-6 * s, -20 * s, 4 * s, -60 * s);
  ctx.stroke();
  [[-1, 0, 0.6], [1, -25, -0.6], [-1, -45, 0.8], [1, 5, -0.4]].forEach(([dir, y, rot]) => {
    const leaf = ctx.createLinearGradient(0, y * s - 15 * s, dir * 40 * s, y * s);
    leaf.addColorStop(0, '#bbf7d0');
    leaf.addColorStop(1, '#16a34a');
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.ellipse(dir * 24 * s, y * s, 26 * s, 11 * s, rot, 0, TAU);
    ctx.fill();
  });
}

function atom(ctx, r, accent, line) {
  const s = r / 100;
  ctx.lineWidth = 6 * s;
  ctx.strokeStyle = line;
  [0, Math.PI / 3, -Math.PI / 3].forEach((rot) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 80 * s, 28 * s, rot, 0, TAU);
    ctx.stroke();
  });
  disc(ctx, 18 * s, [[0, '#ffffff'], [1, accent]]);
  [[0, 0.3], [Math.PI / 3, 2.4], [-Math.PI / 3, 4.2]].forEach(([rot, t]) => {
    const ex = Math.cos(t) * 80 * s;
    const ey = Math.sin(t) * 28 * s;
    blob(ctx, ex * Math.cos(rot) - ey * Math.sin(rot), ex * Math.sin(rot) + ey * Math.cos(rot), 7 * s, 7 * s, accent);
  });
}

export function starPath(ctx, x, y, outer, inner = outer * 0.45, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function star(ctx, r) {
  const g = ctx.createRadialGradient(0, -r * 0.2, r * 0.05, 0, 0, r * 0.9);
  g.addColorStop(0, '#fff6cf');
  g.addColorStop(0.6, '#ffd166');
  g.addColorStop(1, '#e09a1a');
  ctx.fillStyle = g;
  starPath(ctx, 0, r * 0.05, r * 0.85);
  ctx.fill();
}

export const EMBLEMS = [
  { id: 'mars', label: 'Mars', icon: '🔴', draw: mars },
  { id: 'moon', label: 'Moon', icon: '🌕', draw: moon },
  { id: 'rocket', label: 'Rocket', icon: '🚀', draw: rocket },
  { id: 'rover', label: 'Rover', icon: '🛻', draw: rover },
  { id: 'habitat', label: 'Habitat dome', icon: '🛖', draw: habitat },
  { id: 'plant', label: 'Greenhouse plant', icon: '🌱', draw: plant },
  { id: 'atom', label: 'Atom', icon: '⚛️', draw: atom },
  { id: 'star', label: 'Star', icon: '⭐', draw: star },
];

// line: outline color that contrasts with the patch background.
export function drawEmblem(ctx, id, r, accent, line = '#eef3ff') {
  const emblem = EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = r * 0.08;
  ctx.shadowOffsetY = r * 0.03;
  emblem.draw(ctx, r, accent, line);
  ctx.restore();
}
