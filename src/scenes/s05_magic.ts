// 0:41–0:49 — ~1 year old. Joseph sees Selene's green healing magic and,
// for an instant, a translucent status panel above her: this world has levels.
import type { Scene, Clock } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { keys } from '../timeline';
import { characters } from '../characters';
import { Ctx, ellipse, fillPoly, ink, inkS, linear, radial, spline, taper, taperEnd, within } from '../lib/brush';
import { composite, dust, layer, rays, wash } from '../lib/fx';
import { clamp, easeOut, hash, noise1, P, rgba, smooth } from '../lib/math';
import { neutral } from '../lib/face';
import { adultHand as hand, childBody, seleneBody } from '../lib/bodies';
import { blink, breath, drawChar } from './common';
import { cottageWall, WARM } from './elonth';

const GREEN = '#7dffb0';
const GREEN_DEEP = '#2fd27a';
const PANEL = '#8fe8ff';

const st = { glow: 0, push: 1, eyes: 0, panel: 0 };
keys(st, 'glow', [[CUE.magic, 0], [CUE.magic + 0.8, 1, 'power2.out'], [CUE.panelOff + 0.4, 1], [CUE.mira, 0.3]]);
keys(st, 'push', [[CUE.magic, 1.12], [CUE.josephEyes, 1.0, 'sine.out'], [CUE.josephEyes, 1.0], [CUE.status, 1.08, 'none'], [CUE.status, 1.0], [CUE.mira, 1.05, 'none']]);
keys(st, 'eyes', [[CUE.josephEyes + 0.3, 0], [CUE.josephEyes + 0.8, 1, 'back.out(2)']]);

function sigil(ctx: Ctx, cx: number, cy: number, r: number, t: number, a: number) {
  within(ctx, () => {
    ctx.translate(cx, cy);
    ctx.scale(1, 0.38);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(GREEN, 0.9 * a);
    ctx.lineWidth = 4;
    for (const rr of [r, r * 0.82, r * 0.5]) {
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.rotate(t * 0.6);
    // six-point star + runes
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const ang = (i * 2 * Math.PI * 2) / 6;
      const x = Math.cos(ang) * r * 0.8, y = Math.sin(ang) * r * 0.8;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(ang) * r * 0.91, Math.sin(ang) * r * 0.91);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = rgba(GREEN, 0.85 * a);
      const k = Math.floor(hash(i, 4) * 3);
      if (k === 0) ctx.fillRect(-6, -10, 3, 20);
      if (k <= 1) ctx.fillRect(-2, -10, 10, 3);
      ctx.fillRect(2, k === 2 ? -10 : 2, 3, 10);
      ctx.restore();
    }
  });
  // glow pool
  within(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    ellipse(ctx, cx, cy, r * 1.6, r * 1.6, radial(ctx, cx, cy, r * 1.6, [[0, rgba(GREEN, 0.45 * a)], [0.5, rgba(GREEN_DEEP, 0.15 * a)], [1, 'rgba(0,0,0,0)']]));
  });
}

function motes(ctx: Ctx, cx: number, cy: number, r: number, t: number, a: number, n = 70) {
  within(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const life = 2.2 + hash(i, 1) * 1.5;
      const ph = ((t + hash(i, 2) * life) % life) / life;
      const ang = hash(i, 3) * Math.PI * 2 + t * (0.8 + hash(i, 5));
      const rr = r * (0.2 + hash(i, 6) * 0.9) * (1 - ph * 0.5);
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr * 0.38 - ph * r * 1.6;
      const s = (2 + hash(i, 7) * 4) * (1 - ph);
      const al = a * Math.sin(Math.PI * ph);
      ellipse(ctx, x, y, s * 3, s * 3, radial(ctx, x, y, s * 3, [[0, rgba('#eafff2', al)], [0.4, rgba(GREEN, al * 0.6)], [1, 'rgba(0,0,0,0)']]));
    }
  });
}

function handsShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  const g = st.glow * (0.9 + noise1(t * 4, 3) * 0.1);
  within(ctx, () => {
    const z = st.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    const bg = layer('bg');
    cottageWall(bg, t);
    composite(ctx, bg, 24);
    wash(ctx, '#2a1a10', 0.45);
    // table
    fillPoly(ctx, [P(-100, 700), P(W + 100, 660), P(W + 100, H + 100), P(-100, H + 100)], '#4a2e1a');
    for (let i = 0; i < 6; i++) inkS(ctx, [P(-100, 730 + i * 60), P(W + 100, 690 + i * 64)], 3, rgba('#2a1a10', 0.6), () => 1);
    sigil(ctx, 980, 740, 360, t, g);
    // forearm (local: hand fingers point to -y, arm runs toward +y)
    const arm = (key: 'aldric' | 'selene', len: number, sleeve: string) => {
      const pal = characters[key];
      const sk = spline([P(-34, 20), P(-46, len * 0.5), P(-50, len), P(50, len), P(46, len * 0.5), P(34, 20)], false, 6);
      fillPoly(ctx, sk, pal.skin.base);
      ink(ctx, sk.slice(0, Math.floor(sk.length / 2)), 4.5, pal.line, () => 1);
      ink(ctx, sk.slice(Math.ceil(sk.length / 2)), 4.5, pal.line, () => 1);
      ellipse(ctx, 26, len * 0.5, 18, len * 0.4, rgba(pal.skin.shadow, 0.7));
      const sl = spline([P(-66, len * 0.62), P(0, len * 0.58), P(66, len * 0.62), P(80, len + 300), P(-80, len + 300)], true, 6);
      fillPoly(ctx, sl, sleeve);
      ink(ctx, [...sl, sl[0]], 4.5, pal.line, () => 1);
      inkS(ctx, [P(-60, len * 0.7), P(0, len * 0.66), P(60, len * 0.7)], 3, rgba(pal.line, 0.5), taper);
    };
    // Aldric's hand resting on the table, from the left
    within(ctx, () => {
      ctx.translate(900, 720);
      ctx.rotate(Math.PI / 2 + 0.08);
      ctx.scale(2.5, 2.5);
      arm('aldric', 260, characters.aldric.outfit.shirt);
      hand(ctx, 'aldric', 0.25, 1.12, 0.15);
    });
    // Selene's hands hovering above it, palms down, from the upper right
    for (const [x, y, r, sc] of [[1000, 400, -2.45, 2.25], [1180, 450, -2.25, 2.15]] as const) {
      within(ctx, () => {
        ctx.translate(x + Math.sin(t * 1.3 + x) * 6, y + Math.cos(t * 1.1 + x) * 5);
        ctx.rotate(r);
        ctx.scale(sc, sc);
        arm('selene', 240, characters.selene.outfit.blouse);
        hand(ctx, 'selene', 0.9, 1, 0.1);
      });
    }
    // green light on everything near the spell
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = radial(ctx, 980, 600, 700, [[0, rgba(GREEN_DEEP, 0.35 * g)], [1, 'rgba(0,0,0,0)']]);
      ctx.fillRect(0, 0, W, H);
    });
    rays(ctx, 980, 700, -Math.PI / 2, 1.4, 12, 700, GREEN, 0.16 * g, t, 9);
    motes(ctx, 980, 720, 340, t, g, 90);
  });
}

function eyesShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  const e = st.eyes;
  within(ctx, () => {
    const z = st.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    const bg = layer('bg');
    cottageWall(bg, t);
    composite(ctx, bg, 30);
    wash(ctx, '#20140c', 0.35);
    // green bokeh from the spell off-screen right
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const x = 1400 + hash(i, 3) * 600, y = 200 + hash(i, 4) * 600, r = 30 + hash(i, 5) * 60;
        ellipse(ctx, x, y, r, r, radial(ctx, x, y, r, [[0, rgba(GREEN, 0.25)], [1, 'rgba(0,0,0,0)']]));
      }
    });
    const ch = layer('char');
    drawChar(ch, {
      key: 'joseph', build: 'toddler', hair: 'toddlerJoseph', x: 860, y: 470, s: 2.6, rot: -0.04, t, yaw: 0.12,
      expr: neutral({
        open: blink(t, [CUE.josephEyes + 0.15]), lookX: 0.6, lookY: 0.05, brow: e * 0.9, pupil: 1 - e * 0.25,
        mouth: e > 0.5 ? 'o' : 'line', mouthOpen: e * 0.5, sparkle: 1 + e * 0.9, blush: 0.5,
      }),
      light: { x: 1, tint: GREEN_DEEP, tintAmount: 0.07 + e * 0.06, rim: GREEN, rimAmount: 0.7 + e * 0.3 },
      body: (cx) => childBody(cx, 1),
      breathe: breath(t, 0.4) * 0.008,
    });
    composite(ctx, ch, 0);
    // the green glow reflected in his black eyes
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const ex of [-51, 51]) {
        const x = 860 + (ex + 14) * 2.6, y = 470 + 30 * 2.6;
        ellipse(ctx, x, y, 16, 12, radial(ctx, x, y, 16, [[0, rgba(GREEN, 0.75 * e)], [1, 'rgba(0,0,0,0)']]));
      }
    });
    dust(ctx, t, 30, GREEN, 0.35 * e, 13, [1100, 150, 800, 800]);
  });
}

/** Translucent, game-like status window. */
function statusPanel(ctx: Ctx, x: number, y: number, t: number) {
  const on = smooth(CUE.panelOn, CUE.panelOn + 0.35, t) * (1 - smooth(CUE.panelOff - 0.2, CUE.panelOff + 0.1, t));
  if (on <= 0) return;
  // flicker on appear/disappear
  const flick = (t < CUE.panelOn + 0.4 || t > CUE.panelOff - 0.25) ? (hash(Math.floor(t * 30), 3) > 0.35 ? 1 : 0.25) : 1;
  const a = on * flick;
  const w = 520, h = 330;
  const sx = 0.85 + 0.15 * easeOut(on);
  within(ctx, () => {
    ctx.translate(x, y);
    ctx.scale(sx, sx);
    const glitch = t > CUE.panelOff - 0.25 ? (hash(Math.floor(t * 40), 9) - 0.5) * 30 : 0;
    ctx.translate(glitch, 0);
    ctx.globalAlpha = a;
    // glass
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 'rgba(40,90,130,0.55)'], [1, 'rgba(20,50,90,0.45)']]);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = rgba(PANEL, 0.95);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(0, 0, w, h);
    // corner brackets
    ctx.lineWidth = 6;
    for (const [cx, cy, dx, dy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * 34, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * 34);
      ctx.stroke();
    }
    // header
    ctx.fillStyle = 'rgba(143,232,255,0.18)';
    ctx.fillRect(0, 0, w, 64);
    ctx.font = '700 34px "Noto Sans", sans-serif';
    ctx.fillStyle = '#e9fbff';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELENE', 24, 33);
    ctx.font = '700 28px "Noto Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('Lv. 23', w - 24, 34);
    ctx.textAlign = 'left';
    ctx.font = '400 24px "Noto Sans", sans-serif';
    ctx.fillStyle = '#cfefff';
    ctx.fillText('Sınıf: Şifacı', 24, 96);
    ctx.fillText('Beceri: Yeşil Şifa  ·  Rütbe VII', 24, 132);
    // bars
    const bar = (label: string, yy: number, v: number, c: string, txt: string) => {
      ctx.fillStyle = '#cfefff';
      ctx.font = '700 22px "Noto Sans", sans-serif';
      ctx.fillText(label, 24, yy + 10);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(90, yy, 300, 20);
      ctx.fillStyle = c;
      ctx.fillRect(90, yy, 300 * v, 20);
      ctx.fillStyle = '#e9fbff';
      ctx.font = '400 20px "Noto Sans", sans-serif';
      ctx.fillText(txt, 404, yy + 10);
    };
    const mpDrain = smooth(CUE.panelOn, CUE.panelOff, t);
    bar('HP', 176, 1, '#6dff9a', '312/312');
    bar('MP', 214, 0.7 - mpDrain * 0.18, '#6fc8ff', `${Math.round(168 - mpDrain * 43)}/240`);
    bar('EXP', 252, 0.42, '#ffd36b', '42%');
    ctx.font = 'italic 400 20px "Noto Sans", sans-serif';
    ctx.fillStyle = 'rgba(207,239,255,0.8)';
    ctx.fillText('» Şifa uygulandı: Aldric  +48 HP', 24, 300);
    // scanlines
    ctx.fillStyle = 'rgba(143,232,255,0.06)';
    for (let yy = 0; yy < h; yy += 4) ctx.fillRect(0, yy, w, 1.5);
  });
}

function statusShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  within(ctx, () => {
    const z = st.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    const bg = layer('bg');
    cottageWall(bg, t);
    composite(ctx, bg, 16);
    const g = st.glow;
    // Selene, in focus, still glowing from the spell
    const ch = layer('char');
    drawChar(ch, {
      key: 'selene', build: 'woman', hair: 'selene', x: 1140, y: 430, s: 1.6, rot: -0.05, t, yaw: -0.3,
      expr: neutral({ open: 0.85 * blink(t, [47.4]), lookX: -0.7, lookY: 0.3, mouth: 'smile', smile: 0.45, blush: 0.45 }),
      light: { x: -1, tint: GREEN_DEEP, tintAmount: 0.12 * g, rim: GREEN, rimAmount: 0.6 * g },
      body: (cx) => seleneBody(cx, -1, t),
    });
    composite(ctx, ch, 0);
    motes(ctx, 1000, 980, 260, t, g * 0.7, 40);
    statusPanel(ctx, 260, 250, t);
    // thin tether from panel to Selene
    const on = smooth(CUE.panelOn + 0.2, CUE.panelOn + 0.5, t) * (1 - smooth(CUE.panelOff - 0.3, CUE.panelOff, t));
    if (on > 0) {
      ctx.strokeStyle = rgba(PANEL, 0.6 * on);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(780, 400);
      ctx.lineTo(950, 330);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Joseph's head in the foreground (back view, soft focus)
    const fg = layer('fg');
    within(fg, () => {
      fg.translate(360, 900);
      fg.scale(2.2, 2.2);
      const hair = characters.joseph.hair;
      ellipse(fg, 0, 40, 120, 120, characters.joseph.skin.shadow);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 26; i++) {
        const a = Math.PI + (i / 25) * Math.PI * 1.1 - 0.05;
        const r = 112 + (i % 3 === 0 ? 10 : 0);
        pts.push(P(Math.cos(a) * r, Math.sin(a) * r * 0.95));
      }
      pts.push(P(110, 30), P(70, 50), P(40, 30), P(0, 60), P(-40, 34), P(-80, 52), P(-112, 30));
      fillPoly(fg, spline(pts, true, 4), hair.base);
      within(fg, () => {
        fg.globalCompositeOperation = 'lighter';
        ink(fg, spline(pts.slice(14, 26), false, 4), 8, rgba(GREEN, 0.5 * g), taper);
      });
    });
    composite(ctx, fg, 14);
    wash(ctx, GREEN_DEEP, 0.05 * g, 'soft-light');
  });
}

const scene: Scene = {
  id: 'magic',
  start: CUE.magic,
  end: CUE.mira,
  grain: 0.08,
  draw(ctx, c) {
    const { t } = c;
    if (t < CUE.josephEyes) handsShot(ctx, c);
    else if (t < CUE.status) eyesShot(ctx, c);
    else statusShot(ctx, c);
    wash(ctx, WARM.amber, 0.06, 'soft-light');
    wash(ctx, '#000', smooth(CUE.mira - 0.35, CUE.mira, t));
    void clamp; void taperEnd;
  },
};
export default scene;
