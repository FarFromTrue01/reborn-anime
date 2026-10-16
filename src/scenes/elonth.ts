// Elonth: warm amber/gold cottage interiors (timber, plaster, drying herbs).
import { W, H } from '../config';
import { Ctx, ellipse, fillPoly, ink, inkS, linear, radial, spline, taper, within } from '../lib/brush';
import { dust, rays } from '../lib/fx';
import { hash, lerp, mix, noise1, P, rgba } from '../lib/math';

export const WARM = {
  wood: '#5b3a22', woodDark: '#3a2414', woodLight: '#8a5a33', plaster: '#d9b88a', plasterShadow: '#a8845a',
  sun: '#ffd58a', sunHot: '#fff0c8', amber: '#ffb35a', night: '#1a1020',
};

/** A bundle of dried herbs hanging from a beam. */
export function herbBundle(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number) {
  within(ctx, () => {
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.8 + seed) * 0.04);
    ctx.scale(s, s);
    inkS(ctx, [P(0, 0), P(0, 30)], 3, '#6b4a2a', () => 1);
    const cols = ['#7d8a4a', '#9a8a55', '#6b7a45', '#8a6a9a', '#b0a060'];
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.12 + (hash(i, seed) - 0.5) * 0.1;
      const len = 90 + hash(i, seed + 1) * 50;
      const c = cols[Math.floor(hash(i, seed + 2) * cols.length)];
      inkS(ctx, [P(0, 30), P(Math.sin(a) * len * 0.5, 30 + len * 0.5), P(Math.sin(a) * len, 30 + len)], 6, c, taper);
      for (let k = 0; k < 4; k++) {
        const u = 0.4 + k * 0.15;
        ellipse(ctx, Math.sin(a) * len * u + (k % 2 ? 6 : -6), 30 + len * u, 7, 3.5, c, (k % 2 ? 0.6 : -0.6) + a);
      }
    }
    ellipse(ctx, 0, 34, 10, 6, '#c9a46a');
  });
}

/** POV of a baby lying in a cradle, looking up at the ceiling beams. */
export function ceilingPOV(ctx: Ctx, t: number) {
  // plank ceiling, lit from a window at the top-left
  ctx.fillStyle = linear(ctx, 0, 0, W, H, [[0, '#f3d3a0'], [0.45, '#c99a62'], [1, '#7a4f2c']]);
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const x = -400 + i * 110;
    ctx.strokeStyle = rgba(WARM.woodDark, 0.25);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, -50);
    ctx.lineTo(x + 520, H + 50);
    ctx.stroke();
  }
  // big rafters crossing the frame
  const rafters = [140, 560, 980];
  rafters.forEach((y, i) => {
    const th = 120 + i * 30;
    fillPoly(ctx, [P(-100, y - 60), P(W + 100, y + 60), P(W + 100, y + 60 + th), P(-100, y - 60 + th)], rgba(WARM.woodDark, 0.92));
    fillPoly(ctx, [P(-100, y - 60), P(W + 100, y + 60), P(W + 100, y + 76), P(-100, y - 44)], rgba(WARM.woodLight, 0.8));
  });
  // herb bundles hanging toward the camera
  herbBundle(ctx, 300, 160, 1.6, t, 1);
  herbBundle(ctx, 1600, 230, 1.9, t, 2);
  herbBundle(ctx, 1150, 210, 1.2, t, 3);
  // window light pouring in from top-left
  rays(ctx, -100, -150, 0.85, 0.5, 7, 1900, WARM.sun, 0.12, t, 5);
  ctx.fillStyle = radial(ctx, 200, 100, 1000, [[0, rgba(WARM.sunHot, 0.75)], [1, rgba(WARM.sunHot, 0)]]);
  ctx.fillRect(0, 0, W, H);
}

