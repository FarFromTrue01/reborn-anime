// 0:03–0:15 — Night. Nolan's apartment, monitor light on his face, the
// invented RPG levels up; then he steps out into the rain.
import type { Scene, Clock } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { keys } from '../timeline';
import { characters } from '../characters';
import { Ctx, ellipse, fillPoly, ink, inkS, linear, radial, spline, taper, within } from '../lib/brush';
import { applyCam, bokehField, composite, drawBokeh, dust, layer, wash } from '../lib/fx';
import { hash, noise1, P, rgba, smooth } from '../lib/math';
import { neutral } from '../lib/face';
import { nolanBody, walker } from '../lib/bodies';
import { blink, breath, drawChar, prog } from './common';
import { drawGame } from './game';
import { glassRain, skyline, street } from './city';

const cam = { x: 840, y: 500, zoom: 1, rot: 0 };
const face = { push: 1, x: 0 };
const streetCam = { x: 0 };
keys(cam, 'zoom', [[CUE.apartment, 1.0], [CUE.shotFace1, 1.09, 'none']]);
keys(face, 'push', [[CUE.shotFace1, 1.0], [CUE.shotMonitor, 1.07, 'none'], [CUE.shotFace2, 1.0], [CUE.street, 1.05, 'none']]);
keys(streetCam, 'x', [[CUE.street, 0], [CUE.crash, 180, 'none']]);

const roomBokeh = bokehField(7, 26, ['#7fa8ff', '#c8dcff', '#ffcf8a'], [1220, 180, 640, 600], 10, 46);
const BOX_COLORS = ['#7a2433', '#1f5f6b', '#4b2f7a', '#2c4f8f', '#8a6a2a', '#2d6b45', '#6b2f5f', '#3a3f58'];

function screenGlow(t: number) {
  return 0.85 + noise1(t * 3, 2) * 0.1 + (t > CUE.levelUp && t < CUE.levelUp + 0.6 ? 0.35 * (1 - (t - CUE.levelUp) / 0.6) : 0);
}

function shelf(ctx: Ctx) {
  for (let row = 0; row < 3; row++) {
    const boardY = 236 + row * 180;
    let x = 126;
    let i = 0;
    while (x < 520) {
      const bw = 20 + hash(i, row + 3) * 16;
      const bh = 110 + hash(i, row + 7) * 50;
      if (hash(i, row + 11) > 0.86) { x += bw + 30; i++; continue; }
      const c = BOX_COLORS[Math.floor(hash(i, row + 13) * BOX_COLORS.length)];
      const y = boardY - bh;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + bw * 0.3, y + 16, bw * 0.4, 3);
      ctx.fillRect(x + bw * 0.25, y + 28, bw * 0.5, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + bw - 4, y, 4, bh);
      x += bw + 2;
      i++;
    }
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(110, boardY, 430, 16);
  }
}

function caseFiles(ctx: Ctx) {
  // stacked folders with paper edges and tabs
  for (let i = 0; i < 6; i++) {
    const y = 690 - i * 13;
    const x = 1150 + Math.sin(i * 2.1) * 10;
    fillPoly(ctx, [P(x, y), P(x + 250, y - 8), P(x + 262, y + 10), P(x + 8, y + 18)], i % 2 ? '#5b5240' : '#6a5f48');
    fillPoly(ctx, [P(x + 6, y + 2), P(x + 246, y - 6), P(x + 250, y - 2), P(x + 8, y + 6)], '#d9dde6');
    if (i % 2) fillPoly(ctx, [P(x + 190, y - 6), P(x + 222, y - 8), P(x + 224, y - 2), P(x + 192, y)], '#8a2c33');
  }
  // label on top folder
  ctx.save();
  ctx.translate(1210, 612);
  ctx.rotate(-0.03);
  ctx.font = '700 15px "Noto Sans", sans-serif';
  ctx.fillStyle = 'rgba(30,30,40,0.8)';
  ctx.fillText('DAVA No. 2417/B', 0, 0);
  ctx.restore();
}

