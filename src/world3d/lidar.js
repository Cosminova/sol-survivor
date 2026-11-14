// NASA laser-altimeter terrain (MGS MOLA on Mars, LRO LOLA on the Moon) around each landing site.
// Files are produced by scripts/fetch-3d-assets.mjs: public/terrain/{siteId}.bin (Int16 LE heights
// in heightStepM steps, relative to the base) + {siteId}.json sidecar. Parsing is pure and testable.

export function validateMeta(meta) {
  const ok = meta && Number.isInteger(meta.width) && Number.isInteger(meta.height) && meta.width > 1 && meta.height > 1
    && meta.metersPerPixel > 0 && meta.heightStepM > 0 && meta.encoding === 'int16le';
  if (!ok) throw new Error('lidar: invalid terrain sidecar');
  return meta;
}

// Returns a sampler in metres: x east, z south, origin at the base. Outside the patch it clamps.
export function parseLidar(buffer, meta) {
  validateMeta(meta);
  const { width: W, height: H, metersPerPixel: mpp, heightStepM: step } = meta;
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength !== W * H * 2) throw new Error(`lidar: expected ${W * H * 2} bytes, got ${bytes.byteLength}`);
  const view = new DataView(bytes);
  const grid = new Float32Array(W * H);
  for (let i = 0; i < W * H; i += 1) grid[i] = view.getInt16(i * 2, true) * step;
  const cx = (W - 1) / 2;
  const cz = (H - 1) / 2;
  const at = (c, r) => grid[r * W + c];

  function sample(x, z) {
    const c = Math.min(W - 1.001, Math.max(0, cx + x / mpp));
    const r = Math.min(H - 1.001, Math.max(0, cz + z / mpp));
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const fc = c - c0;
    const fr = r - r0;
    const top = at(c0, r0) * (1 - fc) + at(c0 + 1, r0) * fc;
    const bot = at(c0, r0 + 1) * (1 - fc) + at(c0 + 1, r0 + 1) * fc;
    return top * (1 - fr) + bot * fr;
  }

  const offset = sample(0, 0);
  return {
    meta,
    halfExtent: Math.min(cx, cz) * mpp,
    sample: (x, z) => sample(x, z) - offset,
    raw: grid,
  };
}

const cache = new Map();

export function loadLidar(siteId, { base = document.baseURI, timeoutMs = 6000 } = {}) {
  if (!siteId) return Promise.resolve(null);
  if (cache.has(siteId)) return cache.get(siteId);
  const url = (f) => new URL(`terrain/${f}`, base).href;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
  const p = Promise.all([
    fetch(url(`${siteId}.json`), { signal: ctrl?.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    fetch(url(`${siteId}.bin`), { signal: ctrl?.signal }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))),
  ])
    .then(([meta, buf]) => parseLidar(buf, meta))
    .catch((err) => {
      console.warn(`[world3d] lidar terrain for ${siteId} unavailable, using procedural ground`, err);
      cache.delete(siteId);
      return null;
    })
    .finally(() => clearTimeout(timer));
  cache.set(siteId, p);
  return p;
}