/** Plaster & timber wall with a small window (medium shots). */
export function cottageWall(ctx: Ctx, t: number, o: { window?: number; night?: number } = {}) {
  const night = o.night ?? 0;
  ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, mix(WARM.plaster, '#2a1a20', night)], [1, mix(WARM.plasterShadow, '#140c12', night)]]);
  ctx.fillRect(0, 0, W, H);
  // plaster texture blotches
  for (let i = 0; i < 40; i++) {
    const x = hash(i, 201) * W, y = hash(i, 202) * H;
    ellipse(ctx, x, y, 40 + hash(i, 203) * 90, 20 + hash(i, 204) * 50, rgba(mix('#b8905e', '#000000', night), 0.12));
  }
  // timber frame
  const beam = mix(WARM.wood, '#120a0a', night * 0.7);
  ctx.fillStyle = beam;
  ctx.fillRect(0, 160, W, 46);
  ctx.fillRect(0, 900, W, 50);
  for (const x of [120, 760, 1420]) ctx.fillRect(x, 160, 44, 790);
  fillPoly(ctx, [P(164, 206), P(214, 206), P(760, 860), P(710, 860)], beam);
  // window
  const wx = o.window ?? 980;
  if (wx > -1000) {
    ctx.fillStyle = mix('#2a1a10', '#08060a', night);
    ctx.fillRect(wx - 12, 300, 284, 344);
    const sky = night ? linear(ctx, 0, 310, 0, 630, [[0, '#0b1030'], [1, '#2a2048']]) : linear(ctx, 0, 310, 0, 630, [[0, '#fff3d0'], [1, '#ffd38a']]);
    ctx.fillStyle = sky;
    ctx.fillRect(wx, 312, 260, 320);
    ctx.fillStyle = mix('#3a2414', '#0a0608', night);
    ctx.fillRect(wx + 124, 312, 12, 320);
    ctx.fillRect(wx, 466, 260, 12);
    if (!night) rays(ctx, wx + 130, 470, 2.3, 0.5, 10, 1200, WARM.sun, 0.18, t, 7);
  }
  // shelf with herb jars
  ctx.fillStyle = beam;
  ctx.fillRect(260, 560, 420, 18);
  for (let i = 0; i < 6; i++) {
    const x = 290 + i * 66, h = 60 + hash(i, 205) * 40;
    const c = ['#7d8a4a', '#a0603a', '#5a7a6a', '#c9a46a', '#7a5a8a', '#8a9a5a'][i];
    fillPoly(ctx, spline([P(x, 560), P(x - 4, 560 - h * 0.6), P(x + 6, 560 - h), P(x + 34, 560 - h), P(x + 44, 560 - h * 0.6), P(x + 40, 560)], true, 6), rgba(mix('#e8e0c8', '#000', night), 0.55));
    ellipse(ctx, x + 20, 560 - h * 0.35, 16, h * 0.28, rgba(mix(c, '#000', night), 0.8));
    fillPoly(ctx, [P(x + 8, 560 - h - 10), P(x + 32, 560 - h - 10), P(x + 32, 560 - h), P(x + 8, 560 - h)], mix('#8a5a33', '#000', night));
  }
  herbBundle(ctx, 1640, 206, 1.3, t, 9);
  herbBundle(ctx, 1760, 206, 1.1, t, 10);
}

/** Warm sun haze + motes over the frame. */
export function warmAir(ctx: Ctx, t: number, amount = 1) {
  dust(ctx, t, 60, WARM.sunHot, 0.35 * amount, 21);
  ctx.fillStyle = radial(ctx, W * 0.2, H * 0.1, W * 0.9, [[0, rgba(WARM.sunHot, 0.25 * amount)], [1, rgba(WARM.sunHot, 0)]]);
  ctx.fillRect(0, 0, W, H);
}

/** Candle with a flickering flame and glow. */
export function candle(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number) {
  const f = 0.85 + noise1(t * 6, seed) * 0.15;
  within(ctx, () => {
    ctx.translate(x, y);
    ctx.scale(s, s);
    // glow
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      ellipse(ctx, 0, -70, 260 * f, 260 * f, radial(ctx, 0, -70, 260 * f, [[0, rgba('#ffb35a', 0.45)], [0.4, rgba('#ff8a3a', 0.15)], [1, 'rgba(255,120,40,0)']]));
    });
    // body
    fillPoly(ctx, spline([P(-22, 0), P(-22, -60), P(-10, -64), P(8, -60), P(22, -62), P(22, 0)], true, 6), '#efe2c4');
    fillPoly(ctx, [P(6, -60), P(22, -62), P(22, 0), P(8, 0)], '#d2bf98');
    inkS(ctx, [P(-14, -62), P(-16, -40), P(-12, -30)], 6, '#f8efd8', taper);
    ink(ctx, [P(0, -62), P(0, -74)], 2, '#2a1a10', () => 1);
    // flame
    const sway = noise1(t * 4, seed + 1) * 4;
    fillPoly(ctx, spline([P(0, -70), P(-8, -86), P(sway, -112 * f), P(8, -86)], true, 8), '#ffb347');
    fillPoly(ctx, spline([P(0, -72), P(-4, -84), P(sway * 0.6, -98 * f), P(4, -84)], true, 8), '#fff4c8');
  });
}

export { ink };
