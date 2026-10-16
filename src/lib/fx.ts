// Atmosphere & post effects. Everything is a pure function of t / frame index.
import { W, H } from '../config';
import { clamp, hash, lerp, rgba, rng } from './math';
import { Ctx, ellipse, linear, radial, within } from './brush';

// ── Offscreen layers ─────────────────────────────────────────────────────────

let renderScale = 1;
export const setRenderScale = (q: number) => (renderScale = q);
export const getRenderScale = () => renderScale;

const pool = new Map<string, HTMLCanvasElement>();
function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** A cleared, film-coordinate layer (1920x1080 logical) at the current render scale. */
export function layer(name: string, like?: Ctx): Ctx {
  const q = renderScale;
  let c = pool.get(name);
  if (!c || c.width !== Math.round(W * q) || c.height !== Math.round(H * q)) {
    c = makeCanvas(W * q, H * q);
    pool.set(name, c);
  }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.clearRect(0, 0, c.width, c.height);
  if (like) ctx.setTransform(like.getTransform());
  else ctx.setTransform(q, 0, 0, q, 0, 0);
  return ctx;
}

let filterOK: boolean | null = null;
function supportsFilter(): boolean {
  if (filterOK !== null) return filterOK;
  const c = makeCanvas(4, 4).getContext('2d')!;
  filterOK = typeof c.filter === 'string';
  if (filterOK) {
    c.filter = 'blur(2px)';
    filterOK = c.filter === 'blur(2px)';
  }
  return filterOK;
}

/**
 * Composite `src` (a layer) onto `dst`, blurred by `radius` film pixels.
 * Uses downsampling (+ ctx.filter where available) so it is cheap and also
 * works on browsers without canvas filters.
 */
export function composite(dst: Ctx, src: Ctx, radius = 0, alpha = 1, op: GlobalCompositeOperation = 'source-over') {
  const q = renderScale;
  within(dst, () => {
    dst.setTransform(1, 0, 0, 1, 0, 0);
    dst.globalAlpha = alpha;
    dst.globalCompositeOperation = op;
    const sc = src.canvas;
    if (radius < 0.6) {
      dst.drawImage(sc, 0, 0);
      return;
    }
    const d = radius > 14 ? 4 : radius > 5 ? 2 : 1;
    const key = `__blur${d}`;
    let small = pool.get(key);
    const sw = Math.ceil(sc.width / d), sh = Math.ceil(sc.height / d);
    if (!small || small.width !== sw || small.height !== sh) {
      small = makeCanvas(sw, sh);
      pool.set(key, small);
    }
    const s = small.getContext('2d')!;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, sw, sh);
    if (supportsFilter()) s.filter = `blur(${(radius * q) / d}px)`;
    s.imageSmoothingQuality = 'high';
    s.drawImage(sc, 0, 0, sw, sh);
    s.filter = 'none';
    dst.imageSmoothingEnabled = true;
    dst.imageSmoothingQuality = 'high';
    dst.drawImage(small, 0, 0, sc.width, sc.height);
  });
}

// ── Atmosphere ───────────────────────────────────────────────────────────────

export interface RainOpts {
  count: number; speed: number; len: number; angle: number; alpha: number; width?: number;
  color?: string; seed?: number; area?: [number, number, number, number];
}
/** Rain streaks; `clock` may be warped (slow motion / freeze). */
export function rain(ctx: Ctx, clock: number, o: RainOpts) {
  const [ax, ay, aw, ah] = o.area ?? [-100, -100, W + 200, H + 200];
  const seed = o.seed ?? 1;
  const dx = Math.sin(o.angle), dy = Math.cos(o.angle);
  ctx.lineCap = 'round';
  for (let i = 0; i < o.count; i++) {
    const r1 = hash(i, seed), r2 = hash(i, seed + 7), r3 = hash(i, seed + 13);
    const depth = 0.4 + r3 * 0.8;
    const sp = o.speed * depth;
    const travel = (r2 * ah + clock * sp) % (ah + o.len);
    const y = ay + travel - o.len;
    const x = ax + ((r1 * aw + travel * dx / Math.max(0.2, dy)) % aw);
    const l = o.len * depth;
    ctx.strokeStyle = rgba(o.color ?? '#cfe0ff', o.alpha * (0.35 + depth * 0.5));
    ctx.lineWidth = (o.width ?? 1.6) * depth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * l, y + dy * l);
    ctx.stroke();
  }
}

/** Frozen raindrops (slow-motion beads) */
export function rainBeads(ctx: Ctx, clock: number, count: number, seed: number, alpha: number, stretch = 1) {
  for (let i = 0; i < count; i++) {
    const x = hash(i, seed) * W;
    const y = ((hash(i, seed + 3) * (H + 200) + clock * (300 + hash(i, seed + 9) * 300)) % (H + 200)) - 100;
    const r = 1.5 + hash(i, seed + 5) * 3.5;
    ellipse(ctx, x, y, r * 0.7, r * stretch, rgba('#e8f1ff', alpha * (0.4 + hash(i, seed + 11) * 0.6)));
    ellipse(ctx, x - r * 0.2, y - r * 0.3 * stretch, r * 0.25, r * 0.3, rgba('#ffffff', alpha));
  }
}

