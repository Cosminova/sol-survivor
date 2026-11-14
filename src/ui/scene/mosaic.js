// NASA Trek global mosaics served as 8 x 4 equirectangular tiles (256 px each) from public/tiles/{body}/{row}_{col}.jpg.
// Row 0 is north, col 0 starts at 180°W, 45° per tile. This module loads tiles once and samples them for the
// outpost terrain (azimuthal crop around a site) and the start-screen globe (full mosaic).
import { clamp, fbm, hash2, hexToRgb, lerp, DEG } from './sceneUtil.js';

export const TILE_COLS = 8;
export const TILE_ROWS = 4;
export const TILE_PX = 256;
export const MOSAIC_W = TILE_COLS * TILE_PX; // 2048
export const MOSAIC_H = TILE_ROWS * TILE_PX; // 1024

const tileCache = new Map(); // url -> Promise<HTMLImageElement|null>
const fullMosaicCache = new Map(); // body -> Promise<HTMLCanvasElement>

export function tileUrl(body, row, col) {
  const base = import.meta.env?.BASE_URL ?? './';
  return `${base}tiles/${body}/${row}_${col}.jpg`;
}

export function loadTile(body, row, col) {
  const url = tileUrl(body, row, col);
  if (!tileCache.has(url)) {
    tileCache.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      }),
    );
  }
  return tileCache.get(url);
}

/** Pixel position in the 2048 x 1024 mosaic for a planetocentric lat/lon (east-positive). */
export function latLonToPixel(lat, lon) {
  let l = ((((lon + 180) % 360) + 360) % 360) - 180;
  const x = ((l + 180) / 360) * MOSAIC_W;
  const y = ((90 - clamp(lat, -90, 90)) / 180) * MOSAIC_H;
  return { x, y };
}

/** Tiles covering a circle of radiusDeg (great-circle degrees) around lat/lon. Polar sites take the whole row. */
export function tilesAround(lat, lon, radiusDeg) {
  const rows = new Set();
  const cols = new Set();
  const latMin = lat - radiusDeg;
  const latMax = lat + radiusDeg;
  for (let r = 0; r < TILE_ROWS; r++) {
    const top = 90 - r * 45;
    const bottom = top - 45;
    if (latMax >= bottom && latMin <= top) rows.add(r);
  }
  const polar = Math.abs(lat) + radiusDeg > 80;
  if (polar) {
    for (let c = 0; c < TILE_COLS; c++) cols.add(c);
  } else {
    const span = radiusDeg / Math.max(0.15, Math.cos(lat * DEG));
    for (let dl = -span; dl <= span + 1e-6; dl += 2) {
      const { x } = latLonToPixel(lat, lon + dl);
      cols.add(Math.floor(x / TILE_PX) % TILE_COLS);
    }
    const { x } = latLonToPixel(lat, lon + span);
    cols.add(Math.floor(x / TILE_PX) % TILE_COLS);
  }
  const list = [];
  for (const r of rows) for (const c of cols) list.push([r, c]);
  return list;
}

/** Draws the listed tiles (all 32 when null) into a 2048 x 1024 canvas. Missing tiles become a flat body colour. */
export async function loadMosaicCanvas(body, tiles = null) {
  const all = !tiles;
  if (all && fullMosaicCache.has(body)) return fullMosaicCache.get(body);
  const list = tiles ?? Array.from({ length: TILE_ROWS * TILE_COLS }, (_, i) => [Math.floor(i / TILE_COLS), i % TILE_COLS]);
  const work = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = MOSAIC_W;
    canvas.height = MOSAIC_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = body === 'moon' ? '#5c5c5c' : '#a0582f';
    ctx.fillRect(0, 0, MOSAIC_W, MOSAIC_H);
    const imgs = await Promise.all(list.map(([r, c]) => loadTile(body, r, c)));
    imgs.forEach((img, i) => {
      if (!img) return;
      const [r, c] = list[i];
      ctx.drawImage(img, c * TILE_PX, r * TILE_PX, TILE_PX, TILE_PX);
    });
    return canvas;
  })();
  if (all) fullMosaicCache.set(body, work);
  return work;
}

/** Tints per body: multiply colour, detail strength, relief scale. */
const BODY_LOOK = {
  mars: { tint: '#c99272', detail: 0.3, grain: 0.16 },
  moon: { tint: '#b4b4b8', detail: 0.34, grain: 0.2 },
};

