// Hair made of bezier "tufts" (leaf-shaped locks). Each tuft sways with a
// small phase-shifted sine — secondary motion that depends only on `t`.
import { Palette } from '../characters';
import { clamp, lerp, P, Pt, rgba, rng } from './math';
import { bezier, Ctx, ellipse, ink, linear, polyPath, spline, taper, taperEnd, within } from './brush';

export interface Tuft {
  r: Pt; t: Pt; w: number;
  /** bend of the first/second half, as a fraction of length (S-curves when opposite). */
  b: number; b2?: number;
  front: boolean;
  /** 0 base, 1 shadow, 2 streak (grey strands), 3 tip-gradient */
  shade?: number;
  sway?: number;
  ph?: number;
  shine?: boolean;
}

export interface HairStyle {
  cap?: Pt[];
  capAlpha?: number;
  tufts: Tuft[];
  /** y of the glossy highlight ring on the crown */
  ring?: number;
  ringW?: number;
  ribbon?: Pt;
  /** hairline at the centre of the forehead; front cap covers the skull above it */
  hairline?: number;
  /** sway amplitude multiplier */
  softness?: number;
}

const T = (rx: number, ry: number, tx: number, ty: number, w: number, b: number, front: boolean, x: Partial<Tuft> = {}): Tuft =>
  ({ r: P(rx, ry), t: P(tx, ty), w, b, front, ...x });

function shift(p: Pt, yaw: number, depth: number): Pt {
  return P(p.x + yaw * depth, p.y);
}

function tuftShape(tf: Tuft, t: number, wind: number, yaw: number, soft: number): { pts: Pt[]; spine: Pt[] } {
  const depth = tf.front ? 58 : 30;
  const r = shift(tf.r, yaw, depth * 0.8);
  let tip = shift(tf.t, yaw, depth);
  const dx = tip.x - r.x, dy = tip.y - r.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const sw = (tf.sway ?? 1) * soft;
  const ph = tf.ph ?? (tf.r.x * 0.07 + tf.r.y * 0.03);
  const s = Math.sin(t * 1.7 + ph) * 0.5 + Math.sin(t * 0.9 + ph * 1.7) * 0.5;
  const off = (s * 0.035 + wind * 0.08) * L * sw;
  tip = P(tip.x + off, tip.y + Math.abs(off) * 0.2);
  const b1 = tf.b, b2 = tf.b2 ?? tf.b;
  const c1 = P(r.x + dx * 0.33 + nx * b1 * L, r.y + dy * 0.33 + ny * b1 * L);
  const c2 = P(r.x + dx * 0.7 + nx * b2 * L + off * 0.5, r.y + dy * 0.7 + ny * b2 * L);
  const hw = tf.w / 2;
  const left = bezier(P(r.x - nx * hw, r.y - ny * hw), P(c1.x - nx * hw * 0.85, c1.y - ny * hw * 0.85), P(c2.x - nx * hw * 0.4, c2.y - ny * hw * 0.4), tip, 14);
  const right = bezier(tip, P(c2.x + nx * hw * 0.4, c2.y + ny * hw * 0.4), P(c1.x + nx * hw * 0.85, c1.y + ny * hw * 0.85), P(r.x + nx * hw, r.y + ny * hw), 14);
  const spine = bezier(r, c1, c2, tip, 14);
  return { pts: [...left, ...right.slice(1)], spine };
}

function tuftFill(ctx: Ctx, tf: Tuft, pal: Palette, pts: Pt[], spine: Pt[]) {
  const h = pal.hair;
  let fill: string | CanvasGradient = tf.shade === 1 ? h.shadow : tf.shade === 2 ? (h.streak ?? h.highlight) : h.base;
  if (h.tip) {
    const a = spine[0], b = spine[spine.length - 1];
    fill = linear(ctx, a.x, a.y, b.x, b.y, [[0, tf.shade === 1 ? h.shadow : h.base], [0.55, tf.shade === 1 ? h.shadow : h.base], [1, h.tip]]);
  }
  polyPath(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawTuft(ctx: Ctx, tf: Tuft, pal: Palette, t: number, wind: number, yaw: number, soft: number) {
  const { pts, spine } = tuftShape(tf, t, wind, yaw, soft);
  tuftFill(ctx, tf, pal, pts, spine);
  // inner shadow strand down the middle (cel shading)
  if (tf.w > 20) {
    const inner = spine.slice(3).map((p, i, arr) => P(p.x + (tf.w * 0.12) * (1 - i / arr.length), p.y));
    ink(ctx, inner, tf.w * 0.28, rgba(pal.hair.shadow, 0.55), taperEnd);
  }
  if (tf.shine) {
    const n = spine.length;
    ink(ctx, spine.slice(Math.floor(n * 0.12), Math.floor(n * 0.42)), tf.w * 0.32, rgba(pal.hair.highlight, 0.9), taper);
  }
  // outline: both edges, thin at the tip
  // (root third left open so overlapping locks read as one mass)
  const half = Math.floor(pts.length / 2);
  const lw = clamp(tf.w * 0.06, 1.3, 3);
  ink(ctx, pts.slice(Math.floor(half * 0.35), half + 1), lw, pal.line, (u) => 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)));
  ink(ctx, pts.slice(half, pts.length - Math.floor(half * 0.35)), lw, pal.line, (u) => 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, (1 - u) * 0.9 + 0.1)));
}

