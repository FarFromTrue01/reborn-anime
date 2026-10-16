// 0:15–0:23 — The crossing. Rain, headlights, a horn, slow motion, sudden
// silence, then white. No impact, no injury is ever shown.
import type { Scene, Clock } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { keys } from '../timeline';
import { Ctx, ellipse, fillPoly, linear, radial, within } from '../lib/brush';
import { composite, layer, rain, rainBeads, wash } from '../lib/fx';
import { clamp, easeIn, hash, mix, P, rgba, smooth } from '../lib/math';
import { neutral } from '../lib/face';
import { babyHand, nolanBody, walker } from '../lib/bodies';
import { drawChar } from './common';
import { drawGame } from './game';
import { street } from './city';

/** Rain clock: normal speed, then slow motion, then frozen. */
export function rainClock(t: number) {
  if (t < CUE.slowmo) return t;
  if (t < CUE.silence) return CUE.slowmo + (t - CUE.slowmo) * 0.05;
  return CUE.slowmo + (CUE.silence - CUE.slowmo) * 0.05;
}

const st = { walkZ: 0, lights: 0, turn: 0, fall: 0, eye: 1 };
keys(st, 'walkZ', [[CUE.crash, 0], [CUE.headlights, 1, 'none']]);
keys(st, 'lights', [[CUE.headlights, 0], [CUE.turn, 1, 'power2.in']]);
keys(st, 'turn', [[CUE.turn, 0], [CUE.turn + 0.35, 1, 'power3.out']]);
keys(st, 'fall', [[CUE.slowmo, 0], [CUE.silence, 1, 'none']]);
keys(st, 'eye', [[CUE.silence, 1], [CUE.white, 1.12, 'power1.in']]);

function headlightPair(ctx: Ctx, cx: number, cy: number, sep: number, r: number, a: number) {
  within(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      const x = cx + s * sep;
      ellipse(ctx, x, cy, r * 6, r * 6, radial(ctx, x, cy, r * 6, [[0, rgba('#fff8e8', 0.9 * a)], [0.15, rgba('#ffeccc', 0.55 * a)], [1, 'rgba(255,240,210,0)']]));
      ellipse(ctx, x, cy, r, r * 0.7, rgba('#ffffff', a));
    }
    // anamorphic streak
    ctx.fillStyle = linear(ctx, cx - sep * 6, 0, cx + sep * 6, 0, [[0, 'rgba(120,170,255,0)'], [0.5, rgba('#bcd6ff', 0.7 * a)], [1, 'rgba(120,170,255,0)']]);
    ctx.fillRect(cx - sep * 6, cy - r * 0.18, sep * 12, r * 0.36);
  });
}

function crossing(ctx: Ctx, c: Clock) {
  const { t } = c;
  const z = st.walkZ;
  within(ctx, () => {
    street(ctx, t, rainClock(t), { crosswalk: true, camX: 120, rainAlpha: 0.55, signal: 1 });
    // Nolan walks toward camera along the crossing, eyes on his phone
    within(ctx, () => {
      ctx.translate(960 + Math.sin(t * 2.6) * 3, 640 + z * 80);
      walker(ctx, t * 5.4, 0.62 + z * 0.16, true);
    });
    // first hint of headlights at the right edge
    const hint = smooth(CUE.crash + 1.0, CUE.headlights, t);
    ctx.fillStyle = linear(ctx, W, 0, W - 700, 0, [[0, rgba('#fff1d6', 0.35 * hint)], [1, 'rgba(255,240,210,0)']]);
    ctx.fillRect(0, 0, W, H);
  });
}

