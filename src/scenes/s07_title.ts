// 0:57–1:00 — Title card: "REBORN in ELONTH", slow fade to black.
import type { Scene } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { keys } from '../timeline';
import { linear, radial, within } from '../lib/brush';
import { dust, rays, wash } from '../lib/fx';
import { easeOut, rgba, smooth } from '../lib/math';

const st = { reveal: 0, spacing: 0.5, sweep: -0.3 };
keys(st, 'reveal', [[CUE.title + 0.1, 0], [CUE.title + 1.3, 1, 'power2.out']]);
keys(st, 'spacing', [[CUE.title, 0.5], [CUE.end, 0.18, 'power1.out']]);
keys(st, 'sweep', [[CUE.title + 0.6, -0.3], [CUE.title + 2.0, 1.3, 'power1.inOut']]);

const scene: Scene = {
  id: 'title',
  start: CUE.title,
  end: CUE.end,
  grain: 0.08,
  draw(ctx, { t }) {
    ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, '#0b0705'], [0.5, '#1d120a'], [1, '#0b0705']]);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = radial(ctx, W / 2, H / 2, 900, [[0, 'rgba(255,190,110,0.18)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, W, H);
    rays(ctx, W / 2, -200, Math.PI / 2, 0.9, 10, 1400, '#ffd38a', 0.08, t, 4);
    dust(ctx, t, 70, '#ffd38a', 0.5, 51);

    const r = st.reveal;
    within(ctx, () => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = r;
      const gold = linear(ctx, 0, 420, 0, 560, [[0, '#fff1c8'], [0.5, '#e9c27a'], [1, '#a8742e']]);
      const sp = st.spacing;
      const spaced = (txt: string, size: number, font: string) => {
        ctx.font = `${font} ${size}px "Cinzel", serif`;
        const chars = [...txt];
        const widths = chars.map((ch) => ctx.measureText(ch).width);
        const total = widths.reduce((a, b) => a + b, 0) + size * sp * (chars.length - 1);
        return { chars, widths, total, size, font };
      };
      // manual letter spacing (canvas letterSpacing isn't universal)
      const put = (m: ReturnType<typeof spaced>, x0: number, y: number) => {
        ctx.font = `${m.font} ${m.size}px "Cinzel", serif`;
        let cx = x0;
        m.chars.forEach((ch, i) => {
          ctx.fillText(ch, cx + m.widths[i] / 2, y);
          cx += m.widths[i] + m.size * sp;
        });
      };
      const draw = (txt: string, x: number, y: number, size: number, font: string) => {
        const m = spaced(txt, size, font);
        put(m, x - m.total / 2, y);
      };
      const a1 = spaced('REBORN', 112, '600');
      const a2 = spaced('ELONTH', 112, '600');
      ctx.font = '400 52px "Cinzel", serif';
      const inW = ctx.measureText('in').width;
      const gap = 46;
      const total = a1.total + gap + inW + gap + a2.total;
      const x0 = W / 2 - total / 2;
      ctx.shadowColor = 'rgba(255,190,100,0.55)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = gold;
      put(a1, x0, 560);
      put(a2, x0 + a1.total + gap + inW + gap, 560);
      ctx.fillStyle = '#f3dfb4';
      ctx.font = '400 52px "Cinzel", serif';
      ctx.fillText('in', x0 + a1.total + gap + inW / 2, 552);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = r * smooth(CUE.title + 0.9, CUE.title + 1.8, t);
      ctx.fillStyle = '#cdb68c';
      draw('PROLOG', W / 2, 660, 34, '600');
      ctx.strokeStyle = rgba('#e9c27a', 0.7);
      ctx.lineWidth = 2;
      const lw = 260 * easeOut(smooth(CUE.title + 0.9, CUE.title + 2.0, t));
      ctx.beginPath();
      ctx.moveTo(W / 2 - 150 - lw, 648);
      ctx.lineTo(W / 2 - 150, 648);
      ctx.moveTo(W / 2 + 150, 648);
      ctx.lineTo(W / 2 + 150 + lw, 648);
      ctx.stroke();
    });
    // light sweep across the letters
    within(ctx, () => {
      ctx.globalCompositeOperation = 'lighter';
      const x = W * st.sweep;
      ctx.translate(x, 530);
      ctx.scale(1.6, 0.6);
      ctx.fillStyle = radial(ctx, 0, 0, 260, [[0, 'rgba(255,230,180,0.25)'], [1, 'rgba(255,230,180,0)']]);
      ctx.fillRect(-300, -300, 600, 600);
    });
    // fade in from the previous shot, slow fade to black at the end
    wash(ctx, '#000', 1 - smooth(CUE.title, CUE.title + 0.4, t));
    wash(ctx, '#000', smooth(CUE.end - 1.4, CUE.end - 0.05, t));
  },
};
export default scene;
