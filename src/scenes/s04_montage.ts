// 0:33–0:41 — Seasons pass in the window (snow, blossom, summer); the baby
// never cries, and his parents can't quite believe it.
import type { Scene, Clock } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { keys } from '../timeline';
import { Ctx, ellipse, fillPoly, ink, inkS, linear, radial, spline, taper, within } from '../lib/brush';
import { composite, layer, rays, wash } from '../lib/fx';
import { hash, lerp, mix, noise1, P, rgba, smooth } from '../lib/math';
import { neutral } from '../lib/face';
import { aldricBody, seleneBody, swaddle } from '../lib/bodies';
import { blink, breath, drawChar } from './common';
import { ceilingPOV, warmAir, WARM } from './elonth';

const st = { winPush: 1, crib: 1, two: 1 };
keys(st, 'winPush', [[CUE.montage, 1.0], [CUE.crib, 1.08, 'none']]);
keys(st, 'crib', [[CUE.crib, 1.0], [CUE.parents, 1.06, 'none']]);
keys(st, 'two', [[CUE.parents, 1.04], [CUE.magic, 1.0, 'sine.out']]);

type Season = 0 | 1 | 2;
const SKY: Record<Season, [string, string]> = { 0: ['#b9c6d6', '#e8ecf0'], 1: ['#a9d2f0', '#fde9f0'], 2: ['#6fb7ef', '#fff2c8'] };
const HILL: Record<Season, [string, string]> = { 0: ['#eef2f6', '#d6dee8'], 1: ['#9fcf7a', '#7fb865'], 2: ['#6caf4a', '#4f9038'] };
const LEAF: Record<Season, string[]> = { 0: [], 1: ['#ffc7da', '#ffb0cb', '#fff0f5', '#f7a8c4'], 2: ['#4f9a3a', '#3f8a32', '#6fb84a', '#2f7a2a'] };

function tree(ctx: Ctx, x: number, y: number, len: number, ang: number, depth: number, seed: number, season: Season, t: number, tips: { x: number; y: number }[]) {
  const sway = Math.sin(t * 1.2 + depth) * 0.02 * (5 - depth);
  const a = ang + sway;
  const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
  inkS(ctx, [P(x, y), P((x + x2) / 2 + Math.cos(a) * len * 0.05, (y + y2) / 2), P(x2, y2)], Math.max(2, depth * 7), '#4a3324', (u) => 1 - u * 0.4);
  if (season === 0 && depth < 4) inkS(ctx, [P(x, y - 3), P(x2, y2 - 3)], Math.max(1.5, depth * 2.4), '#ffffff', taper);
  if (depth <= 1) { tips.push(P(x2, y2)); return; }
  const n = 2 + (hash(depth, seed) > 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const da = (i - (n - 1) / 2) * 0.55 + (hash(i + depth * 7, seed) - 0.5) * 0.3;
    tree(ctx, x2, y2, len * (0.68 + hash(i, seed + depth) * 0.15), a + da, depth - 1, seed * 3 + i, season, t, tips);
  }
}

