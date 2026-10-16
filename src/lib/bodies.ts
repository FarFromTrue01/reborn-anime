// Clothing / busts, drawn in the same head-unit space as face.ts
// (face = 200 units wide, eye line at y = 0, neck base ≈ y 260-290).
import { characters } from '../characters';
import { P, Pt, rgba } from './math';
import { blob, Ctx, ellipse, fillPoly, ink, inkS, linear, polyPath, spline, taper, taperEnd, within } from './brush';

const sh = (ctx: Ctx, pts: Pt[], fill: string | CanvasGradient, line: string, lw = 4, closed = true) => {
  const s = spline(pts, closed, 8);
  fillPoly(ctx, s, fill);
  if (lw > 0) ink(ctx, closed ? [...s, s[0]] : s, lw, line, () => 1);
  return s;
};

/** Shade the part of `shape` right of x0 (or left if dir<0) with a curved edge. */
function celSide(ctx: Ctx, shape: Pt[], x0: number, dir: 1 | -1, color: string) {
  within(ctx, () => {
    polyPath(ctx, shape);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, -400);
    ctx.bezierCurveTo(x0 + dir * 70, 200, x0 - dir * 50, 600, x0 + dir * 60, 1400);
    ctx.lineTo(x0 + dir * 2000, 1400);
    ctx.lineTo(x0 + dir * 2000, -400);
    ctx.closePath();
    ctx.fill();
  });
}

export function nolanBody(ctx: Ctx, lightX = -1) {
  const o = characters.nolan.outfit;
  const line = characters.nolan.line;
  const d: 1 | -1 = lightX <= 0 ? 1 : -1;
  // shirt
  const shirt = sh(ctx, [P(-160, 250), P(160, 250), P(190, 900), P(-190, 900)], o.shirt, line, 0);
  celSide(ctx, shirt, 30 * d, d, o.shirtShadow);
  // open collar V with skin
  fillPoly(ctx, spline([P(-46, 230), P(-20, 300), P(0, 340), P(20, 300), P(46, 230)], false, 8), characters.nolan.skin.base);
  fillPoly(ctx, [P(-30, 250), P(0, 330), P(30, 250)], rgba(characters.nolan.skin.shadow, 0.8));
  // loosened tie: knot sits low, blade swings slightly
  const knot = [P(-26, 330), P(26, 326), P(16, 372), P(-14, 374)];
  sh(ctx, knot, o.tie, line, 3);
  const blade = sh(ctx, [P(-14, 372), P(16, 370), P(40, 560), P(28, 760), P(4, 800), P(-12, 760), P(-20, 560)], o.tie, line, 3);
  celSide(ctx, blade, 10, 1, '#12162a');
  inkS(ctx, [P(-6, 400), P(6, 560), P(2, 740)], 3, rgba(o.tieLight, 0.7), taper);
  // collar wings
  for (const s of [-1, 1]) {
    const c = sh(ctx, [P(s * 44, 215), P(s * 98, 262), P(s * 74, 312), P(s * 26, 336)], o.shirt, line, 3);
    if (s === d) celSide(ctx, c, s * 40, d, o.shirtShadow);
  }
  // jacket panels
  for (const s of [-1, 1] as const) {
    const panel = [P(s * 70, 236), P(s * 200, 262), P(s * 330, 340), P(s * 370, 520), P(s * 380, 900), P(s * 40, 900), P(s * 34, 640), P(s * 60, 420), P(s * 100, 330)];
    const pts = sh(ctx, panel, o.suit, line, 4.5);
    if (s === d) celSide(ctx, pts, s * 200, d, o.suitShadow);
    else celSide(ctx, pts, s * 320, s, o.suitShadow);
    // lapel
    const lap = sh(ctx, [P(s * 72, 240), P(s * 122, 300), P(s * 104, 336), P(s * 150, 352), P(s * 70, 560), P(s * 52, 430), P(s * 96, 330)], s === d ? o.suitShadow : o.suit, line, 3);
    void lap;
    inkS(ctx, [P(s * 230, 280), P(s * 300, 330), P(s * 330, 420)], 5, rgba(o.suitLight, s === d ? 0 : 0.7), taper);
  }
  // pocket square line, buttons
  ellipse(ctx, 50, 760, 7, 7, '#0e1120');
}

