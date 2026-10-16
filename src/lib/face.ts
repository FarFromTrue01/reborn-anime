// Procedural anime head: big expressive eyes with highlights, two-tone cel
// shading, tapered outlines. Coordinates are in "head units": the face is
// 200 units wide (cheek to cheek), eye line at y=0. Callers translate/scale.
import { Palette } from '../characters';
import { clamp, lerp, mix, P, Pt, rgba } from './math';
import { Ctx, ellipse, ink, inkS, lash, linear, polyPath, radial, spline, taper, taperEnd, within } from './brush';
import { HairStyle, drawHairBack, drawHairFront, drawHairShadow } from './hair';

export type Build = 'man' | 'woman' | 'baby' | 'toddler' | 'child';

export interface Proportions {
  eyeX: number; eyeY: number; eyeW: number; eyeH: number; iris: number;
  cheekX: number; jawX: number; jawY: number; chinY: number; chinW: number;
  crownY: number; mouthY: number; noseY: number; browY: number; neckW: number; neckLen: number;
  lashStyle: 'm' | 'f' | 'b';
}

export const PROPORTIONS: Record<Build, Proportions> = {
  man:     { eyeX: 47, eyeY: 0,  eyeW: 60, eyeH: 32, iris: 0.92, cheekX: 100, jawX: 80, jawY: 112, chinY: 170, chinW: 26, crownY: -185, mouthY: 116, noseY: 66, browY: -34, neckW: 44, neckLen: 120, lashStyle: 'm' },
  woman:   { eyeX: 48, eyeY: 2,  eyeW: 64, eyeH: 50, iris: 1.0,  cheekX: 98,  jawX: 68, jawY: 102, chinY: 156, chinW: 14, crownY: -180, mouthY: 106, noseY: 60, browY: -38, neckW: 34, neckLen: 120, lashStyle: 'f' },
  baby:    { eyeX: 52, eyeY: 26, eyeW: 62, eyeH: 62, iris: 1.12, cheekX: 114, jawX: 94, jawY: 98, chinY: 126, chinW: 30, crownY: -180, mouthY: 96,  noseY: 66, browY: -14, neckW: 50, neckLen: 30,  lashStyle: 'b' },
  toddler: { eyeX: 51, eyeY: 24, eyeW: 62, eyeH: 60, iris: 1.1,  cheekX: 106, jawX: 86, jawY: 98,  chinY: 136, chinW: 34, crownY: -180, mouthY: 100, noseY: 66, browY: -20, neckW: 42, neckLen: 50,  lashStyle: 'b' },
  child:   { eyeX: 50, eyeY: 16, eyeW: 62, eyeH: 56, iris: 1.06, cheekX: 102, jawX: 80, jawY: 104, chinY: 144, chinW: 26, crownY: -190, mouthY: 104, noseY: 64, browY: -26, neckW: 36, neckLen: 80,  lashStyle: 'b' },
};

export type MouthShape = 'line' | 'smile' | 'open' | 'o' | 'cry' | 'hum' | 'flat';

export interface Expression {
  open: number;        // eyelid openness 0..1 (blink = 0)
  lookX: number;       // -1..1
  lookY: number;       // -1..1
  brow: number;        // -1 frown .. 1 raised
  worry: number;       // 0..1 inner brows up
  mouth: MouthShape;
  mouthOpen: number;   // 0..1
  smile: number;       // -1..1 corner curve
  happy: number;       // 0..1 closed ^ ^ eyes
  squeeze: number;     // 0..1 crying-scrunched eyes ( > < )
  blush: number;       // 0..1
  tears: number;       // 0..1
  lidHeavy: number;    // 0..1 tired upper lids
  pupil: number;       // pupil scale (shock = small)
  sparkle: number;     // extra highlight intensity
}

export const neutral = (o: Partial<Expression> = {}): Expression => ({
  open: 1, lookX: 0, lookY: 0, brow: 0, worry: 0, mouth: 'line', mouthOpen: 0, smile: 0,
  happy: 0, squeeze: 0, blush: 0.25, tears: 0, lidHeavy: 0, pupil: 1, sparkle: 1, ...o,
});