/**
 * Builds the ground texture for the outpost: an azimuthal-equidistant crop of the real mosaic centred on the site
 * (correct even at the lunar south pole), upsampled and sharpened with procedural regolith detail so the 10 km/px
 * source does not read as a blurry smear. Returns the canvas plus a luminance field for displacement.
 */
export async function buildTerrainTexture(body, site, { size = 512, radiusDeg = 9 } = {}) {
  const lat0 = (site?.lat ?? 0) * DEG;
  const lon0 = site?.lon ?? 0;
  const look = BODY_LOOK[body] ?? BODY_LOOK.mars;
  const tiles = tilesAround(site?.lat ?? 0, lon0, radiusDeg + 1);
  const mosaic = await loadMosaicCanvas(body, tiles);
  const src = mosaic.getContext('2d').getImageData(0, 0, MOSAIC_W, MOSAIC_H).data;

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(size, size);
  const px = img.data;
  const lum = new Float32Array(size * size);
  const tint = hexToRgb(look.tint);
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);

  const sample = (x, y) => {
    // bilinear with horizontal wrap
    const x0 = Math.floor(x);
    const y0 = clamp(Math.floor(y), 0, MOSAIC_H - 1);
    const x1 = (x0 + 1) % MOSAIC_W;
    const y1 = clamp(y0 + 1, 0, MOSAIC_H - 1);
    const fx = x - x0;
    const fy = y - y0;
    const xa = ((x0 % MOSAIC_W) + MOSAIC_W) % MOSAIC_W;
    const i00 = (y0 * MOSAIC_W + xa) * 4;
    const i10 = (y0 * MOSAIC_W + x1) * 4;
    const i01 = (y1 * MOSAIC_W + xa) * 4;
    const i11 = (y1 * MOSAIC_W + x1) * 4;
    const r = lerp(lerp(src[i00], src[i10], fx), lerp(src[i01], src[i11], fx), fy);
    const g = lerp(lerp(src[i00 + 1], src[i10 + 1], fx), lerp(src[i01 + 1], src[i11 + 1], fx), fy);
    const b = lerp(lerp(src[i00 + 2], src[i10 + 2], fx), lerp(src[i01 + 2], src[i11 + 2], fx), fy);
    return [r / 255, g / 255, b / 255];
  };

  let meanLum = 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size - 0.5;
      const v = 0.5 - (j + 0.5) / size;
      const dx = u * 2 * radiusDeg * DEG; // east
      const dy = v * 2 * radiusDeg * DEG; // north
      const rho = Math.hypot(dx, dy);
      let lat;
      let lon;
      if (rho < 1e-9) {
        lat = lat0;
        lon = lon0;
      } else {
        const az = Math.atan2(dx, dy);
        const sinRho = Math.sin(rho);
        const cosRho = Math.cos(rho);
        lat = Math.asin(clamp(sinLat0 * cosRho + cosLat0 * sinRho * Math.cos(az), -1, 1));
        lon = lon0 + Math.atan2(Math.sin(az) * sinRho * cosLat0, cosRho - sinLat0 * Math.sin(lat)) / DEG;
      }
      const p = latLonToPixel(lat / DEG, lon);
      const c = sample(p.x, p.y);
      // Procedural regolith detail: broad patches + fine grain, multiplied so real albedo still dominates.
      const n1 = fbm(i * 0.035 + 7.1, j * 0.035 + 3.3, 4);
      const n2 = fbm(i * 0.11, j * 0.11, 3);
      const n3 = fbm(i * 0.45 + 11, j * 0.45 + 5, 2);
      const grain = hash2(i, j);
      const detail = 1 + (n1 - 0.5) * look.detail * 2 + (n2 - 0.5) * look.detail + (n3 - 0.5) * look.detail * 0.8 + (grain - 0.5) * look.grain;
      const k = j * size + i;
      const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      lum[k] = l;
      meanLum += l;
      const o = k * 4;
      px[o] = clamp(c[0] * tint[0] * 1.05 * detail, 0, 1) * 255;
      px[o + 1] = clamp(c[1] * tint[1] * 1.05 * detail, 0, 1) * 255;
      px[o + 2] = clamp(c[2] * tint[2] * 1.05 * detail, 0, 1) * 255;
      px[o + 3] = 255;
    }
  }
  meanLum /= size * size;
  ctx.putImageData(img, 0, 0);
  return { canvas: out, lum, size, meanLum };
}
