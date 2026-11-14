// Outpost scene controller: owns the canvas, resize handling, animation loop and the mission view model.
import { isOnEva } from '../../engine/sim.js';
import { prefersReducedMotion } from '../dom.js';
import { clamp } from './util.js';
import { drawSky, makeStars, skyMood } from './sky.js';
import { renderTerrain } from './terrain.js';
import { buildBase, drawBroken } from './base.js';
import { actors, makeDust, drawDust, drawFlare } from './actors.js';

const DAY_SECONDS = 48;

export function sceneModel(m) {
  const sheltering = Boolean(m.today?.shelter);
  const cap = m.capacity?.batteryKwh ?? 0;
  return {
    body: m.config.body,
    seed: m.site?.id ?? m.config.siteId,
    siteLat: m.site?.lat ?? 0,
    lit: m.env?.lit !== false,
    tau: m.env?.tau ?? 0,
    storm: Boolean(m.env?.storm),
    dust: m.env?.dust ?? 0,
    modules: m.modules ?? {},
    broken: m.broken ?? {},
    enabled: m.enabled ?? {},
    running: m.lastReport?.power?.running ?? {},
    shieldLevel: m.shield?.level ?? 0,
    growth: m.greenhouse?.growth ?? 0,
    eva: sheltering || m.status !== 'active' || m.sol === 0 ? [] : m.crew.filter((c) => c.health > 0 && isOnEva(m, c)).map((c) => ({ id: c.id, task: c.task })),
    sheltering,
    sep: m.today?.sep?.severity ?? null,
    aurora: Boolean(m.today?.sep) || m.lastEvent?.id === 'aurora',
    batteryPct: cap > 0 ? (100 * m.resources.batteryKwh) / cap : 100,
  };
}

export function createScene(canvas, { label } = {}) {
  const ctx = canvas.getContext('2d');
  let vm = null;
  let W = 0; let H = 0; let horizon = 0; let dpr = 1;
  let terrain = null; let terrainKey = '';
  let stars = []; let motes = [];
  let raf = 0; let running = true;
  const start = performance.now();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(280, rect.width);
    H = Math.max(180, rect.height);
    horizon = H * 0.56;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    terrainKey = '';
  }

  function ensureLayers() {
    const key = `${vm.body}:${vm.seed}:${W}x${H}:${dpr}`;
    if (key === terrainKey) return;
    terrain = renderTerrain({ W, H, horizon, dpr, body: vm.body, seed: vm.seed });
    stars = makeStars(vm.seed);
    motes = makeDust(vm.seed, 260);
    terrainKey = key;
  }

  function draw(time) {
    if (!vm || !W) return;
    ensureLayers();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduced = prefersReducedMotion();
    const t = reduced ? 0.25 : (0.08 + time / DAY_SECONDS) % 1;
    const sky = drawSky(ctx, W, horizon, { body: vm.body, t, time, tau: vm.tau, lit: vm.lit, aurora: vm.aurora, stars, siteLat: vm.siteLat });
    ctx.drawImage(terrain, 0, 0, W, H);

    const light = skyMood(vm.body, sky, vm.tau);
    const moving = actors(vm, W, H, horizon, reduced ? 3 : time);
    const base = buildBase({ ...vm, roverOut: moving.roverOut }, W, H, horizon);
    const st = { time, light, night: 0 };
    [...base, ...moving.list].sort((a, b) => a.depth - b.depth).forEach((it) => {
      it.draw(ctx, it, st);
      if (it.broken) drawBroken(ctx, it, time);
    });

    if (vm.body === 'mars' && vm.tau > 0.6) {
      ctx.fillStyle = `rgba(175,110,65,${clamp((vm.tau - 0.5) * 0.045, 0, 0.5)})`;
      ctx.fillRect(0, horizon - H * 0.12, W, H);
    }
    const dark = vm.body === 'moon' ? (vm.lit ? 0.05 : 0.72) : clamp((1 - light) * 0.78, 0, 0.78);
    if (dark > 0.01) {
      ctx.fillStyle = vm.body === 'moon' && !vm.lit ? `rgba(8,16,44,${dark})` : `rgba(6,8,26,${dark})`;
      ctx.fillRect(0, horizon - H * 0.12, W, H);
    }
    st.night = dark / 0.78;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    base.forEach((it) => it.emissive?.(ctx, it, st));
    ctx.restore();

    drawDust(ctx, W, H, motes, { tau: vm.tau, storm: vm.storm, time: reduced ? 0 : time, body: vm.body });
    if (vm.sep && !reduced) drawFlare(ctx, W, H, { time, severity: vm.sep });
    if (vm.storm) {
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
      v.addColorStop(0, 'rgba(120,60,30,0)');
      v.addColorStop(1, 'rgba(90,45,20,0.55)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(now) {
    if (!running) return;
    draw((now - start) / 1000);
    raf = requestAnimationFrame(loop);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (prefersReducedMotion()) draw(0);
  });
  observer.observe(canvas);
  resize();
  canvas.setAttribute('role', 'img');
  if (label) canvas.setAttribute('aria-label', label);

  return {
    update(mission, description) {
      vm = sceneModel(mission);
      if (description) canvas.setAttribute('aria-label', description);
      if (prefersReducedMotion()) draw(0);
      else if (!raf) raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
    },
  };
}