export function drawHairBack(ctx: Ctx, s: HairStyle, pal: Palette, t: number, wind: number, yaw: number) {
  const soft = s.softness ?? 1;
  if (s.cap && (s.capAlpha ?? 1) >= 1) {
    const cap = spline(s.cap.map((p) => shift(p, yaw, 20)), true, 8);
    within(ctx, () => {
      ctx.globalAlpha = s.capAlpha ?? 1;
      polyPath(ctx, cap);
      ctx.fillStyle = pal.hair.shadow;
      ctx.fill();
      if ((s.capAlpha ?? 1) >= 1) ink(ctx, cap, 3, pal.line, () => 1);
    });
  }
  for (const tf of s.tufts) if (!tf.front) drawTuft(ctx, tf, pal, t, wind, yaw, soft);
  if (s.ribbon) drawRibbon(ctx, shift(s.ribbon, yaw, 20), pal, t);
}

export function drawHairFront(ctx: Ctx, s: HairStyle, pal: Palette, t: number, wind: number, yaw: number) {
  const soft = s.softness ?? 1;
  if (s.cap && s.hairline !== undefined) {
    // front cap: the part of the hair mass that covers the top of the skull
    const hl = s.hairline;
    const cap = spline(s.cap.map((p) => shift(p, yaw, 20)), true, 8);
    within(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-400, -600);
      for (let x = -400; x <= 400; x += 20) ctx.lineTo(x + yaw * 40, hl + Math.pow(Math.min(Math.abs(x), 130) / 100, 2) * 60);
      ctx.lineTo(400, -600);
      ctx.closePath();
      ctx.clip();
      polyPath(ctx, cap);
      ctx.fillStyle = pal.hair.base;
      ctx.fill();
      ink(ctx, cap, 3, pal.line, () => 1);
    });
  }
  for (const tf of s.tufts) if (tf.front) drawTuft(ctx, tf, pal, t, wind, yaw, soft);
  if (s.ring !== undefined) {
    // glossy "angel ring": smooth upper edge, zig-zag lower edge
    const y = s.ring, w = s.ringW ?? 80, n = 8;
    const arc = (x: number) => y + Math.pow(x / w, 2) * 26;
    const pts: Pt[] = [];
    for (let i = 0; i <= 16; i++) { const x = -w + (i / 16) * 2 * w; pts.push(P(x + yaw * 50, arc(x) - 8 + Math.pow(x / w, 4) * 8)); }
    for (let k = 2 * n; k >= 0; k--) {
      const x = -w + (k / (2 * n)) * 2 * w;
      const edge = Math.abs(x) > w * 0.85 ? 0.3 : 1;
      pts.push(P(x + yaw * 50, arc(x) + (k % 2 ? 18 + ((k * 5) % 3) * 4 : 4) * edge));
    }
    within(ctx, () => {
      polyPath(ctx, pts);
      ctx.fillStyle = rgba(pal.hair.highlight, 0.6);
      ctx.fill();
    });
  }
}

/** Shadow the front hair casts on the face (caller sets fillStyle & clip). */
export function drawHairShadow(ctx: Ctx, s: HairStyle, pal: Palette, t: number, wind: number, yaw: number) {
  const soft = s.softness ?? 1;
  for (const tf of s.tufts) {
    if (!tf.front) continue;
    const { pts } = tuftShape({ ...tf, w: tf.w * 1.15 }, t, wind, yaw, soft);
    polyPath(ctx, pts.map((p) => P(p.x + 3, p.y + 15)));
    ctx.fill();
  }
}

function drawRibbon(ctx: Ctx, at: Pt, pal: Palette, t: number) {
  const c = pal.outfit.ribbon ?? '#eee';
  const sh = pal.outfit.blouseShadow ?? '#ccc';
  const sw = Math.sin(t * 1.4) * 4;
  within(ctx, () => {
    ctx.translate(at.x, at.y);
    for (const s of [-1, 1]) {
      const loop = spline([P(0, 0), P(s * 26, -18), P(s * 40, -4), P(s * 28, 12), P(0, 4)], true, 8);
      polyPath(ctx, loop); ctx.fillStyle = c; ctx.fill();
      ink(ctx, loop, 2, pal.line, () => 1);
      const tail = spline([P(0, 4), P(s * 10 + sw, 40), P(s * 16 + sw, 70)], false, 8);
      ink(ctx, tail, 14, c, taperEnd);
    }
    ellipse(ctx, 0, 2, 9, 8, sh);
  });
}