export function seleneBody(ctx: Ctx, lightX = -1, t = 0) {
  const o = characters.selene.outfit;
  const line = characters.selene.line;
  const d: 1 | -1 = lightX <= 0 ? 1 : -1;
  // puffed sleeves
  for (const s of [-1, 1] as const) {
    const sl = sh(ctx, [P(s * 150, 248), P(s * 232, 258), P(s * 276, 330), P(s * 284, 470), P(s * 262, 600), P(s * 196, 600), P(s * 166, 420)], o.blouse, line, 4);
    if (s === d) celSide(ctx, sl, s * 250, d, o.blouseShadow);
    for (let i = 0; i < 3; i++) inkS(ctx, [P(s * (196 + i * 24), 290), P(s * (206 + i * 26), 420), P(s * (200 + i * 24), 560)], 2.4, rgba(o.blouseShadow, 0.9), taper);
  }
  // blouse body
  const bl = sh(ctx, [P(-170, 250), P(170, 250), P(200, 900), P(-200, 900)], o.blouse, line, 0);
  celSide(ctx, bl, 60 * d, d, o.blouseShadow);
  // neckline skin + frill
  const neck = spline([P(-120, 252), P(-90, 330), P(0, 362), P(90, 330), P(120, 252)], false, 10);
  fillPoly(ctx, [P(-130, 220), ...neck, P(130, 220)], characters.selene.skin.base);
  for (let i = 0; i < neck.length - 1; i += 3) {
    const p = neck[i];
    ellipse(ctx, p.x, p.y + 4, 9, 6, o.blouse);
  }
  ink(ctx, neck.map((p) => P(p.x, p.y + 8)), 2.5, line, () => 1);
  // collarbones
  inkS(ctx, [P(-80, 296), P(-40, 304), P(-14, 300)], 2.2, rgba(characters.selene.skin.deep, 0.6), taper);
  inkS(ctx, [P(80, 296), P(40, 304), P(14, 300)], 2.2, rgba(characters.selene.skin.deep, 0.6), taper);
  // laced bodice
  const bod = sh(ctx, [P(-150, 420), P(-60, 400), P(0, 420), P(60, 400), P(150, 420), P(170, 900), P(-170, 900)], o.bodice, line, 4);
  celSide(ctx, bod, 50 * d, d, o.bodiceShadow);
  for (let i = 0; i < 6; i++) {
    const y = 450 + i * 70;
    inkS(ctx, [P(-26, y), P(0, y + 30), P(26, y)], 3, o.lace, taper);
    inkS(ctx, [P(26, y), P(0, y + 30), P(-26, y)], 3, rgba('#7a5340', 0.8), taper);
  }
  // little bow at the top lace
  inkS(ctx, [P(0, 430), P(-18, 452), P(-10, 478)], 3, o.lace, taperEnd);
  inkS(ctx, [P(0, 430), P(18, 452), P(12, 482)], 3, o.lace, taperEnd);
  void t;
}

export function aldricBody(ctx: Ctx, lightX = -1) {
  const o = characters.aldric.outfit;
  const line = characters.aldric.line;
  const skin = characters.aldric.skin;
  const d: 1 | -1 = lightX <= 0 ? 1 : -1;
  // shirt with rolled sleeves (bust) — broad shoulders
  const shirt = sh(ctx, [P(-80, 238), P(-250, 270), P(-380, 360), P(-400, 900), P(400, 900), P(380, 360), P(250, 270), P(80, 238)], o.shirt, line, 4.5);
  celSide(ctx, shirt, 140 * d, d, o.shirtShadow);
  // open neck with chest
  fillPoly(ctx, spline([P(-60, 236), P(-34, 330), P(0, 400), P(34, 330), P(60, 236)], false, 8), skin.base);
  fillPoly(ctx, [P(-30, 280), P(0, 390), P(14, 300)], rgba(skin.shadow, 0.8));
  for (const s of [-1, 1] as const) {
    sh(ctx, [P(s * 58, 226), P(s * 120, 270), P(s * 90, 330), P(s * 36, 380)], o.shirt, line, 3);
    // vest panel
    const v = sh(ctx, [P(s * 110, 300), P(s * 250, 300), P(s * 330, 380), P(s * 340, 900), P(s * 80, 900), P(s * 60, 560)], o.vest, line, 4.5);
    celSide(ctx, v, s * (s === d ? 140 : 300), s === d ? d : s, o.vestShadow);
    // worn texture strokes
    for (let i = 0; i < 6; i++) {
      const x = s * (130 + ((i * 53) % 170)), y = 420 + ((i * 97) % 420);
      inkS(ctx, [P(x, y), P(x + 14, y + 4)], 3, rgba(o.vestLight, 0.6), taper);
    }
    // stitched patch
    if (s === -1) {
      const pa = sh(ctx, [P(-250, 560), P(-150, 548), P(-146, 650), P(-246, 660)], o.vestLight, line, 2.5);
      for (let k = 0; k < 8; k++) inkS(ctx, [P(-246 + k * 12, 556 - k * 1.2), P(-240 + k * 12, 566 - k * 1.2)], 1.6, '#2a1a12', () => 1);
      void pa;
    }
  }
}