export interface Bokeh { x: number; y: number; r: number; c: string; a: number }
export function bokehField(seed: number, n: number, colors: string[], area: [number, number, number, number], rMin: number, rMax: number): Bokeh[] {
  const r = rng(seed);
  const [x, y, w, h] = area;
  return Array.from({ length: n }, () => ({
    x: x + r() * w, y: y + r() * h, r: lerp(rMin, rMax, r() * r()), c: colors[Math.floor(r() * colors.length)], a: 0.25 + r() * 0.55,
  }));
}
export function drawBokeh(ctx: Ctx, items: Bokeh[], t: number, alpha = 1, drift = 0) {
  within(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    items.forEach((b, i) => {
      const tw = 0.75 + 0.25 * Math.sin(t * (0.6 + (i % 5) * 0.21) + i);
      const x = b.x + Math.sin(t * 0.2 + i) * drift;
      const g = radial(ctx, x, b.y, b.r, [[0, rgba(b.c, b.a * alpha * tw * 0.55)], [0.75, rgba(b.c, b.a * alpha * tw * 0.4)], [0.92, rgba(b.c, b.a * alpha * tw * 0.6)], [1, rgba(b.c, 0)]]);
      ellipse(ctx, x, b.y, b.r, b.r, g);
    });
  });
}

/** God rays from a point. */
export function rays(ctx: Ctx, ox: number, oy: number, angle: number, spread: number, n: number, len: number, color: string, alpha: number, t: number, seed = 3) {
  within(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = angle + (hash(i, seed) - 0.5) * spread;
      const w = 0.02 + hash(i, seed + 1) * 0.06;
      const flick = 0.6 + 0.4 * Math.sin(t * (0.3 + hash(i, seed + 2) * 0.5) + i * 2.1);
      const l = len * (0.7 + hash(i, seed + 4) * 0.5);
      const g = linear(ctx, ox, oy, ox + Math.cos(a) * l, oy + Math.sin(a) * l, [[0, rgba(color, alpha * flick)], [1, rgba(color, 0)]]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a - w) * l, oy + Math.sin(a - w) * l);
      ctx.lineTo(ox + Math.cos(a + w) * l, oy + Math.sin(a + w) * l);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Floating dust motes catching light. */
export function dust(ctx: Ctx, t: number, n: number, color: string, alpha: number, seed = 9, area: [number, number, number, number] = [0, 0, W, H], size = 1) {
  const [ax, ay, aw, ah] = area;
  within(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const sp = 6 + hash(i, seed) * 14;
      const x = ax + ((hash(i, seed + 1) * aw + Math.sin(t * 0.3 + i) * 30 + t * sp * 0.6) % aw);
      const y = ay + ((hash(i, seed + 2) * ah - t * sp * 0.4 + Math.cos(t * 0.27 + i * 1.3) * 20) % ah + ah) % ah;
      const r = (1 + hash(i, seed + 3) * 3.5) * size;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
      ellipse(ctx, x, y, r * 2.5, r * 2.5, radial(ctx, x, y, r * 2.5, [[0, rgba(color, alpha * tw)], [1, rgba(color, 0)]]));
    }
  });
}

// ── Post ─────────────────────────────────────────────────────────────────────

const grainTiles: HTMLCanvasElement[] = [];
function grainTile(i: number) {
  if (!grainTiles.length) {
    for (let k = 0; k < 6; k++) {
      const c = makeCanvas(256, 256);
      const g = c.getContext('2d')!;
      const img = g.createImageData(256, 256);
      const r = rng(1000 + k);
      for (let p = 0; p < img.data.length; p += 4) {
        const v = Math.floor(128 + (r() + r() + r() - 1.5) * 120);
        img.data[p] = img.data[p + 1] = img.data[p + 2] = clamp(v, 0, 255);
        img.data[p + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainTiles.push(c);
    }
  }
  return grainTiles[i % grainTiles.length];
}

export function grain(ctx: Ctx, frame: number, amount: number) {
  if (amount <= 0) return;
  within(ctx, () => {
    const tile = grainTile(frame);
    const pat = ctx.createPattern(tile, 'repeat')!;
    const ox = hash(frame, 77) * 256, oy = hash(frame, 78) * 256;
    ctx.translate(-ox, -oy);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W + 256, H + 256);
  });
}

export function vignette(ctx: Ctx, strength: number, color = '#000') {
  within(ctx, () => {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, strength));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
}

/** 2.39:1 cinema bars. */
export const BAR = (H - W / 2.39) / 2;
export function letterbox(ctx: Ctx, amount = 1) {
  const h = BAR * amount;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, h);
  ctx.fillRect(0, H - h, W, h);
}

export function wash(ctx: Ctx, color: string, alpha: number, op: GlobalCompositeOperation = 'source-over') {
  if (alpha <= 0) return;
  within(ctx, () => {
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = rgba(color, alpha);
    ctx.fillRect(0, 0, W, H);
  });
}

/** Simple camera: zoom about a focus point plus pan & roll. */
export interface Cam { x: number; y: number; zoom: number; rot: number }
export function applyCam(ctx: Ctx, c: Cam, shakeT = 0, shake = 0) {
  const sx = shake ? (Math.sin(shakeT * 37) + Math.sin(shakeT * 23.3)) * shake : 0;
  const sy = shake ? (Math.cos(shakeT * 31) + Math.sin(shakeT * 19.7)) * shake : 0;
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.rotate(c.rot);
  ctx.scale(c.zoom, c.zoom);
  ctx.translate(-c.x, -c.y);
}