// ─── Generators ─────────────────────────────────────────────────────────────

/** Locks around the outer silhouette of the head, flowing down & outward. */
function crown(o: { cx?: number; cy?: number; rx: number; ry: number; a0: number; a1: number; n: number; len: number; w: number; droop: number; seed: number; jit?: number; bend?: number; shade?: number }): Tuft[] {
  const r = rng(o.seed);
  const out: Tuft[] = [];
  const cx = o.cx ?? 0, cy = o.cy ?? -60;
  for (let i = 0; i < o.n; i++) {
    const a = lerp(o.a0, o.a1, o.n === 1 ? 0.5 : i / (o.n - 1)) + (r() - 0.5) * 0.08;
    const root = P(cx + Math.cos(a) * o.rx * 0.8, cy + Math.sin(a) * o.ry * 0.8);
    let d = Math.PI / 2 - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const ang = a + d * o.droop;
    const len = o.len * (1 + ((o.jit ?? 0.35) * (r() - 0.5)));
    const tip = P(root.x + Math.cos(ang) * len, root.y + Math.sin(ang) * len);
    const side = Math.cos(a) >= 0 ? 1 : -1;
    out.push(T(root.x, root.y, tip.x, tip.y, o.w * (0.85 + r() * 0.3), (o.bend ?? 0.12) * side * (r() > 0.25 ? 1 : -1), false, { shade: o.shade }));
  }
  return out;
}

/** Bangs: locks from the crown down to a tip line. */
function fringe(o: { x0: number; x1: number; n: number; rootY: number; tip: (x: number) => number; w: number; seed: number; lean?: number; part?: number; jit?: number }): Tuft[] {
  const r = rng(o.seed);
  const out: Tuft[] = [];
  const part = o.part ?? 0;
  for (let i = 0; i < o.n; i++) {
    const x = lerp(o.x0, o.x1, i / (o.n - 1)) + (r() - 0.5) * 8;
    const rx = part + (x - part) * 0.45;
    const ry = o.rootY + Math.pow((x - part) / 120, 2) * 30;
    const tx = x + (o.lean ?? 0) + (x - part) * 0.12;
    const ty = o.tip(x) + (r() - 0.5) * (o.jit ?? 16);
    const bend = (x - part) / 400 + (r() - 0.5) * 0.06;
    out.push(T(rx, ry, tx, ty, o.w * (0.85 + r() * 0.3), bend, true, { ph: i * 1.3 }));
  }
  return out;
}

const thin = (tufts: Tuft[], k: number) => tufts.map((t) => ({ ...t, w: t.w * k }));
const shade = (tufts: Tuft[], s: number) => tufts.map((t) => ({ ...t, shade: s }));

// ─── Styles ──────────────────────────────────────────────────────────────────