export function childBody(ctx: Ctx, lightX = -1) {
  const o = characters.joseph.outfit;
  const line = characters.joseph.line;
  const d: 1 | -1 = lightX <= 0 ? 1 : -1;
  const tunic = sh(ctx, [P(-60, 200), P(-190, 230), P(-280, 330), P(-290, 900), P(290, 900), P(280, 330), P(190, 230), P(60, 200)], o.tunic, line, 4);
  celSide(ctx, tunic, 80 * d, d, o.tunicShadow);
  // round neckline with drawstring
  fillPoly(ctx, spline([P(-62, 196), P(-50, 250), P(0, 272), P(50, 250), P(62, 196)], false, 8), characters.joseph.skin.base);
  ink(ctx, spline([P(-64, 200), P(-52, 254), P(0, 278), P(52, 254), P(64, 200)], false, 8), 3, line, () => 1);
  inkS(ctx, [P(0, 278), P(-14, 310), P(-8, 350)], 2.6, '#6b4a35', taperEnd);
  inkS(ctx, [P(0, 278), P(12, 312), P(16, 344)], 2.6, '#6b4a35', taperEnd);
  // patches with stitches
  const patches: [number, number, string][] = [[-170, 520, o.patch], [150, 640, o.patch2]];
  for (const [x, y, c] of patches) {
    sh(ctx, [P(x - 50, y - 40), P(x + 46, y - 46), P(x + 52, y + 44), P(x - 44, y + 50)], c, line, 2);
    for (let k = 0; k < 7; k++) inkS(ctx, [P(x - 46 + k * 15, y - 42), P(x - 42 + k * 15, y - 32)], 1.5, '#3a2a1e', () => 1);
  }
  // fabric wear specks
  for (let i = 0; i < 40; i++) {
    const x = -260 + ((i * 131) % 520), y = 300 + ((i * 89) % 560);
    ellipse(ctx, x, y, 4, 3, rgba(o.tunicShadow, 0.5));
  }
}

/** Swaddling blanket around a baby head (head units). */
export function swaddle(ctx: Ctx, key: 'joseph' | 'mira', t = 0, wiggle = 0) {
  const pal = characters[key];
  const o = pal.outfit as Record<string, string>;
  const line = pal.line;
  const w = Math.sin(t * 9) * wiggle;
  // hood: a soft frame of blanket behind the head
  const hood = sh(ctx, [P(-150, 90), P(-200, -40), P(-170, -170), P(-60, -230), P(60, -230), P(170, -170), P(200, -40), P(150, 90)], o.blanket, line, 4);
  celSide(ctx, hood, 90, 1, o.blanketShadow);
  inkS(ctx, [P(-160, -120), P(-120, -190), P(-40, -214)], 3, rgba(o.blanketShadow, 1), taper);
  const body = sh(ctx, [P(-170, 80), P(-230, 240), P(-210, 520), P(0, 620), P(210, 520), P(230, 240), P(170, 80), P(0, 170)], o.blanket, line, 4);
  celSide(ctx, body, 60, 1, o.blanketShadow);
  // folds
  inkS(ctx, [P(-180, 200), P(-60, 300), P(80, 330), P(200, 280)], 3, rgba(o.blanketShadow, 1), taper);
  inkS(ctx, [P(-200, 360), P(-40, 450), P(150, 440)], 3, rgba(o.blanketShadow, 1), taper);
  void 0;
  if (o.trim) ink(ctx, spline([P(-170, 120), P(0, 190), P(170, 120)], false, 8), 10, o.trim, taper);
  void w;
}

