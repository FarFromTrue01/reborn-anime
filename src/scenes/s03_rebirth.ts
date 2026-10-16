// 0:23–0:33 — Rebirth. White becomes warm blurred light; through a baby's
// eyes the faces come into focus: Selene humming a lullaby, then Aldric.
import type { Scene, Clock } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { keys } from '../timeline';
import { Ctx, within } from '../lib/brush';
import { composite, layer, wash } from '../lib/fx';
import { clamp, mix, smooth } from '../lib/math';
import { neutral } from '../lib/face';
import { aldricBody, babyHand, seleneBody } from '../lib/bodies';
import { blink, breath, drawChar } from './common';
import { ceilingPOV, warmAir, WARM } from './elonth';

const st = { blur: 60, lids: 0, selX: 960, aldX: 1700, push: 1, hands: 0 };
keys(st, 'blur', [[CUE.rebirth, 70], [CUE.seleneFocus, 34, 'sine.out'], [CUE.seleneFocus + 1.5, 0, 'power2.inOut']]);
keys(st, 'lids', [[CUE.rebirth + 0.2, 0], [CUE.rebirth + 1.4, 1, 'power2.out']]);
keys(st, 'selX', [[CUE.aldric, 960], [CUE.aldric + 1.2, 760, 'power2.inOut']]);
keys(st, 'aldX', [[CUE.aldric, 1820], [CUE.aldric + 1.4, 1260, 'power2.out']]);
keys(st, 'push', [[CUE.seleneFocus, 1.0], [CUE.aldric, 1.06, 'none'], [CUE.montage, 1.0, 'sine.inOut']]);
keys(st, 'hands', [[CUE.seleneFocus + 1.9, 0], [CUE.seleneFocus + 2.8, 1, 'power2.out'], [CUE.aldric + 0.4, 1], [CUE.aldric + 1.2, 0, 'power2.in']]);

/** POV eyelids: a soft dark frame that opens/blinks. */
function eyelids(ctx: Ctx, open: number) {
  if (open >= 0.999) return;
  const L = layer('lids');
  L.fillStyle = '#1a0e08';
  L.beginPath();
  L.rect(-50, -50, W + 100, H + 100);
  L.ellipse(W / 2, H / 2, W * 0.78, Math.max(1, H * 0.85 * open), 0, 0, Math.PI * 2);
  L.fill('evenodd');
  composite(ctx, L, 40);
}

function lullabyMouth(t: number) {
  // humming: lips part slightly on each phrase
  return 0.25 + 0.25 * Math.max(0, Math.sin(t * 4.4)) * (Math.sin(t * 0.9) > -0.6 ? 1 : 0.2);
}

function draw(ctx: Ctx, c: Clock) {
  const { t } = c;
  const lt = t - CUE.rebirth;
  within(ctx, () => {
    const z = st.push;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);

    // ceiling + light (always slightly soft — depth of field)
    const bg = layer('bg');
    ceilingPOV(bg, t);
    composite(ctx, bg, Math.max(10, st.blur));

    // the faces
    const ch = layer('char');
    const br = breath(t, 0.2);
    const tilt = 0.14 + Math.sin(t * 0.7) * 0.02;
    drawChar(ch, {
      key: 'selene', build: 'woman', hair: 'selene', x: st.selX, y: 470 + br * 4, s: 2.25, rot: tilt, t, yaw: -0.08,
      expr: neutral({
        open: 0.62 * blink(t, [27.9, 31.3]), lookY: 0.45, lookX: 0.05, mouth: 'hum', mouthOpen: lullabyMouth(t), smile: 0.5,
        blush: 0.6, brow: 0.15, sparkle: 1.3,
      }),
      light: { x: -1, tint: WARM.sun, tintAmount: 0.18, rim: WARM.sunHot, rimAmount: 0.7 },
      body: (cx) => seleneBody(cx, -1, t),
      wind: 0.2,
    });
    if (t > CUE.aldric) {
      drawChar(ch, {
        key: 'aldric', build: 'man', hair: 'aldric', x: st.aldX, y: 500, s: 2.05, rot: -0.2, t, yaw: -0.2, stubble: true,
        expr: neutral({ open: blink(t, [31.9]), lidHeavy: 0.35, lookY: 0.4, lookX: -0.25, mouth: 'smile', smile: 0.6, brow: 0.1, blush: 0.1 }),
        light: { x: -1, tint: WARM.sun, tintAmount: 0.15, rim: WARM.sunHot, rimAmount: 0.5 },
        body: (cx) => aldricBody(cx, -1),
      });
    }
    composite(ctx, ch, st.blur * 0.9);

    // warm white bloom fading from the white-out
    wash(ctx, '#fff1d8', 1 - smooth(CUE.rebirth, CUE.rebirth + 1.6, t));
    warmAir(ctx, t, 0.9);

    // tiny hands reaching up into frame
    if (st.hands > 0) {
      const hd = layer('hands');
      for (const s of [-1, 1] as const) {
        within(hd, () => {
          const reach = st.hands;
          hd.translate(W / 2 + s * 330 + Math.sin(t * 2 + s) * 10, H + 120 - reach * 330 + Math.sin(t * 3 + s) * 8);
          hd.rotate(s * 0.25 + Math.sin(t * 2.2 + s) * 0.05);
          hd.scale(s * 2.6, 2.6);
          babyHand(hd, 'joseph', 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.4 + s)));
        });
      }
      composite(ctx, hd, 3);
    }
  });
  // eyelids open at the start, and a blink when the image sharpens
  const lid = st.lids * blink(t, [CUE.seleneFocus - 0.35], 0.22);
  eyelids(ctx, lid);
  // warm grade
  wash(ctx, mix('#ff9a3a', '#ffb35a', clamp(lt / 10)), 0.1, 'soft-light');
}

const scene: Scene = { id: 'rebirth', start: CUE.rebirth, end: CUE.montage, grain: 0.08, draw };
export default scene;
