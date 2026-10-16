// Shared scene helpers.
import { characters, CharacterKey } from '../characters';
import { drawHead, Expression, HeadOptions, Build, Light } from '../lib/face';
import { HAIR } from '../lib/hair';
import { Ctx, within } from '../lib/brush';
import { clamp } from '../lib/math';

export interface CharOpts {
  key: CharacterKey;
  build: Build;
  hair: keyof typeof HAIR;
  x: number;
  y: number;
  s: number;
  rot?: number;
  expr: Expression;
  yaw?: number;
  light?: Light;
  t: number;
  wind?: number;
  body?: (ctx: Ctx) => void;
  stubble?: boolean;
  noNeck?: boolean;
  /** extra scale on body only (breathing) */
  breathe?: number;
}

export function drawChar(ctx: Ctx, o: CharOpts) {
  within(ctx, () => {
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot ?? 0);
    ctx.scale(o.s, o.s);
    const opts: HeadOptions = {
      pal: characters[o.key], build: o.build, hair: HAIR[o.hair], expr: o.expr, yaw: o.yaw, light: o.light, t: o.t,
      wind: o.wind, stubble: o.stubble, noNeck: o.noNeck,
      body: o.body
        ? () => within(ctx, () => {
            const b = o.breathe ?? 0;
            ctx.translate(0, 260);
            ctx.scale(1 + b * 0.4, 1 + b);
            ctx.translate(0, -260);
            o.body!(ctx);
          })
        : undefined,
    };
    drawHead(ctx, opts);
  });
}

/** Eyelid openness with blinks at the given times (0 = closed). */
export function blink(t: number, times: number[], dur = 0.16): number {
  let o = 1;
  for (const b of times) {
    const d = Math.abs(t - b);
    if (d < dur) o = Math.min(o, d / dur);
  }
  return o;
}

/** Breathing phase value in [-1,1]. */
export const breath = (t: number, rate = 0.25) => Math.sin(t * Math.PI * 2 * rate);

export const between = (t: number, a: number, b: number) => t >= a && t < b;

/** Local 0..1 progress inside [a,b]. */
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
