// Rotating planet rendered on a canvas by projecting the bundled NASA Trek tiles onto a sphere.
// Per-pixel latitude/longitude and lighting are precomputed once; each frame only shifts longitude.
import { TILE_COLS, TILE_ROWS, tileUrl } from './mapView.js';
import { prefersReducedMotion } from './dom.js';

const TILE = 256;
const textures = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`tile ${src}`));
    img.src = src;
  });
}

// Returns { width, height, data } of the stitched equirectangular map (downsampled by `scale`).
export function loadTexture(body, scale = 0.5) {
  const key = `${body}:${scale}`;
  if (!textures.has(key)) {
    textures.set(key, (async () => {
      const w = TILE * TILE_COLS * scale;
      const hgt = TILE * TILE_ROWS * scale;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hgt;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = body === 'mars' ? '#a0522d' : '#8a8f99';
      ctx.fillRect(0, 0, w, hgt);
      const jobs = [];
      for (let r = 0; r < TILE_ROWS; r += 1) {
        for (let c = 0; c < TILE_COLS; c += 1) {
          jobs.push(loadImage(tileUrl(body, r, c))
            .then((img) => ctx.drawImage(img, c * TILE * scale, r * TILE * scale, TILE * scale, TILE * scale))
            .catch(() => {}));
        }
      }
      await Promise.all(jobs);
      return { width: w, height: hgt, data: ctx.getImageData(0, 0, w, hgt).data };
    })());
  }
  return textures.get(key);
}

function precompute(n, tiltDeg) {
  const lat = new Float32Array(n * n);
  const lon = new Float32Array(n * n);
  const shade = new Float32Array(n * n);
  const tilt = (tiltDeg * Math.PI) / 180;
  const [ct, st] = [Math.cos(tilt), Math.sin(tilt)];
  const L = [-0.62, 0.42, 0.66];
  const r = n / 2;
  for (let py = 0; py < n; py += 1) {
    for (let px = 0; px < n; px += 1) {
      const i = py * n + px;
      const x = (px + 0.5 - r) / r;
      const y = (r - py - 0.5) / r;
      const d2 = x * x + y * y;
      if (d2 > 1) { shade[i] = -1; continue; }
      const z = Math.sqrt(1 - d2);
      const xr = x * ct - y * st;
      const yr = x * st + y * ct;
      lat[i] = Math.asin(yr);
      lon[i] = Math.atan2(xr, z);
      const lambert = Math.max(0, x * L[0] + y * L[1] + z * L[2]);
      const limb = 0.55 + 0.45 * z;
      shade[i] = Math.min(1.25, (0.05 + 1.15 * lambert ** 0.85) * limb);
    }
  }
  return { lat, lon, shade };
}

// createGlobe(canvas, { body, size, tiltDeg, period (s per turn), atmosphere }) -> { stop }
export function createGlobe(canvas, { body = 'mars', size = 360, tiltDeg = 22, period = 60, atmosphere = true } = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const n = Math.round(Math.min(560, size * dpr));
  const pad = Math.round(n * 0.12);
  canvas.width = n + pad * 2;
  canvas.height = n + pad * 2;
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  off.width = n;
  off.height = n;
  const octx = off.getContext('2d');
  const img = octx.createImageData(n, n);
  const geo = precompute(n, tiltDeg);
  let tex = null;
  let raf = 0;
  let running = true;
  let rot = Math.random() * Math.PI * 2;
  let last = performance.now();

  const glowColor = body === 'mars' ? '255,140,80' : '200,215,255';

  function paint() {
    const out = img.data;
    const { width: tw, height: th, data } = tex;
    const TWO_PI = Math.PI * 2;
    for (let i = 0; i < n * n; i += 1) {
      const sh = geo.shade[i];
      const o = i * 4;
      if (sh < 0) { out[o + 3] = 0; continue; }
      let u = (geo.lon[i] + rot) / TWO_PI;
      u -= Math.floor(u);
      const v = 0.5 - geo.lat[i] / Math.PI;
      const t = ((Math.min(th - 1, (v * th) | 0) * tw) + ((u * tw) | 0)) * 4;
      out[o] = Math.min(255, data[t] * sh);
      out[o + 1] = Math.min(255, data[t + 1] * sh);
      out[o + 2] = Math.min(255, data[t + 2] * sh);
      out[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const c = canvas.width / 2;
    if (atmosphere) {
      const halo = ctx.createRadialGradient(c, c, n * 0.45, c, c, n * 0.62);
      halo.addColorStop(0, `rgba(${glowColor},0.45)`);
      halo.addColorStop(0.4, `rgba(${glowColor},0.14)`);
      halo.addColorStop(1, `rgba(${glowColor},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(off, pad, pad);
    if (atmosphere) {
      const rim = ctx.createRadialGradient(c - n * 0.12, c - n * 0.1, n * 0.38, c, c, n * 0.5);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(0.85, `rgba(${glowColor},0)`);
      rim.addColorStop(1, `rgba(${glowColor},0.35)`);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(c, c, n / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    rot += (dt * Math.PI * 2) / period;
    paint();
    raf = requestAnimationFrame(frame);
  }

  loadTexture(body).then((t) => {
    if (!running) return;
    tex = t;
    if (prefersReducedMotion()) paint();
    else raf = requestAnimationFrame(frame);
  });

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