function headlights(ctx: Ctx, c: Clock) {
  const { t } = c;
  const k = st.lights;
  within(ctx, () => {
    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, W, H);
    // wet road plane catching the light
    ctx.fillStyle = linear(ctx, 0, 560, 0, H, [[0, '#0b111c'], [1, '#05070c']]);
    ctx.fillRect(0, 560, W, H);
    const sep = 90 + k * 420;
    const r = 18 + k * 70;
    const cy = 560 - k * 40;
    // car silhouette
    fillPoly(ctx, [P(960 - sep * 1.7, cy + r * 0.9), P(960 - sep * 1.3, cy - r * 2.2), P(960 + sep * 1.3, cy - r * 2.2), P(960 + sep * 1.7, cy + r * 0.9), P(960 + sep * 1.7, cy + r * 3), P(960 - sep * 1.7, cy + r * 3)], '#020306');
    // reflections on the road
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) {
        for (let i = 0; i < 18; i++) {
          const y = cy + r + 20 + i * 14;
          const ww = r * (0.8 + Math.sin(i * 2.7 + t * 9) * 0.5);
          ctx.fillStyle = rgba('#fff0d8', 0.35 * (0.4 + k) * (1 - i / 18));
          ctx.fillRect(960 + s * sep - ww / 2 + Math.sin(i + t * 7) * 6, y, ww, 4);
        }
      }
    });
    headlightPair(ctx, 960, cy, sep, r, 0.6 + k * 0.4);
    // rain lit by the beams
    rain(ctx, rainClock(t), { count: 380, speed: 1800, len: 52, angle: 0.1, alpha: 0.4 + k * 0.5, color: '#fff6e4', seed: 8 });
    wash(ctx, '#fff4e0', k * 0.25, 'lighter');
  });
}

function faceTurn(ctx: Ctx, c: Clock) {
  const { t } = c;
  const k = st.turn;
  within(ctx, () => {
    // background: dark street smeared by light from the right
    ctx.fillStyle = linear(ctx, 0, 0, W, 0, [[0, '#05070c'], [0.6, '#1a2234'], [1, '#fff3dc']]);
    ctx.fillRect(0, 0, W, H);
    const ch = layer('char');
    drawChar(ch, {
      key: 'nolan', build: 'man', hair: 'nolan', x: 900 - k * 40, y: 480, s: 2.2, rot: 0.03 - k * 0.04, t,
      yaw: -0.35 + k * 0.6, wind: 0.6,
      expr: neutral({
        open: 1, lookX: -0.5 + k * 1.5, lookY: 0, brow: k * 0.9, worry: k * 0.3, mouth: k > 0.4 ? 'o' : 'line', mouthOpen: k * 0.4,
        pupil: 1 - k * 0.45, sparkle: 1 + k * 0.6, blush: 0,
      }),
      light: { x: 1, tint: '#fff2d8', tintAmount: 0.15 + k * 0.4, rim: '#ffffff', rimAmount: 0.4 + k * 0.6 },
      body: (cx) => nolanBody(cx, 1),
    });
    composite(ctx, ch, 0);
    // wet hair/rain in front, brightly lit
    rain(ctx, rainClock(t), { count: 160, speed: 1900, len: 70, angle: 0.08, alpha: 0.6, color: '#fffaf0', seed: 12, width: 2.2 });
    wash(ctx, '#fff6e6', smooth(CUE.turn + 0.3, CUE.slowmo, t) * 0.35, 'lighter');
  });
}

