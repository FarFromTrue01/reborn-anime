// Dev-only character sheet used for visual QA of the head renderer.
import { characters } from '../characters';
import { drawHead, neutral, Build } from '../lib/face';
import { HAIR } from '../lib/hair';

const c = document.getElementById('c') as HTMLCanvasElement;
const ctx = c.getContext('2d')!;
const params = new URLSearchParams(location.search);
const t = Number(params.get('t') ?? 0);
const yaw = Number(params.get('yaw') ?? 0);
ctx.fillStyle = '#9aa0a8';
ctx.fillRect(0, 0, 1920, 1080);
const list: [keyof typeof characters, Build, string, any][] = [
  ['nolan', 'man', 'nolan', { lidHeavy: 0.5 }],
  ['selene', 'woman', 'selene', { mouth: 'smile', smile: 0.6 }],
  ['aldric', 'man', 'aldric', { mouth: 'smile', smile: 0.4 }],
  ['joseph', 'baby', 'babyJoseph', {}],
  ['joseph', 'toddler', 'toddlerJoseph', { mouth: 'o', mouthOpen: 0.3 }],
  ['joseph', 'child', 'childJoseph', { mouth: 'smile', smile: 0.4 }],
  ['mira', 'baby', 'babyMira', { mouth: 'cry', mouthOpen: 1, squeeze: 1, tears: 0.8, blush: 0.8 }],
  ['selene', 'woman', 'selene', { open: 0, mouth: 'hum' }],
];
list.forEach(([k, build, hair, ex], i) => {
  ctx.save();
  ctx.translate(240 + (i % 4) * 480, 290 + Math.floor(i / 4) * 520);
  ctx.scale(0.95, 0.95);
  drawHead(ctx, { pal: characters[k], build, hair: HAIR[hair], expr: neutral(ex), yaw, t, stubble: k === 'aldric' });
  ctx.restore();
});
if (params.has('body')) {
  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(0, 0, 1920, 1080);
  import('../lib/bodies').then((B) => {
    const fns: [any, keyof typeof characters, Build, string][] = [[B.nolanBody, 'nolan', 'man', 'nolan'], [B.seleneBody, 'selene', 'woman', 'selene'], [B.aldricBody, 'aldric', 'man', 'aldric'], [B.childBody, 'joseph', 'child', 'childJoseph']];
    fns.forEach(([fn, k, build, hair], i) => {
      ctx.save();
      ctx.translate(240 + i * 480, 330);
      ctx.scale(0.75, 0.75);
      drawHead(ctx, { pal: characters[k], build, hair: HAIR[hair], expr: neutral({}), t, body: () => fn(ctx, -1), stubble: k === 'aldric' });
      ctx.restore();
    });
  });
}
if (params.has('hands')) {
  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(0, 0, 1920, 1080);
  import('../lib/bodies').then((B) => {
    [0, 0.5, 1].forEach((sp, i) => {
      ctx.save();
      ctx.translate(300 + i * 500, 600);
      ctx.scale(2.5, 2.5);
      B.adultHand(ctx, 'selene', sp, 1);
      ctx.restore();
    });
  });
}
