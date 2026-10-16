// 0:49–0:57 — Three years old. Night, candlelight: Mira is born and cries
// with all her might. Joseph watches her and smiles, just a little.
import type { Scene, Clock } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { keys } from '../timeline';
import { characters } from '../characters';
import { Ctx, ellipse, fillPoly, ink, inkS, linear, radial, spline, taper, within } from '../lib/brush';
import { bokehField, composite, drawBokeh, dust, layer, wash } from '../lib/fx';
import { hash, noise1, P, rgba, smooth } from '../lib/math';
import { neutral } from '../lib/face';
import { aldricBody, childBody, seleneBody, swaddle } from '../lib/bodies';
import { blink, breath, drawChar } from './common';
import { candle, cottageWall } from './elonth';

const CANDLE = '#ffb35a';
const st = { push: 1, smile: 0 };
keys(st, 'push', [[CUE.mira, 1.0], [CUE.miraClose, 1.06, 'none'], [CUE.miraClose, 1.0], [CUE.josephSmile, 1.05, 'none'], [CUE.josephSmile, 1.0], [CUE.title, 1.12, 'none']]);
keys(st, 'smile', [[CUE.josephSmile + 1.0, 0], [CUE.josephSmile + 2.0, 1, 'sine.inOut']]);

const candleBokeh = bokehField(77, 30, ['#ffb35a', '#ffd38a', '#ff8a3a'], [0, 100, W, 880], 18, 70);

function flicker(t: number) {
  return 0.85 + noise1(t * 7, 5) * 0.1 + noise1(t * 17, 6) * 0.05;
}

/** Anime "crying" emanata: short strokes bursting around the head. */
function cryLines(ctx: Ctx, x: number, y: number, r: number, t: number, a: number) {
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const k = i % 3;
    const pulse = 0.5 + 0.5 * Math.sin(t * 14 + i);
    const ang = side * (0.9 + k * 0.35) - Math.PI / 2;
    const r0 = r * (1.0 + pulse * 0.08), r1 = r0 + r * 0.22;
    inkS(ctx, [P(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0), P(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1)], 7, rgba('#5a3340', a * (0.6 + pulse * 0.4)), taper);
  }
}

function miraBaby(ctx: Ctx, x: number, y: number, s: number, rot: number, t: number) {
  const shake = Math.sin(t * 22) * 0.025;
  drawChar(ctx, {
    key: 'mira', build: 'baby', hair: 'babyMira', x: x + Math.sin(t * 19) * 2 * s, y, s, rot: rot + shake, t, noNeck: true, wind: Math.sin(t * 9) * 0.4,
    expr: neutral({ squeeze: 1, worry: 1, mouth: 'cry', mouthOpen: 0.75 + 0.25 * Math.abs(Math.sin(t * 3.1)), blush: 0.95, tears: 0.7 + 0.3 * Math.sin(t * 2) }),
    light: { x: -1, tint: CANDLE, tintAmount: 0.15 },
    body: (cx) => swaddle(cx, 'mira', t, 1),
  });
}

function room(ctx: Ctx, t: number, blur: number) {
  const bg = layer('bg');
  cottageWall(bg, t, { night: 1, window: 1400 });
  candle(bg, 360, 600, 1.2, t, 1);
  candle(bg, 1600, 640, 1.0, t, 2);
  composite(ctx, bg, blur);
  wash(ctx, '#140a10', 0.35);
  drawBokeh(ctx, candleBokeh, t, 0.55 * flicker(t));
}

function familyShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  const f = flicker(t);
  within(ctx, () => {
    const z = st.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    room(ctx, t, 14);
    const ch = layer('char');
    const light = { x: -1, tint: CANDLE, tintAmount: 0.22 * f, rim: '#ffcf8a', rimAmount: 0.6 * f };
    drawChar(ch, {
      key: 'aldric', build: 'man', hair: 'aldric', x: 1430, y: 460, s: 1.45, rot: -0.12, t, yaw: -0.3, stubble: true,
      expr: neutral({ open: 0.8 * blink(t, [50.3]), lidHeavy: 0.2, lookX: -0.8, lookY: 0.6, mouth: 'smile', smile: 0.7, brow: 0.2, worry: 0.3, tears: 0.25 }),
      light, body: (cx) => aldricBody(cx, -1),
    });
    drawChar(ch, {
      key: 'selene', build: 'woman', hair: 'selene', x: 800, y: 440, s: 1.45, rot: 0.1, t, yaw: 0.2,
      expr: neutral({ open: 0.55, lookX: 0.4, lookY: 0.7, mouth: 'smile', smile: 0.6, blush: 0.7, brow: 0.1, worry: 0.2 }),
      light, body: (cx) => seleneBody(cx, -1, t), breathe: breath(t, 0.3) * 0.01,
    });
    // Mira in her arms
    miraBaby(ch, 930, 800, 0.78, -0.35, t);
    // Selene's forearm cradling the bundle
    within(ch, () => {
      const sel = characters.selene;
      const arm = spline([P(560, 1000), P(700, 930), P(920, 960), P(1100, 900), P(1150, 940), P(950, 1040), P(700, 1100)], true, 8);
      fillPoly(ch, arm, sel.outfit.blouse);
      ink(ch, [...arm, arm[0]], 4, sel.line, () => 1);
      ellipse(ch, 1120, 916, 34, 26, sel.skin.base);
    });
    cryLines(ch, 930, 760, 150, t, 0.9);
    composite(ctx, ch, 0);
    // foreground candle, out of focus
    const fg = layer('fg');
    candle(fg, 1780, 1080, 2.4, t, 3);
    composite(ctx, fg, 18);
    dust(ctx, t, 25, '#ffd38a', 0.3, 31);
  });
}

function cryClose(ctx: Ctx, c: Clock) {
  const { t } = c;
  within(ctx, () => {
    const z = st.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    room(ctx, t, 30);
    const ch = layer('char');
    miraBaby(ch, 960, 540, 1.65, -0.12, t);
    cryLines(ch, 960, 480, 320, t, 1);
    composite(ctx, ch, 0);
    // warm swell of light as the music rises
    ctx.fillStyle = radial(ctx, 960, 480, 900, [[0, rgba('#ffcf8a', 0.18 * smooth(CUE.miraClose, CUE.josephSmile, t))], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, W, H);
  });
}

function josephShot(ctx: Ctx, c: Clock) {
  const { t } = c;
  const f = flicker(t);
  const k = st.smile;
  within(ctx, () => {
    const z = st.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    room(ctx, t, 26);
    const ch = layer('char');
    drawChar(ch, {
      key: 'joseph', build: 'child', hair: 'childJoseph', x: 960, y: 450, s: 2.0, rot: 0.08, t, yaw: 0.15,
      expr: neutral({
        open: blink(t, [55.0]), lookX: -0.1, lookY: 0.75, mouth: k > 0.15 ? 'smile' : 'line', smile: k * 0.55,
        brow: 0.1 + k * 0.1, blush: 0.45 + k * 0.25, sparkle: 1.2 + k * 0.4,
      }),
      light: { x: -1, tint: CANDLE, tintAmount: 0.28 * f, rim: '#ffcf8a', rimAmount: 0.8 * f },
      body: (cx) => childBody(cx, -1),
      breathe: breath(t, 0.3) * 0.01,
    });
    composite(ctx, ch, 0);
    // candle glow from below-left
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = radial(ctx, 300, 1000, 900, [[0, rgba(CANDLE, 0.3 * f)], [1, 'rgba(0,0,0,0)']]);
      ctx.fillRect(0, 0, W, H);
    });
    const fg = layer('fg');
    candle(fg, 260, 1120, 2.6, t, 4);
    composite(ctx, fg, 20);
    dust(ctx, t, 20, '#ffd38a', 0.25, 41);
    // fade into the title
    wash(ctx, '#000', smooth(CUE.title - 0.6, CUE.title, t));
  });
}

const scene: Scene = {
  id: 'mira',
  start: CUE.mira,
  end: CUE.title,
  grain: 0.1,
  draw(ctx, c) {
    const { t } = c;
    if (t < CUE.miraClose) familyShot(ctx, c);
    else if (t < CUE.josephSmile) cryClose(ctx, c);
    else josephShot(ctx, c);
    wash(ctx, '#ff8a3a', 0.1, 'soft-light');
    wash(ctx, '#000', 1 - smooth(CUE.mira, CUE.mira + 0.5, t));
    void hash; void linear;
  },
};
export default scene;
