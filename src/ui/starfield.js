// Twinkling parallax starfield with occasional shooting stars. Static when motion is reduced.
import { prefersReducedMotion } from './dom.js';

export function createStarfield(canvas, { density = 0.00018, shooting = true } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let stars = [];
  let meteors = [];
  let raf = 0;
  let running = true;
  let w = 0;
  let hgt = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    hgt = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(w * hgt * density) + 40;
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * hgt,
      r: Math.random() ** 3 * 1.6 + 0.3,
      depth: Math.random() * 0.9 + 0.1,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.15 ? 25 : Math.random() < 0.3 ? 200 : 0,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, hgt);
    for (const st of stars) {
      const tw = 0.6 + 0.4 * Math.sin(t * 0.0015 * (1 + st.depth) + st.phase);
      const x = (st.x - t * 0.004 * st.depth) % w;
      ctx.globalAlpha = tw * (0.4 + 0.6 * st.depth);
      ctx.fillStyle = st.hue ? `hsl(${st.hue} 90% 85%)` : '#fff';
      ctx.beginPath();
      ctx.arc(x < 0 ? x + w : x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const m of meteors) {
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
      grad.addColorStop(0, `rgba(255,255,255,${m.life})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
      ctx.stroke();
    }
  }

  function step(t) {
    if (!running) return;
    if (shooting && Math.random() < 0.004) {
      meteors.push({ x: Math.random() * w, y: Math.random() * hgt * 0.5, vx: 6 + Math.random() * 4, vy: 2 + Math.random() * 2, life: 1 });
    }
    meteors = meteors.map((m) => ({ ...m, x: m.x + m.vx, y: m.y + m.vy, life: m.life - 0.025 })).filter((m) => m.life > 0);
    draw(t);
    raf = requestAnimationFrame(step);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (prefersReducedMotion()) draw(0);
  });
  observer.observe(canvas);
  resize();
  if (prefersReducedMotion()) draw(0);
  else raf = requestAnimationFrame(step);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
    },
  };
}
