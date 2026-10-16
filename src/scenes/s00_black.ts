// 0:00–0:03 — darkness. Distant rain and a heartbeat (sound only); the
// picture breathes with the faintest cold pulse on each beat.
import type { Scene } from '../film';
import { W, H } from '../config';
import { CUE } from '../cues';
import { radial } from '../lib/brush';

const scene: Scene = {
  id: 'black',
  start: 0,
  end: CUE.apartment,
  grain: 0.06,
  draw(ctx, { t }) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    let p = 0;
    for (const b of CUE.heartbeats) {
      const d = t - b;
      if (d > 0 && d < 0.9) p = Math.max(p, Math.exp(-d * 5) * 0.12 + (d > 0.25 ? Math.exp(-(d - 0.25) * 6) * 0.07 : 0));
    }
    ctx.fillStyle = radial(ctx, W / 2, H / 2, 700, [[0, `rgba(70,95,140,${p})`], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, W, H);
  },
};
export default scene;
