// Nolan's cold modern city: skyline seen through glass, and the rainy street.
import { W, H } from '../config';
import { Ctx, ellipse, linear, radial, within } from '../lib/brush';
import { Bokeh, bokehField, drawBokeh, rain } from '../lib/fx';
import { hash, rgba } from '../lib/math';

export const COLD = { sky0: '#0a1222', sky1: '#1a2a44', fog: '#5d7aa6', light: '#cfe3ff', sodium: '#9fb6d9' };

const skylineBokeh: Bokeh[] = bokehField(42, 70, ['#9cc2ff', '#e8f0ff', '#6fa0ff', '#ffd9a0', '#ff8f8f'], [0, 120, W, 700], 6, 34);

/** Distant skyline with lit windows (draw into a layer, then blur for DOF). */
export function skyline(ctx: Ctx, t: number, x0: number, y0: number, w: number, h: number) {
  within(ctx, () => {
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    ctx.fillStyle = linear(ctx, 0, y0, 0, y0 + h, [[0, COLD.sky0], [0.7, COLD.sky1], [1, '#2a3b5a']]);
    ctx.fillRect(x0, y0, w, h);
    // haze glow near horizon
    ctx.fillStyle = radial(ctx, x0 + w * 0.6, y0 + h * 0.9, w * 0.7, [[0, 'rgba(120,150,200,0.35)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(x0, y0, w, h);
    // buildings (two depth rows)
    for (let row = 0; row < 2; row++) {
      let x = x0 - 20;
      let i = 0;
      while (x < x0 + w) {
        const bw = 60 + hash(i, 10 + row) * 120;
        const bh = h * (0.35 + hash(i, 20 + row) * 0.45) * (row ? 0.75 : 1);
        const by = y0 + h - bh;
        ctx.fillStyle = row ? '#101a2c' : '#0b1322';
        ctx.fillRect(x, by, bw, bh);
        // windows
        for (let wy = by + 14; wy < y0 + h - 10; wy += 18) {
          for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
            const on = hash(wx * 7 + wy * 13, i + row) > 0.72;
            if (!on) continue;
            const warm = hash(wx + wy, 5) > 0.8;
            ctx.fillStyle = warm ? 'rgba(255,214,150,0.55)' : 'rgba(170,205,255,0.55)';
            ctx.fillRect(wx, wy, 7, 9);
          }
        }
        // red aviation light
        if (hash(i, 30 + row) > 0.7 && !row) {
          const blinkOn = Math.sin(t * 3 + i) > 0.3 ? 1 : 0.2;
          ellipse(ctx, x + bw / 2, by - 4, 4, 4, `rgba(255,70,70,${blinkOn})`);
        }
        x += bw + 6;
        i++;
      }
    }
    drawBokeh(ctx, skylineBokeh.map((b) => ({ ...b, x: x0 + (b.x / W) * w, y: y0 + ((b.y - 120) / 700) * h })), t, 0.9);
  });
}

/** Rain running down a pane of glass + beads. */
export function glassRain(ctx: Ctx, t: number, x0: number, y0: number, w: number, h: number, seed = 5) {
  within(ctx, () => {
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    // beads
    for (let i = 0; i < 160; i++) {
      const x = x0 + hash(i, seed) * w;
      const y = y0 + hash(i, seed + 1) * h;
      const r = 1.5 + hash(i, seed + 2) * 4;
      ellipse(ctx, x, y, r, r * 1.2, 'rgba(190,210,240,0.22)');
      ellipse(ctx, x - r * 0.3, y - r * 0.4, r * 0.35, r * 0.35, 'rgba(255,255,255,0.4)');
    }
    // runs
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = x0 + hash(i, seed + 5) * w;
      const sp = 60 + hash(i, seed + 6) * 120;
      const len = 40 + hash(i, seed + 7) * 120;
      const y = y0 + ((hash(i, seed + 8) * h + t * sp) % (h + len)) - len;
      const wob = Math.sin(y * 0.05 + i) * 3;
      ctx.strokeStyle = 'rgba(200,220,255,0.25)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + wob, y + len * 0.5, x - wob * 0.5, y + len);
      ctx.stroke();
      ellipse(ctx, x - wob * 0.5, y + len, 3.5, 4.5, 'rgba(220,235,255,0.45)');
    }
  });
}

/** Street-level background used for the exit and the crossing. */
export function street(ctx: Ctx, t: number, rainClock: number, opts: { crosswalk?: boolean; camX?: number; doorLight?: number; rainAlpha?: number; signal?: number }) {
  const horizon = 520;
  const camX = opts.camX ?? 0;
  // sky
  ctx.fillStyle = linear(ctx, 0, 0, 0, horizon, [[0, '#060b16'], [1, '#1b2940']]);
  ctx.fillRect(0, 0, W, horizon + 10);
  // background towers
  within(ctx, () => {
    ctx.translate(-camX * 0.3, 0);
    let x = -200, i = 0;
    while (x < W + 400) {
      const bw = 120 + hash(i, 61) * 160, bh = 200 + hash(i, 62) * 260;
      ctx.fillStyle = '#0c1424';
      ctx.fillRect(x, horizon - bh, bw, bh);
      for (let wy = horizon - bh + 16; wy < horizon - 10; wy += 22) for (let wx = x + 10; wx < x + bw - 12; wx += 18) {
        if (hash(wx * 3 + wy, i) > 0.78) {
          ctx.fillStyle = 'rgba(160,195,240,0.45)';
          ctx.fillRect(wx, wy, 8, 11);
        }
      }
      x += bw + 10;
      i++;
    }
  });
  // near building with entrance (left)
  within(ctx, () => {
    ctx.translate(-camX, 0);
    ctx.fillStyle = '#121a2a';
    ctx.fillRect(-300, 80, 900, horizon + 260);
    ctx.fillStyle = '#0d1320';
    for (let k = 0; k < 6; k++) ctx.fillRect(-300 + k * 150, 80, 6, horizon + 200);
    // entrance
    const dl = opts.doorLight ?? 0;
    ctx.fillStyle = `rgba(150,180,220,${0.25 + dl * 0.4})`;
    ctx.fillRect(330, 560, 180, 260);
    ctx.fillStyle = radial(ctx, 420, 700, 380, [[0, `rgba(170,200,240,${0.25 + dl * 0.3})`], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 300, 900, 700);
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(320, 548, 200, 14);
  });
  // road & sidewalk
  ctx.fillStyle = linear(ctx, 0, horizon, 0, H, [[0, '#121a28'], [1, '#0a0f18']]);
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.fillStyle = '#1a2232';
  ctx.fillRect(0, 812, W, 18); // curb
  ctx.fillStyle = '#161e2c';
  ctx.fillRect(0, 760, W, 52);
  // street lamps + wet reflections
  const lamps = [700, 1350, 1950, 2550];
  for (const lx0 of lamps) {
    const lx = lx0 - camX * 0.9;
    if (lx < -300 || lx > W + 300) continue;
    ctx.fillStyle = '#0b101b';
    ctx.fillRect(lx - 5, 250, 10, 520);
    ctx.fillRect(lx - 5, 250, 70, 8);
    ellipse(ctx, lx + 62, 262, 18, 7, '#eaf3ff');
    // light cone
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      const g = linear(ctx, lx + 62, 262, lx + 62, 800, [[0, 'rgba(190,215,255,0.2)'], [1, 'rgba(190,215,255,0)']]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lx + 50, 262);
      ctx.lineTo(lx + 74, 262);
      ctx.lineTo(lx + 260, 800);
      ctx.lineTo(lx - 140, 800);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, lx + 62, 262, 120, 120, radial(ctx, lx + 62, 262, 120, [[0, 'rgba(210,230,255,0.5)'], [1, 'rgba(210,230,255,0)']]));
      // broken, shimmering reflection on wet asphalt
      for (let k = 0; k < 16; k++) {
        const y = 836 + k * 15;
        const wob = Math.sin(t * 3 + k * 1.7 + lx) * 6;
        const ww = 18 + hash(k, lx | 0) * 40;
        ctx.fillStyle = `rgba(180,205,245,${0.28 * (1 - k / 16)})`;
        ctx.fillRect(lx + 62 - ww / 2 + wob, y, ww, 5);
      }
    });
  }
  // crosswalk
  if (opts.crosswalk) {
    for (let i = 0; i < 9; i++) {
      const y = 860 + i * 26;
      const persp = 1 + (y - 860) / 300;
      ctx.fillStyle = `rgba(215,225,240,${0.55 - i * 0.02})`;
      const cx = 960 - camX * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - 260 * persp, y);
      ctx.lineTo(cx + 260 * persp, y);
      ctx.lineTo(cx + 262 * persp, y + 12 * persp);
      ctx.lineTo(cx - 262 * persp, y + 12 * persp);
      ctx.fill();
    }
    // pedestrian signal (green walker) on a pole
    const sx = 1500 - camX * 0.9;
    ctx.fillStyle = '#0b101b';
    ctx.fillRect(sx - 4, 470, 8, 330);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(sx - 34, 420, 68, 90);
    const sig = opts.signal ?? 1;
    ellipse(ctx, sx, 466, 22, 30, radial(ctx, sx, 466, 60, [[0, `rgba(120,255,200,${0.7 * sig})`], [1, 'rgba(120,255,200,0)']]));
    ctx.fillStyle = `rgba(160,255,215,${sig})`;
    ellipse(ctx, sx, 446, 6, 6, ctx.fillStyle as string);
    ctx.fillRect(sx - 5, 454, 10, 22);
    ctx.fillRect(sx - 9, 474, 6, 16);
    ctx.fillRect(sx + 3, 474, 6, 16);
  }
  // rain + splashes
  rain(ctx, rainClock, { count: 420, speed: 1700, len: 46, angle: 0.12, alpha: opts.rainAlpha ?? 0.5, seed: 3 });
  for (let i = 0; i < 40; i++) {
    const period = 0.5 + hash(i, 71) * 0.5;
    const ph = ((rainClock + hash(i, 72) * period) % period) / period;
    const x = hash(i, 73) * W, y = 840 + hash(i, 74) * 220;
    ctx.strokeStyle = `rgba(200,220,255,${0.35 * (1 - ph)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + ph * 18, 1.5 + ph * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // ground mist
  ctx.fillStyle = linear(ctx, 0, 700, 0, 900, [[0, 'rgba(90,115,160,0)'], [0.5, 'rgba(90,115,160,0.12)'], [1, 'rgba(90,115,160,0)']]);
  ctx.fillRect(0, 700, W, 200);
  void t;
}

export { rgba };