function landscape(ctx: Ctx, x0: number, y0: number, w: number, h: number, s: Season, t: number, lt: number) {
  within(ctx, () => {
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    ctx.fillStyle = linear(ctx, 0, y0, 0, y0 + h, [[0, SKY[s][0]], [1, SKY[s][1]]]);
    ctx.fillRect(x0, y0, w, h);
    if (s === 2) {
      ellipse(ctx, x0 + w * 0.78, y0 + h * 0.22, 140, 140, radial(ctx, x0 + w * 0.78, y0 + h * 0.22, 140, [[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,240,180,0.7)'], [1, 'rgba(255,230,160,0)']]));
    }
    // clouds
    for (let i = 0; i < 4; i++) {
      const cx = x0 + ((hash(i, 50 + s) * w + t * 12) % (w + 300)) - 150, cy = y0 + 60 + hash(i, 60) * 120;
      for (let k = 0; k < 4; k++) ellipse(ctx, cx + k * 40, cy + Math.sin(k) * 10, 60, 30, rgba('#ffffff', s === 0 ? 0.5 : 0.75));
    }
    // hills
    const hill = (yb: number, amp: number, c: string, seed: number) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + h);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x0 + x, y0 + yb + Math.sin(x * 0.006 + seed) * amp + Math.sin(x * 0.017 + seed * 2) * amp * 0.3);
      ctx.lineTo(x0 + w, y0 + h);
      ctx.fill();
    };
    hill(h * 0.55, 40, mix(HILL[s][0], SKY[s][0], 0.35), 1);
    hill(h * 0.68, 50, HILL[s][0], 2);
    hill(h * 0.82, 30, HILL[s][1], 3);
    // a distant cottage with chimney smoke
    fillPoly(ctx, [P(x0 + w * 0.2, y0 + h * 0.7), P(x0 + w * 0.2 + 70, y0 + h * 0.7), P(x0 + w * 0.2 + 70, y0 + h * 0.64), P(x0 + w * 0.2 + 35, y0 + h * 0.58), P(x0 + w * 0.2, y0 + h * 0.64)], s === 0 ? '#8a7a70' : '#9a6a4a');
    for (let i = 0; i < 5; i++) ellipse(ctx, x0 + w * 0.2 + 55 + i * 8 + Math.sin(t + i) * 4, y0 + h * 0.56 - i * 22, 10 + i * 4, 8 + i * 3, rgba('#ffffff', 0.35 - i * 0.06));
    // the tree
    const tips: { x: number; y: number }[] = [];
    tree(ctx, x0 + w * 0.62, y0 + h * 0.86, h * 0.24, -0.05, 6, 7, s, t, tips);
    if (s > 0) {
      tips.forEach((p, i) => {
        const c = LEAF[s][i % LEAF[s].length];
        for (let k = 0; k < 3; k++) ellipse(ctx, p.x + (hash(i * 3 + k, 9) - 0.5) * 50, p.y + (hash(i * 3 + k, 10) - 0.5) * 40, 26 + hash(i, 11) * 16, 20 + hash(i, 12) * 12, rgba(c, 0.9));
      });
    } else {
      tips.forEach((p) => ellipse(ctx, p.x, p.y - 2, 6, 4, '#ffffff'));
    }
    // weather
    if (s === 0) {
      for (let i = 0; i < 120; i++) {
        const x = x0 + ((hash(i, 70) * w + Math.sin(t + i) * 20 + t * 15) % w);
        const y = y0 + ((hash(i, 71) * h + t * (40 + hash(i, 72) * 60)) % h);
        ellipse(ctx, x, y, 2 + hash(i, 73) * 3, 2 + hash(i, 73) * 3, 'rgba(255,255,255,0.9)');
      }
    } else if (s === 1) {
      for (let i = 0; i < 40; i++) {
        const x = x0 + ((hash(i, 80) * w - t * 60 + Math.sin(t * 2 + i) * 30) % w + w) % w;
        const y = y0 + ((hash(i, 81) * h + t * 50) % h);
        ellipse(ctx, x, y, 5, 3, 'rgba(255,190,210,0.95)', t * 2 + i);
      }
    } else {
      rays(ctx, x0 + w * 0.78, y0 + h * 0.22, 2.2, 1.6, 10, 900, '#fff2c0', 0.18, t, 3);
      // butterflies
      for (let i = 0; i < 3; i++) {
        const bx = x0 + w * (0.3 + i * 0.2) + Math.sin(t * 1.3 + i) * 60, by = y0 + h * 0.6 + Math.cos(t * 1.7 + i) * 40;
        const f = Math.abs(Math.sin(t * 14 + i));
        ellipse(ctx, bx - 6, by, 7 * f + 1, 5, '#fff4a0');
        ellipse(ctx, bx + 6, by, 7 * f + 1, 5, '#fff4a0');
      }
    }
    void lt;
  });
}