/** Tiny baby hand (fist / open) in local units ~ 1 = 1px at scale 1. */
export function babyHand(ctx: Ctx, key: 'joseph' | 'mira' | 'nolan' | 'selene' | 'aldric', open: number, curl = 0, adult = false) {
  const pal = characters[key];
  if (adult) ctx.scale(0.9, 1.25);
  const line = pal.line;
  // palm
  const palm = spline([P(-34, 30), P(-40, -10), P(-20, -36), P(20, -36), P(40, -10), P(34, 30), P(0, 44)], true, 8);
  fillPoly(ctx, palm, pal.skin.base);
  ink(ctx, [...palm.slice(0, 18)], 3, line, taper);
  // fingers
  for (let i = 0; i < 4; i++) {
    const x = -24 + i * 16;
    const len = (i === 1 || i === 2 ? 38 : 32) * (0.45 + open * 0.55);
    const bend = (1 - open) * 18 + curl * 6;
    const f = spline([P(x, -26), P(x + (i - 1.5) * 3, -26 - len * 0.6), P(x + (i - 1.5) * 4 + bend * 0.3, -26 - len)], false, 6);
    ink(ctx, f, 15, pal.skin.base, () => 1);
    ink(ctx, f.map((p) => P(p.x + 7, p.y)), 2.4, rgba(line, 0.8), taperEnd);
    ellipse(ctx, f[f.length - 1].x, f[f.length - 1].y, 7.5, 7, pal.skin.base);
  }
  // thumb
  const th = spline([P(-34, 6), P(-56, -8 - open * 10), P(-62, -26 - open * 8)], false, 6);
  ink(ctx, th, 17, pal.skin.base, () => 1);
  ellipse(ctx, th[th.length - 1].x, th[th.length - 1].y, 8, 8, pal.skin.base);
  ink(ctx, th.map((p) => P(p.x - 7, p.y)), 2.4, rgba(line, 0.8), taperEnd);
  // soft shading + wrist / sleeve cuff
  fillPoly(ctx, spline([P(-30, 34), P(-34, 120), P(34, 120), P(30, 34), P(0, 44)], true, 6), pal.skin.base);
  if (!adult) {
    fillPoly(ctx, spline([P(-46, 70), P(-50, 200), P(50, 200), P(46, 70), P(0, 84)], true, 6), (pal.outfit as Record<string, string>).blanket ?? '#efe3cc');
    ink(ctx, spline([P(-46, 70), P(0, 84), P(46, 70)], false, 6), 3, rgba(line, 0.7), taper);
  }
}

/** Simple full-figure walker for wide shots (Nolan in the rain). */
export function walker(ctx: Ctx, phase: number, scale: number, holdPhone = true) {
  // backlit by street lamps: read as a near-silhouette
  const o = { suit: '#151b2c', suitShadow: '#0c101b', shirt: '#7d8aa3', tie: '#0c101b' };
  const hair = { base: '#16110f' };
  const skin = { base: '#6d6670', shadow: '#4a4652' };
  const line = '#05070c';
  within(ctx, () => {
    ctx.scale(scale, scale);
    const sw = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 4;
    ctx.translate(0, -bob);
    // legs
    for (const s of [-1, 1]) {
      const a = s * sw * 0.35;
      within(ctx, () => {
        ctx.translate(s * 12, 150);
        ctx.rotate(a);
        sh(ctx, [P(-15, 0), P(15, 0), P(13, 170), P(-11, 170)], s > 0 ? o.suit : o.suitShadow, line, 2);
        sh(ctx, [P(-12, 168), P(16, 168), P(30, 182), P(-12, 184)], '#151010', line, 1.5);
      });
    }
    // torso / jacket
    sh(ctx, [P(-38, 20), P(38, 20), P(44, 160), P(-44, 160)], o.suit, line, 2);
    fillPoly(ctx, [P(-10, 20), P(10, 20), P(0, 70)], o.shirt);
    fillPoly(ctx, [P(-4, 26), P(4, 26), P(2, 90), P(-2, 90)], o.tie);
    // arms
    within(ctx, () => {
      ctx.translate(-36, 30);
      ctx.rotate(-sw * 0.3);
      sh(ctx, [P(-10, 0), P(10, 0), P(8, 120), P(-8, 120)], o.suitShadow, line, 2);
      ellipse(ctx, 0, 124, 8, 9, skin.shadow);
    });
    within(ctx, () => {
      ctx.translate(36, 30);
      if (holdPhone) {
        ctx.rotate(-0.9);
        sh(ctx, [P(-10, 0), P(10, 0), P(8, 70), P(-8, 70)], o.suit, line, 2);
        ctx.translate(0, 70);
        ctx.rotate(1.6);
        sh(ctx, [P(-8, 0), P(8, 0), P(7, 50), P(-7, 50)], o.suit, line, 2);
        ellipse(ctx, 0, 54, 8, 9, skin.base);
        // phone glow
        fillPoly(ctx, [P(-9, 50), P(9, 50), P(9, 68), P(-9, 68)], '#9fd0ff');
      } else {
        ctx.rotate(sw * 0.3);
        sh(ctx, [P(-10, 0), P(10, 0), P(8, 120), P(-8, 120)], o.suit, line, 2);
        ellipse(ctx, 0, 124, 8, 9, skin.base);
      }
    });
    // head
    ellipse(ctx, 2, -12, 28, 32, skin.base);
    blob(ctx, [P(-30, -18), P(-26, -44), P(0, -54), P(28, -44), P(32, -16), P(18, -26), P(0, -30), P(-18, -24)], hair.base);
  });
}