function monitor(ctx: Ctx, t: number, x: number, y: number, w: number, h: number) {
  const g = screenGlow(t);
  // glow on wall & desk
  ctx.fillStyle = radial(ctx, x + w / 2, y + h / 2, w * 1.3, [[0, rgba('#6fa8ff', 0.32 * g)], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(x - 14, y - 14, w + 28, h + 28);
  ctx.fillRect(x + w / 2 - 20, y + h + 14, 40, 60);
  fillPoly(ctx, [P(x + w / 2 - 110, y + h + 74), P(x + w / 2 + 110, y + h + 74), P(x + w / 2 + 90, y + h + 84), P(x + w / 2 - 90, y + h + 84)], '#05070c');
  drawGame(ctx, x, y, w, h, t, t - CUE.levelUp);
  ctx.fillStyle = `rgba(150,190,255,${0.08 * g})`;
  ctx.fillRect(x, y, w, h);
}

function nolanBack(ctx: Ctx, t: number) {
  const pal = characters.nolan;
  const b = breath(t, 0.22) * 3;
  // chair
  fillPoly(ctx, spline([P(600, 980), P(590, 700), P(630, 620), P(910, 620), P(950, 700), P(940, 980)], true, 8), '#06080e');
  // shoulders/suit back
  fillPoly(ctx, spline([P(520, 960), P(540, 700), P(610, 640 - b), P(700, 618 - b), P(820, 640 - b), P(880, 700), P(900, 960)], true, 8), '#0d1222');
  // head (back view): skull + messy locks hanging down
  const hx = 705, hy = 520 - b;
  ellipse(ctx, hx - 86, hy + 20, 14, 26, '#2a1d1a');
  ellipse(ctx, hx + 88, hy + 22, 14, 26, '#2a1d1a');
  ellipse(ctx, hx, hy + 70, 46, 60, '#2a1d1a'); // neck
  const pts = [] as { x: number; y: number }[];
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI * 0.05 + (i / 29) * Math.PI * 1.1;
    const r = 100 + (i % 3 === 0 ? 9 : 0) + Math.sin(i * 2.3) * 3;
    const aa = Math.PI + a; // upper half from left to right
    pts.push(P(hx + Math.cos(aa) * r * 0.9, hy - 10 + Math.sin(aa) * r * 0.95));
  }
  const lower = [P(hx + 92, hy + 40), P(hx + 70, hy + 60), P(hx + 50, hy + 92), P(hx + 30, hy + 64), P(hx + 6, hy + 100), P(hx - 18, hy + 66), P(hx - 44, hy + 96), P(hx - 60, hy + 58), P(hx - 90, hy + 44)];
  fillPoly(ctx, [...pts, ...lower], pal.hair.shadow);
  for (let i = 0; i < 9; i++) {
    const x = hx - 70 + i * 17;
    if (i % 3 === 1) inkS(ctx, [P(x, hy - 70 + Math.abs(i - 4) * 8), P(x + 6, hy + 10), P(x + 2, hy + 70)], 2.2, rgba(pal.hair.base, 0.45), taper);
  }
  // rim light from the monitor (to the right)
  within(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    const rim = spline(pts.slice(14, 30).concat(lower.slice(0, 2)), false, 4);
    ink(ctx, rim, 6, rgba('#7fb4ff', 0.6 * screenGlow(t)), taper);
    inkS(ctx, [P(700, 618 - b), P(800, 632 - b), P(870, 690)], 6, rgba('#7fb4ff', 0.35), taper);
  });
}

function wide(ctx: Ctx, c: Clock) {
  const { t } = c;
  within(ctx, () => {
    applyCam(ctx, cam);
    // wall
    ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, '#0b1120'], [1, '#05070d']]);
    ctx.fillRect(-200, -200, W + 400, H + 400);
    // window w/ city (blurred), then glass rain
    const city = layer('city', ctx);
    skyline(city, t, 1220, 170, 640, 620);
    composite(ctx, city, 5);
    glassRain(ctx, t, 1220, 170, 640, 620);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(1205, 150, 670, 22);
    ctx.fillRect(1205, 786, 670, 24);
    ctx.fillRect(1205, 150, 18, 650);
    ctx.fillRect(1530, 150, 14, 650);
    ctx.fillRect(1858, 150, 18, 650);
    shelf(ctx);
    // desk
    fillPoly(ctx, [P(-200, 712), P(W + 200, 690), P(W + 200, H + 200), P(-200, H + 200)], '#0e131e');
    fillPoly(ctx, [P(-200, 712), P(W + 200, 690), P(W + 200, 700), P(-200, 722)], '#1e2740');
    monitor(ctx, t, 540, 300, 600, 338);
    caseFiles(ctx);
    // mug + clock
    fillPoly(ctx, [P(1440, 640), P(1490, 640), P(1486, 700), P(1444, 700)], '#1d2436');
    ctx.font = '700 30px "Noto Sans", sans-serif';
    ctx.fillStyle = '#04060a';
    ctx.fillRect(1530, 640, 150, 54);
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#7fd8ff' : '#5fb8df';
    ctx.fillText('02:47', 1562, 680);
    nolanBack(ctx, t);
    // light falling on desk from monitor
    ctx.fillStyle = radial(ctx, 840, 760, 520, [[0, rgba('#7aa8ff', 0.18 * screenGlow(t))], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 600, W, 500);
    dust(ctx, t, 26, '#a8c8ff', 0.25, 4, [400, 200, 900, 600], 0.8);
  });
}