/** Window seen from the nursery, with a pot of herbs on the sill growing year by year. */
function windowShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  const lt = t - CUE.montage;
  within(ctx, () => {
    const z = st.winPush;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    // interior wall
    ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, '#6b4a30'], [1, '#3a2618']]);
    ctx.fillRect(0, 0, W, H);
    const wx = 560, wy = 250, ww = 800, wh = 520;
    // seasons with quick dissolves (and a blink of light between)
    const seasons: [Season, number][] = [[0, CUE.montage], [1, CUE.spring], [2, CUE.summer]];
    for (let i = 0; i < seasons.length; i++) {
      const [s, start] = seasons[i];
      const next = seasons[i + 1]?.[1] ?? 999;
      const a = smooth(start - 0.25, start + 0.05, t) * (1 - smooth(next - 0.25, next + 0.05, t));
      if (a <= 0) continue;
      const L = layer('season');
      landscape(L, wx, wy, ww, wh, s, t, lt);
      composite(ctx, L, 1.5, i === 0 ? 1 : a);
    }
    // window frame & mullions
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(wx - 40, wy - 40, ww + 80, 40);
    ctx.fillRect(wx - 40, wy + wh, ww + 80, 30);
    ctx.fillRect(wx - 40, wy - 40, 40, wh + 70);
    ctx.fillRect(wx + ww, wy - 40, 40, wh + 70);
    ctx.fillRect(wx + ww / 2 - 10, wy, 20, wh);
    ctx.fillRect(wx, wy + wh / 2 - 10, ww, 20);
    // sill
    fillPoly(ctx, [P(wx - 90, wy + wh + 30), P(wx + ww + 90, wy + wh + 30), P(wx + ww + 60, wy + wh + 70), P(wx - 60, wy + wh + 70)], '#5b3a22');
    // pot + herb growing across the seasons
    const grow = smooth(CUE.montage, CUE.crib, t);
    const px = wx + 150, py = wy + wh + 30;
    fillPoly(ctx, [P(px - 40, py - 70), P(px + 40, py - 70), P(px + 30, py), P(px - 30, py)], '#a0603a');
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(px - 44, py - 78, 88, 12);
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.35;
      const len = 30 + grow * 110 * (0.7 + hash(i, 3) * 0.4);
      const tip = P(px + Math.sin(a) * len, py - 78 - Math.cos(a) * len);
      inkS(ctx, [P(px, py - 78), P(px + Math.sin(a) * len * 0.5, py - 78 - len * 0.55), tip], 5, '#5f8a3a', taper);
      for (let k = 1; k <= 3; k++) {
        const u = k / 3.5;
        ellipse(ctx, px + Math.sin(a) * len * u + (k % 2 ? 9 : -9), py - 78 - Math.cos(a) * len * u, 6 + grow * 8, 3 + grow * 4, '#79a84a', k % 2 ? 0.6 : -0.6);
      }
      if (t > CUE.summer) ellipse(ctx, tip.x, tip.y, 7, 7, '#c9a0ff');
    }
    // light patch on the wall, sliding as seasons turn
    const lx = lerp(200, 1500, (lt / 4) % 1);
    ctx.fillStyle = radial(ctx, lx, 900, 300, [[0, rgba(WARM.sun, 0.25)], [1, rgba(WARM.sun, 0)]]);
    ctx.fillRect(0, 600, W, 480);
    // cradle rail in the foreground (soft focus)
    const fg = layer('fg');
    fg.fillStyle = '#2a1a10';
    fg.fillRect(-20, 840, W + 40, 40);
    for (let x = 30; x < W; x += 120) fg.fillRect(x, 700, 30, 400);
    composite(ctx, fg, 12);
    // time-lapse flicker
    const flick = [CUE.spring, CUE.summer].reduce((m, s0) => Math.max(m, 1 - Math.abs(t - s0) / 0.18), 0);
    wash(ctx, '#fff6e0', Math.max(0, flick) * 0.5, 'lighter');
    // winter is cooler outside, but the room stays warm
    wash(ctx, '#ffb35a', 0.1, 'soft-light');
  });
}

function cribShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  within(ctx, () => {
    const z = st.crib;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    // blanket bed
    ctx.fillStyle = linear(ctx, 0, 0, W, H, [[0, '#f1e2c4'], [1, '#c8a878']]);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) inkS(ctx, [P(-100, 150 + i * 140), P(W * 0.5, 120 + i * 150 + Math.sin(i) * 40), P(W + 100, 180 + i * 140)], 10, rgba('#b8966a', 0.35), taper);
    const ch = layer('char');
    const br = breath(t, 0.4);
    drawChar(ch, {
      key: 'joseph', build: 'baby', hair: 'babyJoseph', x: 960, y: 470 + br * 3, s: 1.75, rot: -0.12, t, noNeck: true,
      expr: neutral({ open: blink(t, [37.7, 38.3]), lookX: Math.sin(t * 0.8) * 0.4, lookY: -0.1, mouth: 'line', blush: 0.55, sparkle: 1.4 }),
      light: { x: -1, tint: WARM.sun, tintAmount: 0.12 },
      body: (cx) => swaddle(cx, 'joseph', t),
    });
    composite(ctx, ch, 0);
    // crib bars out of focus in the foreground
    const fg = layer('fg');
    fg.fillStyle = '#3a2414';
    for (let x = -40; x < W; x += 260) fg.fillRect(x + Math.sin(t * 0.3) * 6, -100, 60, H + 200);
    composite(ctx, fg, 26, 0.85);
    warmAir(ctx, t, 0.7);
  });
}

/** Talking mouth amount while a line is spoken. */
function talk(t: number, a: number, b: number) {
  if (t < a || t > b) return 0;
  return 0.25 + 0.5 * Math.abs(Math.sin(t * 15)) * (0.6 + 0.4 * noise1(t * 5, 3));
}

function parentsShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  within(ctx, () => {
    const z = st.two;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    const bg = layer('bg');
    ceilingPOV(bg, t);
    composite(ctx, bg, 14);
    const ch = layer('char');
    const selTalk = talk(t, 37.4, 39.1);
    const aldTalk = talk(t, 39.5, 41.0);
    const reassured = smooth(39.9, 40.6, t);
    drawChar(ch, {
      key: 'selene', build: 'woman', hair: 'selene', x: 700, y: 480, s: 1.95, rot: 0.16, t, yaw: 0.12,
      expr: neutral({
        open: blink(t, [40.2]), lookY: 0.5, lookX: 0.15, worry: 0.75 * (1 - reassured), brow: 0.3, blush: 0.4,
        mouth: selTalk ? 'open' : reassured > 0.5 ? 'smile' : 'line', mouthOpen: selTalk, smile: reassured * 0.5,
      }),
      light: { x: -1, tint: WARM.sun, tintAmount: 0.15, rim: WARM.sunHot, rimAmount: 0.5 },
      body: (cx) => seleneBody(cx, -1, t),
    });
    drawChar(ch, {
      key: 'aldric', build: 'man', hair: 'aldric', x: 1250, y: 500, s: 1.95, rot: -0.14, t, yaw: -0.18, stubble: true,
      expr: neutral({
        open: blink(t, [39.0]), lidHeavy: 0.3, lookY: 0.45, lookX: -0.2, brow: 0.25 - smooth(39.4, 39.8, t) * 0.15, worry: 0.3 * (1 - smooth(39.4, 39.8, t)),
        mouth: aldTalk ? 'open' : t > 39.5 ? 'smile' : 'line', mouthOpen: aldTalk, smile: smooth(39.4, 40, t) * 0.6, blush: 0.1,
      }),
      light: { x: -1, tint: WARM.sun, tintAmount: 0.12, rim: WARM.sunHot, rimAmount: 0.4 },
      body: (cx) => aldricBody(cx, -1),
    });
    composite(ctx, ch, 0);
    warmAir(ctx, t, 0.8);
  });
}

const scene: Scene = {
  id: 'montage',
  start: CUE.montage,
  end: CUE.magic,
  grain: 0.08,
  draw(ctx, c) {
    const { t } = c;
    if (t < CUE.crib) windowShot(ctx, c);
    else if (t < CUE.parents) cribShot(ctx, c);
    else parentsShot(ctx, c);
    wash(ctx, '#ff9a3a', 0.08, 'soft-light');
    void ink; void spline;
  },
};
export default scene;
