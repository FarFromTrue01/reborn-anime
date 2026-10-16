// Vector "brush" helpers: smooth Catmull-Rom splines, filled shapes and
// variable-width ink lines (the tapered line weight typical of anime cels).
import { Pt } from './math';

export type Ctx = CanvasRenderingContext2D;

/** Sample a Catmull-Rom spline through `pts`. */
export function spline(pts: Pt[], closed = false, seg = 10): Pt[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const out: Pt[] = [];
  const get = (i: number) => {
    if (closed) return pts[(i + n) % n];
    return pts[Math.max(0, Math.min(n - 1, i))];
  };
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Quadratic/cubic bezier sampled into points (used for hair tufts). */
export function bezier(p0: Pt, c1: Pt, c2: Pt, p3: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    out.push({
      x: m * m * m * p0.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * p3.x,
      y: m * m * m * p0.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * p3.y,
    });
  }
  return out;
}

export function polyPath(ctx: Ctx, pts: Pt[], close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
}

export function fillPoly(ctx: Ctx, pts: Pt[], style: string | CanvasGradient | CanvasPattern) {
  polyPath(ctx, pts);
  ctx.fillStyle = style;
  ctx.fill();
}

/** Smooth closed shape through control points. */
export function blob(ctx: Ctx, pts: Pt[], style: string | CanvasGradient, seg = 8) {
  fillPoly(ctx, spline(pts, true, seg), style);
}

export type Profile = (u: number) => number;
export const taper: Profile = (u) => Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.6;
export const taperEnd: Profile = (u) => Math.pow(1 - u, 0.7);
export const taperStart: Profile = (u) => Math.pow(u, 0.7);
export const flat: Profile = () => 1;
/** Thick in the middle-to-end, like a lash line flicked at the outer corner. */
export const lash: Profile = (u) => (u < 0.85 ? 0.35 + 0.65 * Math.pow(u / 0.85, 0.8) : 1 - (u - 0.85) / 0.15 * 0.85);

/** Variable-width ink line along a polyline. */
export function ink(ctx: Ctx, pts: Pt[], width: number, color: string, profile: Profile = taper) {
  const n = pts.length;
  if (n < 2) return;
  // cumulative length so the profile follows arc length
  const len: number[] = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = len[n - 1] || 1;
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const w = (width * profile(len[i] / total)) / 2;
    L.push({ x: pts[i].x - dy * w, y: pts[i].y + dx * w });
    R.push({ x: pts[i].x + dy * w, y: pts[i].y - dx * w });
  }
  ctx.beginPath();
  ctx.moveTo(L[0].x, L[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i].x, L[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Ink line through control points (spline-smoothed). */
export function inkS(ctx: Ctx, ctrl: Pt[], width: number, color: string, profile: Profile = taper) {
  ink(ctx, spline(ctrl, false, 10), width, color, profile);
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, style: string | CanvasGradient, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = style;
  ctx.fill();
}

export function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Run `fn` with ctx state saved/restored. */
export function within(ctx: Ctx, fn: () => void) {
  ctx.save();
  try {
    fn();
  } finally {
    ctx.restore();
  }
}

/** Clip to a polygon, then run fn. */
export function clipTo(ctx: Ctx, pts: Pt[], fn: () => void) {
  ctx.save();
  polyPath(ctx, pts);
  ctx.clip();
  fn();
  ctx.restore();
}