function faceShot(ctx: Ctx, c: Clock, variant: 1 | 2) {
  const { t } = c;
  const lt = variant === 1 ? t - CUE.shotFace1 : t - CUE.shotFace2;
  const g = screenGlow(t);
  within(ctx, () => {
    const z = face.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    // background: dark room, window bokeh on the right
    ctx.fillStyle = linear(ctx, 0, 0, W, 0, [[0, '#06080f'], [1, '#0c1424']]);
    ctx.fillRect(0, 0, W, H);
    const bg = layer('bg');
    drawBokeh(bg, roomBokeh.map((b) => ({ ...b, x: b.x - (variant === 1 ? 0 : 900), y: b.y - 80, r: b.r * 2.2 })), t, 0.8);
    if (variant === 2) {
      within(bg, () => {
        bg.translate(1300, 120);
        shelf(bg);
      });
    }
    composite(ctx, bg, 18);
    // monitor light spill from the left
    ctx.fillStyle = radial(ctx, -100, 520, 1200, [[0, rgba('#5f9aff', 0.4 * g)], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, W, H);

    const ch = layer('char');
    const smile = variant === 2 ? smooth(0.15, 0.6, lt) * (1 - smooth(1.15, 1.5, lt)) : 0;
    const look = variant === 2 ? smooth(1.0, 1.3, lt) : 0;
    const open = blink(t, variant === 1 ? [CUE.shotFace1 + 1.0, CUE.shotFace1 + 2.1] : [CUE.shotFace2 + 1.45]);
    const br = breath(t, 0.22);
    drawChar(ch, {
      key: 'nolan', build: 'man', hair: 'nolan',
      x: variant === 1 ? 860 : 900, y: (variant === 1 ? 470 : 400) + br * 3, s: variant === 1 ? 2.75 : 1.55,
      rot: variant === 1 ? -0.04 : 0.02,
      yaw: variant === 1 ? -0.18 : 0.12 + look * 0.1,
      t,
      expr: neutral({
        open: open * (variant === 1 ? 0.85 : 1), lidHeavy: variant === 1 ? 0.55 : 0.35 - smile * 0.3, lookX: variant === 1 ? -0.35 : -0.3 + look * 1.1,
        lookY: 0.1, mouth: smile > 0.2 ? 'smile' : 'line', smile: smile * 0.8, brow: smile * 0.3 - (variant === 1 ? 0.15 : 0), blush: 0.1, sparkle: 1.0 + smile * 0.4,
      }),
      light: { x: -1, tint: '#4f86ff', tintAmount: 0.3 * g, rim: '#9cc4ff', rimAmount: 0.55 * g },
      body: (cx) => nolanBody(cx, -1),
      breathe: br * 0.006,
    });
    composite(ctx, ch, 0);
    // screen reflection streak on the face (the game's colours)
    if (variant === 2 && lt < 0.6) wash(ctx, '#ffd36b', 0.08 * (1 - lt / 0.6), 'lighter');
  });
}

function monitorInsert(ctx: Ctx, c: Clock) {
  const { t } = c;
  const lt = t - CUE.shotMonitor;
  within(ctx, () => {
    const z = 1.02 + lt * 0.03;
    const shake = t > CUE.levelUp && t < CUE.levelUp + 0.3 ? Math.sin(t * 90) * 4 : 0;
    ctx.translate(W / 2 + shake, H / 2);
    ctx.scale(z, z);
    ctx.rotate(-0.025);
    ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = '#020306';
    ctx.fillRect(-100, -100, W + 200, H + 200);
    drawGame(ctx, 70, 120, 1780, 1001, t, t - CUE.levelUp);
    // subpixel grid + glass reflection
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 70; x < 1850; x += 4) ctx.fillRect(x, 120, 1, 1001);
    ctx.fillStyle = linear(ctx, 0, 120, W, 900, [[0, 'rgba(255,255,255,0.07)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.03)']]);
    ctx.fillRect(70, 120, 1780, 1001);
  });
}

function exitShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  const lt = t - CUE.street;
  within(ctx, () => {
    const cx = streetCam.x;
    street(ctx, t, t, { camX: cx, doorLight: 1 - prog(t, CUE.street, CUE.street + 0.8) * 0.5, rainAlpha: 0.55 });
    // Nolan walks out of the entrance into the rain, head down to his phone
    const wx = 430 - cx + lt * 165;
    within(ctx, () => {
      ctx.translate(wx, 560);
      walker(ctx, lt * 5.2, 0.62, true);
    });
    // foreground rain (closer, bigger, blurred)
    const fg = layer('fg');
    within(fg, () => {
      fg.lineCap = 'round';
      for (let i = 0; i < 40; i++) {
        const x = hash(i, 91) * W, y = ((hash(i, 92) * (H + 300) + t * 2600) % (H + 300)) - 200;
        fg.strokeStyle = 'rgba(200,220,255,0.35)';
        fg.lineWidth = 4;
        fg.beginPath();
        fg.moveTo(x, y);
        fg.lineTo(x + 18, y + 140);
        fg.stroke();
      }
    });
    composite(ctx, fg, 4);
  });
}

const scene: Scene = {
  id: 'apartment',
  start: CUE.apartment,
  end: CUE.crash,
  grain: 0.12,
  draw(ctx, c) {
    const { t } = c;
    if (t < CUE.shotFace1) wide(ctx, c);
    else if (t < CUE.shotMonitor) faceShot(ctx, c, 1);
    else if (t < CUE.shotFace2) monitorInsert(ctx, c);
    else if (t < CUE.street) faceShot(ctx, c, 2);
    else exitShot(ctx, c);
    // cold grade
    wash(ctx, '#1b3a6b', 0.12, 'soft-light');
    // fade in from black at the very start
    wash(ctx, '#000', 1 - smooth(CUE.apartment, CUE.apartment + 0.9, t));
  },
};
export default scene;