function slowmo(ctx: Ctx, c: Clock) {
  const { t } = c;
  const k = st.fall;
  const rc = rainClock(t);
  within(ctx, () => {
    const z = 1 + k * 0.08;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    // white-gold light swallowing the street from the right
    ctx.fillStyle = linear(ctx, 0, 0, W, 0, [[0, '#0a0e18'], [0.55, mix('#2a3346', '#d8d2c4', k)], [1, '#fffaf0']]);
    ctx.fillRect(0, 0, W, H);
    // blurred silhouette of Nolan behind
    const bg = layer('bg');
    within(bg, () => {
      bg.translate(760, 300);
      walker(bg, 0.6, 1.5, false);
    });
    composite(ctx, bg, 22, 0.75);
    // his hand, just let go
    const hand = layer('hand');
    within(hand, () => {
      hand.translate(820, 300 - k * 10);
      hand.rotate(2.6);
      hand.scale(1.5, 1.5);
      babyHand(hand, 'nolan', 0.9 + k * 0.1, 0, true);
    });
    composite(ctx, hand, 6);
    // the phone, tumbling slowly
    const px = 980 + k * 30, py = 430 + easeIn(k) * 120 + k * 120;
    within(ctx, () => {
      ctx.translate(px, py);
      ctx.rotate(-0.35 + k * 0.7);
      const pw = 470, ph = 240;
      ctx.fillStyle = '#0c0d11';
      roundRect(ctx, -pw / 2 - 10, -ph / 2 - 10, pw + 20, ph + 20, 34);
      ctx.fill();
      ctx.save();
      roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 26);
      ctx.clip();
      ctx.translate(-pw / 2, -ph / 2);
      drawGame(ctx, 0, 0, pw, ph, t, 10, 'continue');
      ctx.restore();
      // edge highlight from the headlights
      ctx.strokeStyle = 'rgba(255,250,235,0.85)';
      ctx.lineWidth = 4;
      roundRect(ctx, -pw / 2 - 10, -ph / 2 - 10, pw + 20, ph + 20, 34);
      ctx.stroke();
    });
    // suspended raindrops, each catching the light
    rainBeads(ctx, rc, 260, 31, 0.85, 1.6);
    const fg = layer('fg');
    rainBeads(fg, rc * 1.4, 26, 44, 0.9, 4);
    composite(ctx, fg, 6);
    wash(ctx, '#fffaf0', smooth(CUE.silence - 1.2, CUE.silence, t) * 0.45, 'lighter');
  });
}

function eye(ctx: Ctx, c: Clock) {
  const { t } = c;
  const k = st.eye;
  within(ctx, () => {
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, W, H);
    // extreme close-up of one eye (right eye of the model, scaled up)
    const ch = layer('char');
    drawChar(ch, {
      key: 'nolan', build: 'man', hair: 'nolan', x: 960 - 47 * 7.5, y: 540, s: 7.5, t: CUE.silence,
      expr: neutral({ open: 1, lookX: 0.6, pupil: 0.5, sparkle: 1.8, brow: 1, blush: 0 }),
      light: { x: 1, tint: '#fff2d8', tintAmount: 0.5, rim: '#ffffff', rimAmount: 1 },
    });
    composite(ctx, ch, 0);
    // twin headlights mirrored in the iris
    headlightPair(ctx, 1000, 560, 34, 9, 1);
    wash(ctx, '#ffffff', smooth(CUE.silence + 0.1, CUE.white, t) * 0.9, 'source-over');
  });
}

function whiteout(ctx: Ctx, c: Clock) {
  const { t } = c;
  // pure white, slowly warming toward the next life
  const warm = smooth(CUE.white + 1.0, CUE.rebirth, t);
  ctx.fillStyle = mix('#ffffff', '#fff1d8', warm);
  ctx.fillRect(0, 0, W, H);
  // faint pulse with the ringing
  const ring = clamp(1 - (t - CUE.white) / 2);
  ctx.fillStyle = radial(ctx, W / 2, H / 2, 900, [[0, rgba('#ffffff', 0)], [1, rgba('#dfe6f0', 0.25 * ring)]]);
  ctx.fillRect(0, 0, W, H);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const scene: Scene = {
  id: 'crash',
  start: CUE.crash,
  end: CUE.rebirth,
  grain: 0.12,
  draw(ctx, c) {
    const { t } = c;
    if (t < CUE.headlights) crossing(ctx, c);
    else if (t < CUE.turn) headlights(ctx, c);
    else if (t < CUE.slowmo) faceTurn(ctx, c);
    else if (t < CUE.silence) slowmo(ctx, c);
    else if (t < CUE.white) eye(ctx, c);
    else whiteout(ctx, c);
    if (t < CUE.white) wash(ctx, '#1b3a6b', 0.1, 'soft-light');
    void hash;
  },
};
export default scene;