export interface Light {
  /** -1 = light from the viewer's left, +1 = from the right. */
  x: number;
  /** colour tint washed over the lit side (e.g. monitor blue), optional. */
  tint?: string;
  tintAmount?: number;
  /** rim light colour along the lit silhouette. */
  rim?: string;
  rimAmount?: number;
  /** extra darkening of the shadow side (0..1). */
  contrast?: number;
}

export interface HeadOptions {
  pal: Palette;
  build: Build;
  hair: HairStyle;
  expr: Expression;
  yaw?: number;      // -0.6..0.6
  light?: Light;
  t?: number;        // seconds, for secondary motion
  wind?: number;
  /** draws clothing between neck and face (in head units). */
  body?: () => void;
  stubble?: boolean;
  /** skip the neck (e.g. swaddled newborn). */
  noNeck?: boolean;
}

/** Cylindrical projection: rotate a point on the face surface by yaw. */
function cyl(x: number, yaw: number, R = 108) {
  const a = Math.asin(clamp(x / R, -0.999, 0.999)) + yaw * 0.55;
  return R * Math.sin(clamp(a, -Math.PI / 2, Math.PI / 2));
}
function cylScale(x: number, yaw: number, R = 108) {
  const a0 = Math.asin(clamp(x / R, -0.999, 0.999));
  return Math.max(0.25, Math.cos(clamp(a0 + yaw * 0.55, -1.5, 1.5)) / Math.max(0.3, Math.cos(a0)));
}

export function faceOutline(pr: Proportions, yaw: number): Pt[] {
  const { cheekX, jawX, jawY, chinY, chinW } = pr;
  // right half, top → chin; mirrored for left half
  const half = [
    P(cheekX * 0.99, -70), P(cheekX * (pr.lashStyle === 'b' ? 1.02 : 1), -20), P(cheekX * (pr.lashStyle === 'b' ? 1.03 : 0.98), 30),
    P(lerp(cheekX, jawX, 0.55), jawY * 0.75), P(jawX, jawY), P(lerp(jawX, chinW, 0.55), lerp(jawY, chinY, 0.7)), P(chinW, chinY - 4),
  ];
  const right = half.map((p) => P(cyl(p.x, yaw), p.y));
  const left = half.map((p) => P(cyl(-p.x, yaw), p.y)).reverse();
  // skull: an elliptical arc from temple to temple over the crown
  const cy0 = -70, ry = cy0 - pr.crownY, rx = cheekX * 0.99;
  const top: Pt[] = [];
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    top.push(P(cyl(Math.cos(a) * rx, yaw), cy0 + Math.sin(a) * ry));
  }
  const chin = P(cyl(0, yaw, 125), chinY);
  return spline([...top, ...right, chin, ...left], true, 8);
}