export const HAIR: Record<string, HairStyle> = {
  nolan: {
    cap: [P(-116, 0), P(-124, -100), P(-96, -172), P(-40, -208), P(30, -210), P(96, -176), P(124, -104), P(118, 0), P(100, 50), P(-100, 50)],
    hairline: -120, ring: -150, ringW: 78,
    tufts: [
      ...crown({ rx: 150, ry: 175, a0: -Math.PI * 1.02, a1: 0.05, n: 13, len: 62, w: 56, droop: 0.45, seed: 11 }),
      ...shade(crown({ rx: 130, ry: 140, a0: Math.PI * 0.62, a1: Math.PI * 0.38, n: 3, len: 70, w: 44, droop: 0.9, seed: 3, cy: 0 }), 1),
      T(-104, -110, -118, 40, 44, 0.04, true, { sway: 0.6 }), T(104, -110, 120, 40, 44, -0.04, true, { sway: 0.6 }),
      ...fringe({ x0: -92, x1: 92, n: 8, rootY: -178, tip: (x) => -22 + Math.abs(x) * 0.12, w: 64, seed: 5, lean: 6 }),
      T(8, -170, 22, 14, 16, 0.12, true),
    ],
  },
  selene: {
    cap: [P(-120, -30), P(-128, -110), P(-92, -182), P(-20, -210), P(52, -206), P(106, -166), P(128, -100), P(126, -20), P(138, 90), P(150, 210), P(140, 300), P(-140, 300), P(-150, 210), P(-140, 90)],
    hairline: -128, ring: -150, ringW: 82,
    ribbon: P(132, 96),
    softness: 1.4,
    tufts: [
      ...crown({ rx: 150, ry: 175, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, n: 9, len: 40, w: 50, droop: 0.6, seed: 21, jit: 0.5 }),
      // long wavy back hair
      ...[-1, 1].flatMap((s) => [0, 1, 2, 3].map((i) => T(s * (120 - i * 6), -40 + i * 60, s * (150 + i * 12), 250 + i * 40, 66, s * 0.14, false, { b2: -s * 0.18, ph: i * 1.7 + s }))),
      ...fringe({ x0: -100, x1: 104, n: 8, rootY: -184, tip: (x) => -24 + Math.abs(x + 10) * 0.12, w: 62, seed: 25, part: -18, lean: 2 }),
      // face framing waves
      T(-92, -112, -116, 250, 52, -0.06, true, { b2: 0.12, sway: 1.2 }),
      T(-78, -110, -96, 170, 30, 0.06, true, { b2: -0.1 }),
      T(92, -112, 122, 262, 52, 0.06, true, { b2: -0.12, sway: 1.2 }),
      T(80, -112, 102, 176, 28, -0.06, true, { b2: 0.1 }),
    ],
  },
  aldric: {
    cap: [P(-114, -20), P(-122, -100), P(-92, -176), P(-30, -206), P(40, -206), P(96, -172), P(122, -100), P(114, -20), P(104, 26), P(-104, 26)],
    hairline: -110, ring: -150, ringW: 70,
    tufts: [
      ...crown({ rx: 148, ry: 170, a0: -Math.PI * 1.0, a1: 0.0, n: 13, len: 50, w: 50, droop: 0.3, seed: 31, jit: 0.6 }),
      ...fringe({ x0: -108, x1: 108, n: 8, rootY: -180, tip: (x) => -52 + Math.abs(x) * 0.25, w: 56, seed: 35, lean: 10, jit: 22 }),
      T(-40, -170, -56, -56, 6, -0.05, true, { shade: 2 }), T(64, -160, 82, -62, 5, 0.1, true, { shade: 2 }),
    ],
  },
  babyJoseph: {
    capAlpha: 0.5,
    softness: 1.5,
    tufts: [
      T(-20, -174, -46, -210, 9, 0.35, false), T(4, -178, 16, -216, 10, -0.45, false), T(28, -174, 56, -202, 9, -0.3, false),
      T(-48, -164, -10, -138, 9, -0.25, true), T(-22, -172, 20, -142, 10, -0.3, true), T(4, -174, 44, -144, 9, -0.3, true),
      T(30, -168, 66, -138, 8, -0.3, true), T(-70, -148, -88, -118, 8, 0.3, true), T(68, -150, 90, -120, 8, -0.3, true),
    ],
  },
  toddlerJoseph: {
    cap: [P(-112, -60), P(-110, -150), P(-60, -204), P(0, -214), P(64, -204), P(110, -150), P(112, -60), P(90, -40), P(-90, -40)],
    hairline: -110, ring: -168, ringW: 60,
    softness: 1.3,
    tufts: [
      ...crown({ rx: 136, ry: 180, cy: -70, a0: -Math.PI * 0.95, a1: -Math.PI * 0.05, n: 9, len: 36, w: 40, droop: 0.4, seed: 41, jit: 0.6 }),
      ...fringe({ x0: -100, x1: 100, n: 7, rootY: -196, tip: (x) => -70 + Math.abs(x) * 0.25, w: 48, seed: 45, lean: 4 }),
    ],
  },
  childJoseph: {
    cap: [P(-120, -10), P(-122, -110), P(-80, -190), P(0, -216), P(80, -192), P(122, -110), P(120, -10), P(100, 40), P(-100, 40)],
    hairline: -110, ring: -160, ringW: 72,
    softness: 1.2,
    tufts: [
      ...crown({ rx: 156, ry: 186, a0: -Math.PI * 1.04, a1: 0.06, n: 14, len: 54, w: 52, droop: 0.4, seed: 51, jit: 0.6 }),
      T(-108, -100, -122, 30, 42, 0.04, true), T(108, -100, 124, 30, 42, -0.04, true),
      ...fringe({ x0: -92, x1: 92, n: 8, rootY: -192, tip: (x) => -30 + Math.abs(x) * 0.2, w: 56, seed: 55, lean: 4 }),
    ],
  },
  babyMira: {
    capAlpha: 0.35,
    softness: 1.6,
    tufts: [
      T(-4, -174, 30, -224, 30, -0.45, true, { b2: 0.35, shade: 3 }),
      T(-28, -168, -58, -198, 16, 0.3, false), T(28, -168, 60, -190, 14, -0.3, false),
      T(-30, -168, 4, -136, 18, -0.35, true), T(10, -170, 40, -140, 14, -0.3, true),
    ],
  },
};