/** Adult hand seen from the back: tapered fingers, slim palm (local units, fingers point up). */
export function adultHand(ctx: Ctx, key: 'selene' | 'aldric' | 'nolan', spread: number, big = 1, curl = 0) {
  const pal = characters[key];
  const line = pal.line;
  const skin = pal.skin.base;
  ctx.scale(big, big);
  const fingers = [0, 1, 2, 3].map((i) => {
    const x = -24 + i * 16;
    const len = [56, 66, 62, 48][i] * (1 - curl * 0.35);
    const a = (i - 1.5) * 0.12 * spread;
    const bend = (i - 1.5) * 4 + curl * 10;
    const base = P(x, -40);
    const tip = P(x + Math.sin(a) * len + bend * 0.2, -40 - Math.cos(a) * len);
    const mid = P((base.x + tip.x) / 2 + bend * 0.4, (base.y + tip.y) / 2);
    return { pts: spline([base, mid, tip], false, 8), w: [15, 16, 15.5, 13.5][i], tip };
  });
  const th = spline([P(-30, 4), P(-54, -10), P(-66, -34 - spread * 6)], false, 8);
  const capsule = (pts: Pt[], w: number, c: string, pad: number) => {
    ink(ctx, pts, w + pad, c, (u) => 1 - u * 0.22);
    const e = pts[pts.length - 1];
    ellipse(ctx, e.x, e.y, (w + pad) * 0.39, (w + pad) * 0.39, c);
  };
  // outlines first, then fills on top, so the silhouette reads as one shape
  for (const f of fingers) capsule(f.pts, f.w, line, 5);
  capsule(th, 18, line, 5);
  const palm = spline([P(-34, 34), P(-38, -6), P(-32, -42), P(32, -44), P(36, -10), P(32, 34), P(0, 42)], true, 8);
  polyPath(ctx, palm);
  ctx.lineWidth = 5;
  ctx.strokeStyle = line;
  ctx.stroke();
  for (const f of fingers) capsule(f.pts, f.w, skin, 0);
  capsule(th, 18, skin, 0);
  polyPath(ctx, palm);
  ctx.fillStyle = skin;
  ctx.fill();
  // cel shadow on one side + knuckle creases + nails
  within(ctx, () => {
    polyPath(ctx, palm);
    ctx.clip();
    ellipse(ctx, 40, 10, 22, 60, rgba(pal.skin.shadow, 0.8));
  });
  for (const f of fingers) {
    const k = f.pts[Math.floor(f.pts.length * 0.45)];
    inkS(ctx, [P(k.x - 4, k.y), P(k.x + 4, k.y + 1)], 1.6, rgba(line, 0.5), taper);
    ellipse(ctx, f.tip.x, f.tip.y + 3, f.w * 0.26, f.w * 0.3, rgba('#ffffff', 0.35));
  }
}

export { linear };