function drawEye(
  ctx: Ctx, pr: Proportions, pal: Palette, e: Expression, side: 1 | -1, yaw: number, lightX: number,
) {
  // side: +1 = eye on the viewer's right
  const cx = cyl(side * pr.eyeX, yaw);
  const sc = cylScale(side * pr.eyeX, yaw);
  const w = pr.eyeW * sc;
  const h = pr.eyeH;
  const style = pr.lashStyle;
  within(ctx, () => {
    ctx.translate(cx, pr.eyeY);
    ctx.scale(side, 1); // +x points to the outer corner
    const lineC = pal.eyes.lash;

    // closed variants ---------------------------------------------------
    if (e.squeeze > 0.5) {
      // > < scrunched crying eyes
      inkS(ctx, [P(-w * 0.45, -h * 0.25), P(w * 0.05, h * 0.05), P(w * 0.45, h * 0.18)], h * 0.22, lineC, taper);
      inkS(ctx, [P(-w * 0.4, h * 0.25), P(w * 0.1, h * 0.12), P(w * 0.4, h * 0.28)], h * 0.12, lineC, taper);
      return;
    }
    if (e.happy > 0.5) {
      inkS(ctx, [P(-w * 0.45, h * 0.18), P(-w * 0.05, -h * 0.28), P(w * 0.45, h * 0.12)], h * 0.2, lineC, taper);
      return;
    }
    const o = clamp(e.open);
    if (o < 0.12) {
      // relaxed closed lid with lashes
      const pts = spline([P(-w * 0.5, h * 0.1), P(-w * 0.1, h * 0.32), P(w * 0.3, h * 0.28), P(w * 0.52, h * 0.08)], false, 10);
      ink(ctx, pts, Math.max(3, h * 0.16), lineC, lash);
      if (style !== 'm') {
        for (let i = 0; i < 3; i++) {
          const x = w * (0.1 + i * 0.15);
          inkS(ctx, [P(x, h * 0.3), P(x + w * 0.04, h * 0.42), P(x + w * 0.09, h * 0.48)], 2.4, lineC, taperEnd);
        }
      }
      return;
    }

    // lid geometry --------------------------------------------------------
    const lift = style === 'f' ? -0.2 : style === 'm' ? -0.08 : -0.05;
    const top0 = style === 'b' ? -0.55 : -0.5;
    const closedY = h * 0.3;
    const heavy = e.lidHeavy * 0.35;
    const oo = o * (1 - heavy);
    const upCtl = [
      P(-w * 0.5, h * 0.08),
      P(-w * 0.28, lerp(closedY, h * (top0 + 0.06), oo)),
      P(w * 0.05, lerp(closedY, h * top0, oo)),
      P(w * 0.32, lerp(closedY, h * (top0 + 0.12 + lift * 0.3), oo)),
      P(w * 0.52, h * (lift + 0.02)),
    ];
    const loCtl = [P(w * 0.52, h * (lift + 0.02)), P(w * 0.3, h * 0.46), P(-w * 0.1, h * 0.52), P(-w * 0.5, h * 0.08)];
    const upper = spline(upCtl, false, 10);
    const lower = spline(loCtl, false, 10);
    const white = [...upper, ...lower.slice(1)];

    // white + inner shadow
    ctx.save();
    polyPath(ctx, white);
    ctx.clip();
    ctx.fillStyle = '#fbf7f4';
    ctx.fillRect(-w, -h * 1.2, w * 2, h * 2.4);
    ctx.fillStyle = linear(ctx, 0, -h * 0.5, 0, h * 0.3, [[0, '#cbbfd0'], [0.55, '#e9e1e8'], [1, 'rgba(251,247,244,0)']]);
    ctx.fillRect(-w, -h * 1.2, w * 2, h * 1.6);

    // iris
    const ir = pr.iris;
    const ix = e.lookX * w * 0.17 * side; // look direction is in screen space
    const iy = h * 0.06 + e.lookY * h * 0.1;
    const rx = w * 0.3 * ir;
    const ry = h * 0.48 * ir * (style === 'm' ? 1.15 : 1);
    ellipse(ctx, ix, iy, rx, ry, linear(ctx, 0, iy - ry, 0, iy + ry, [[0, pal.eyes.dark], [0.45, pal.eyes.iris], [1, pal.eyes.light]]));
    // iris inner ring + pupil
    ctx.lineWidth = Math.max(1.2, rx * 0.09);
    ctx.strokeStyle = rgba(pal.eyes.dark, 0.85);
    ctx.beginPath();
    ctx.ellipse(ix, iy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ellipse(ctx, ix, iy + ry * 0.05, rx * 0.45 * e.pupil, ry * 0.5 * e.pupil, rgba(pal.eyes.dark, 0.95));
    // lower iris glow (the typical anime "light pool")
    ellipse(ctx, ix, iy + ry * 0.55, rx * 0.62, ry * 0.3, rgba(pal.eyes.light, 0.55));
    // lid shadow cast onto the eye
    ctx.fillStyle = 'rgba(40,20,30,0.28)';
    polyPath(ctx, [...upper, ...upper.slice().reverse().map((p) => P(p.x, p.y + h * 0.2))]);
    ctx.fill();
    // highlights (always on the light side in screen space)
    const hs = (lightX <= 0 ? -1 : 1) * side;
    const sp = e.sparkle;
    ellipse(ctx, ix + hs * rx * 0.38, iy - ry * 0.38, rx * 0.3, ry * 0.24, `rgba(255,255,255,${0.95 * Math.min(1, sp)})`, -0.4 * hs);
    ellipse(ctx, ix - hs * rx * 0.35, iy + ry * 0.35, rx * 0.13, rx * 0.13, `rgba(255,255,255,${0.85 * Math.min(1, sp)})`);
    if (sp > 1) ellipse(ctx, ix + hs * rx * 0.05, iy + ry * 0.05, rx * 0.08, rx * 0.08, `rgba(255,255,255,${(sp - 1) * 0.8})`);
    ctx.restore();

    // lash line + crease ---------------------------------------------------
    const lw = style === 'm' ? h * 0.2 : style === 'f' ? h * 0.2 : h * 0.15;
    ink(ctx, upper, lw, lineC, lash);
    if (style === 'f') {
      // little flicks at the outer corner
      const oc = upper[upper.length - 1];
      inkS(ctx, [oc, P(oc.x + w * 0.1, oc.y - h * 0.12), P(oc.x + w * 0.16, oc.y - h * 0.3)], h * 0.12, lineC, taperEnd);
      inkS(ctx, [P(oc.x - w * 0.08, oc.y - h * 0.04), P(oc.x + w * 0.04, oc.y - h * 0.24), P(oc.x + w * 0.06, oc.y - h * 0.4)], h * 0.09, lineC, taperEnd);
    }
    // crease
    const crease = upper.slice(Math.floor(upper.length * 0.25)).map((p) => P(p.x, p.y - h * (style === 'm' ? 0.28 : 0.22) - (1 - oo) * h * 0.05));
    ink(ctx, crease, Math.max(1.4, h * 0.05), rgba(pal.line, 0.75), taper);
    // lower lash
    const lowerPart = lower.slice(0, Math.floor(lower.length * 0.6));
    ink(ctx, lowerPart, Math.max(1.6, h * 0.06), rgba(lineC, 0.85), taperEnd);
  });
}

function drawBrow(ctx: Ctx, pr: Proportions, pal: Palette, e: Expression, side: 1 | -1, yaw: number, thick: number) {
  const ix = cyl(side * (pr.eyeX - pr.eyeW * 0.42), yaw);
  const ox = cyl(side * (pr.eyeX + pr.eyeW * 0.55), yaw);
  const mx = cyl(side * (pr.eyeX + pr.eyeW * 0.1), yaw);
  const y = pr.browY - e.brow * 9;
  const iy = y + 4 - e.worry * 13 + Math.max(0, -e.brow) * 8;
  const oy = y + 2 + e.worry * 5;
  inkS(ctx, [P(ix, iy), P(mx, y - 5 - e.worry * 2), P(ox, oy)], thick, pal.hair.shadow, (u) => (u < 0.3 ? 0.6 + u : Math.pow(1 - u, 0.5) * 1.1));
}

function drawMouth(ctx: Ctx, pr: Proportions, pal: Palette, e: Expression, yaw: number) {
  const cx = cyl(0, yaw, 118);
  const y = pr.mouthY;
  const W = pr.lashStyle === 'b' ? 15 : 18;
  const s = e.smile;
  const line = pal.line;
  const lipC = mix(pal.skin.shadow, '#c25a5a', 0.35);
  switch (e.mouth) {
    case 'line':
    case 'flat':
      inkS(ctx, [P(cx - W, y - s * 4), P(cx, y + s * 3), P(cx + W, y - s * 4)], 3.2, line, taper);
      break;
    case 'smile':
      inkS(ctx, [P(cx - W * 1.2, y - 5 * s), P(cx - W * 0.4, y + 4 * s), P(cx + W * 0.5, y + 4 * s), P(cx + W * 1.2, y - 5 * s)], 3.6, line, taper);
      break;
    case 'hum':
      // soft smile with a tiny opening — humming the lullaby
      ellipse(ctx, cx, y + 2, W * 0.28, 1 + e.mouthOpen * 4, mix(lipC, '#7a3038', 0.5));
      inkS(ctx, [P(cx - W, y - 2 - s * 4), P(cx - W * 0.4, y + 1 + s * 2), P(cx + W * 0.4, y + 1 + s * 2), P(cx + W, y - 2 - s * 4)], 2.6, line, taper);
      break;
    case 'o': {
      const r = 6 + e.mouthOpen * 9;
      ellipse(ctx, cx, y + r * 0.4, r * 0.8, r, '#5c1f26');
      ellipse(ctx, cx, y + r * 0.95, r * 0.55, r * 0.35, '#c8636a');
      ctx.lineWidth = 2.4; ctx.strokeStyle = line;
      ctx.beginPath(); ctx.ellipse(cx, y + r * 0.4, r * 0.8, r, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'open': {
      const mw = W * (1.0 + e.mouthOpen * 0.2);
      const mh = 16 * e.mouthOpen + 4;
      const pts = spline([
        P(cx - mw, y - s * 2), P(cx - mw * 0.5, y - 3), P(cx + mw * 0.5, y - 3), P(cx + mw, y - s * 2),
        P(cx + mw * 0.6, y + mh * 0.7), P(cx, y + mh), P(cx - mw * 0.6, y + mh * 0.7),
      ], true, 8);
      polyPath(ctx, pts);
      ctx.fillStyle = '#5a1c24';
      ctx.fill();
      ctx.save();
      polyPath(ctx, pts);
      ctx.clip();
      ellipse(ctx, cx, y + mh, mw * 0.75, mh * 0.45, '#d06c72');
      ctx.restore();
      ink(ctx, spline([P(cx - mw, y - 2), P(cx, y - 4), P(cx + mw, y - 2)], false, 8), 3, line, taper);
      break;
    }
    case 'cry': {
      // wailing "waah" mouth: narrow on top, wide at the bottom, corners pulled down
      const mw = W * 1.45;
      const mh = 40 * e.mouthOpen + 6;
      const pts = spline([
        P(cx - mw * 0.55, y + 4), P(cx, y - 6), P(cx + mw * 0.55, y + 4),
        P(cx + mw, y + mh * 0.75), P(cx + mw * 0.6, y + mh), P(cx - mw * 0.6, y + mh), P(cx - mw, y + mh * 0.75),
      ], true, 8);
      polyPath(ctx, pts);
      ctx.fillStyle = '#5a1c24';
      ctx.fill();
      ctx.save();
      polyPath(ctx, pts);
      ctx.clip();
      ellipse(ctx, cx, y + mh * 1.05, mw * 0.7, mh * 0.42, '#d06c72');
      ctx.restore();
      ink(ctx, [...pts, pts[0]], 3.2, line, () => 1);
      break;
    }
  }
}

export function drawHead(ctx: Ctx, o: HeadOptions) {
  const pr = PROPORTIONS[o.build];
  const pal = o.pal;
  const e = o.expr;
  const yaw = o.yaw ?? 0;
  const L: Light = { x: -0.6, contrast: 0, ...(o.light ?? {}) };
  const t = o.t ?? 0;
  const outline = faceOutline(pr, yaw);

  // back hair
  drawHairBack(ctx, o.hair, pal, t, o.wind ?? 0, yaw);

  // neck
  if (!o.noNeck) {
    const nw = pr.neckW;
    const nx = cyl(0, yaw, 140) * 0.6;
    const neck = [P(nx - nw, pr.jawY), P(nx - nw * 1.02, pr.chinY + pr.neckLen * 0.6), P(nx - nw * 1.25, pr.chinY + pr.neckLen), P(nx + nw * 1.25, pr.chinY + pr.neckLen), P(nx + nw * 1.02, pr.chinY + pr.neckLen * 0.6), P(nx + nw, pr.jawY)];
    polyPath(ctx, neck);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();
    ctx.save();
    polyPath(ctx, neck);
    ctx.clip();
    // chin shadow on neck
    ctx.fillStyle = pal.skin.shadow;
    polyPath(ctx, [P(nx - nw * 2, pr.jawY - 10), P(nx - nw * 2, pr.chinY + 18), P(nx, pr.chinY + 34), P(nx + nw * 2, pr.chinY + 18), P(nx + nw * 2, pr.jawY - 10)]);
    ctx.fill();
    // side shadow
    ctx.fillRect(L.x <= 0 ? nx + nw * 0.45 : nx - nw * 2, pr.jawY, nw * 1.6, 400);
    ctx.restore();
    ink(ctx, [P(nx - nw, pr.jawY + 20), P(nx - nw * 1.02, pr.chinY + pr.neckLen * 0.6), P(nx - nw * 1.2, pr.chinY + pr.neckLen * 0.95)], 3, pal.line, taper);
    ink(ctx, [P(nx + nw, pr.jawY + 20), P(nx + nw * 1.02, pr.chinY + pr.neckLen * 0.6), P(nx + nw * 1.2, pr.chinY + pr.neckLen * 0.95)], 3, pal.line, taper);
  }
  o.body?.();

  // ears (near-side ear grows with yaw)
  for (const s of [-1, 1] as const) {
    const vis = 1 - clamp(s * -yaw * 1.6);
    if (vis < 0.15) continue;
    const ex = cyl(s * pr.cheekX * 0.985, yaw) + s * 4;
    const ey = pr.eyeY + 18;
    const ew = 20 * vis, eh = 36;
    const ear = spline([P(ex - s * 4, ey - eh * 0.6), P(ex + s * ew, ey - eh * 0.55), P(ex + s * ew * 1.1, ey), P(ex + s * ew * 0.4, ey + eh * 0.6), P(ex - s * 6, ey + eh * 0.5)], true, 8);
    polyPath(ctx, ear);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();
    ctx.fillStyle = pal.skin.shadow;
    ellipse(ctx, ex + s * ew * 0.35, ey, ew * 0.35, eh * 0.35, pal.skin.shadow);
    ink(ctx, ear.slice(2, ear.length - 4), 2.6, pal.line, taper);
  }

  // face fill + cel shading
  polyPath(ctx, outline);
  ctx.fillStyle = pal.skin.base;
  ctx.fill();
  ctx.save();
  polyPath(ctx, outline);
  ctx.clip();
  // shadow side: everything outside a lit ellipse shifted toward the light
  ctx.beginPath();
  ctx.rect(-400, -400, 800, 800);
  ctx.ellipse(cyl(0, yaw) + L.x * 24, -30, pr.cheekX * 1.04, pr.chinY + (pr.lashStyle === 'b' ? 50 : 14), 0, 0, Math.PI * 2);
  ctx.fillStyle = pal.skin.shadow;
  ctx.fill('evenodd');
  // sparse baby hair: a soft tone over the scalp
  if (o.hair.capAlpha !== undefined && o.hair.capAlpha < 1) {
    ctx.fillStyle = linear(ctx, 0, pr.crownY, 0, -60, [[0, rgba(pal.hair.tip ?? pal.hair.base, o.hair.capAlpha)], [1, rgba(pal.hair.base, 0)]]);
    ctx.fillRect(-300, pr.crownY - 20, 600, pr.crownY * -1);
  }
  // hair shadow cast on forehead
  ctx.fillStyle = pal.skin.shadow;
  drawHairShadow(ctx, o.hair, pal, t, o.wind ?? 0, yaw);
  // nose side shadow
  const nx = cyl(0, yaw, 135);
  ctx.fillStyle = rgba(pal.skin.shadow, 0.9);
  polyPath(ctx, spline([P(nx - L.x * 2, pr.noseY - 26), P(nx - L.x * 9, pr.noseY - 2), P(nx - L.x * 3, pr.noseY + 4)], false, 6).concat([P(nx, pr.noseY + 2)]));
  ctx.fill();
  // soft blush
  if (e.blush > 0) {
    for (const s of [-1, 1]) {
      const bx = cyl(s * (pr.eyeX + 8), yaw);
      const by = pr.eyeY + pr.eyeH * 0.9 + 14;
      ellipse(ctx, bx, by, 30, 15, radial(ctx, bx, by, 30, [[0, rgba(pal.skin.blush, 0.55 * e.blush)], [1, rgba(pal.skin.blush, 0)]]));
      if (e.blush > 0.55) {
        for (let i = 0; i < 3; i++) inkS(ctx, [P(bx - 12 + i * 9, by + 4), P(bx - 6 + i * 9, by - 5)], 1.8, rgba('#d2706a', (e.blush - 0.5) * 1.6), taper);
      }
    }
  }
  if (o.stubble) {
    const sx = cyl(0, yaw, 118);
    ctx.fillStyle = rgba(pal.outfit.stubble ?? pal.hair.base, 0.2);
    polyPath(ctx, spline([P(-pr.cheekX, 40), P(-pr.jawX * 0.95, pr.jawY), P(sx, pr.chinY + 10), P(pr.jawX * 0.95, pr.jawY), P(pr.cheekX, 40), P(sx + 40, pr.mouthY - 22), P(sx, pr.mouthY - 14), P(sx - 40, pr.mouthY - 22)], true, 8));
    ctx.fill();
  }
  ctx.restore();

  // outline: thin at the temples, heavier along the jaw
  const n = outline.length;
  if (o.hair.capAlpha !== undefined && o.hair.capAlpha < 1) {
    ink(ctx, [...outline, outline[0], outline[1]], 4, pal.line, (u) => 0.55 + 0.45 * Math.sin(Math.PI * u));
  } else {
    const startI = Math.floor(n * 0.08);
    const endI = Math.floor(n * 0.92);
    ink(ctx, outline.slice(startI, endI), 4.2, pal.line, (u) => 0.35 + 0.65 * Math.sin(Math.PI * u) ** 0.5);
  }

  if (o.stubble) {
    // weathered: smile lines and a crease under the eyes
    const mx = cyl(0, yaw, 118);
    for (const s of [-1, 1]) {
      inkS(ctx, [P(mx + s * 28, pr.noseY + 14), P(mx + s * 36, pr.noseY + 32), P(mx + s * 36, pr.mouthY - 4)], 2, rgba(pal.line, 0.22), taper);
    }
  }
  // features
  drawMouth(ctx, pr, pal, e, yaw);
  // nose tick
  inkS(ctx, [P(nx - L.x * 2, pr.noseY - 4), P(nx + 1, pr.noseY + 3), P(nx + 6 * -L.x, pr.noseY + 2)], 2.6, rgba(pal.line, 0.85), taper);
  drawEye(ctx, pr, pal, e, -1, yaw, L.x);
  drawEye(ctx, pr, pal, e, 1, yaw, L.x);
  const browThick = o.build === 'man' ? 6.5 : o.build === 'woman' ? 4.2 : 3.5;
  drawBrow(ctx, pr, pal, e, -1, yaw, browThick);
  drawBrow(ctx, pr, pal, e, 1, yaw, browThick);

  // tears: streams running from the outer corners
  if (e.tears > 0) {
    for (const s of [-1, 1]) {
      const tx = cyl(s * (pr.eyeX + pr.eyeW * 0.32), yaw);
      const ty = pr.eyeY + pr.eyeH * 0.25;
      const len = 40 + 70 * e.tears;
      const stream = spline([P(tx, ty), P(tx + s * 10, ty + len * 0.4), P(tx + s * 6, ty + len)], false, 8);
      ink(ctx, stream, 13, `rgba(170,215,255,${0.8 * Math.min(1, e.tears)})`, (u) => 0.6 + 0.4 * Math.sin(Math.PI * u));
      ink(ctx, stream.slice(2, 9).map((p) => P(p.x - s * 2, p.y)), 3.5, `rgba(255,255,255,${0.85 * Math.min(1, e.tears)})`, taper);
      ellipse(ctx, tx + s * 6, ty + len + 6, 6, 8, `rgba(170,215,255,${0.85 * Math.min(1, e.tears)})`);
    }
  }

  drawHairFront(ctx, o.hair, pal, t, o.wind ?? 0, yaw);

  // light tint & rim (source-atop affects only what's already in this layer)
  if (L.tint && (L.tintAmount ?? 0) > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = linear(ctx, L.x * 200, 0, -L.x * 200, 0, [[0, rgba(L.tint, L.tintAmount!)], [1, rgba(L.tint, L.tintAmount! * 0.25)]]);
    ctx.fillRect(-600, -600, 1200, 1400);
    ctx.restore();
  }
  if (L.rim && (L.rimAmount ?? 0) > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const side = L.x <= 0 ? -1 : 1;
    const pts = outline.filter((p) => p.x * side > cyl(0, yaw) * side + 40 && p.y > pr.eyeY - 40);
    ink(ctx, pts, 7, rgba(L.rim, L.rimAmount!), taper);
    ctx.restore();
  }
}
