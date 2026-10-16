// The film = an ordered list of scenes + global post-processing.
// renderFrame(ctx, t) is a pure function of t (plus the subtitle toggle).
import { W, H, FPS, DURATION } from './config';
import { seek } from './timeline';
import { Ctx } from './lib/brush';
import { BAR, grain, letterbox, vignette } from './lib/fx';
import { clamp, smooth } from './lib/math';
import subtitles from './subtitles.json';
import { characters } from './characters';

import s00 from './scenes/s00_black';
import s01 from './scenes/s01_apartment';
import s02 from './scenes/s02_crash';
import s03 from './scenes/s03_rebirth';
import s04 from './scenes/s04_montage';
import s05 from './scenes/s05_magic';
import s06 from './scenes/s06_mira';
import s07 from './scenes/s07_title';

export interface Clock {
  /** absolute film time (s) */
  t: number;
  /** time since scene start */
  lt: number;
  /** scene duration */
  dur: number;
  /** frame index at FPS */
  frame: number;
}

export interface Scene {
  id: string;
  start: number;
  end: number;
  /** film grain strength for this scene */
  grain?: number;
  draw(ctx: Ctx, c: Clock): void;
}

export const scenes: Scene[] = [s00, s01, s02, s03, s04, s05, s06, s07];

export interface Subtitle { start: number; end: number; speaker: string; kind: 'inner' | 'dialogue'; text: string }
const subs = subtitles as Subtitle[];

export function sceneAt(t: number): Scene {
  for (const s of scenes) if (t >= s.start && t < s.end) return s;
  return scenes[scenes.length - 1];
}

export function renderFrame(ctx: Ctx, t: number, opts: { subtitles: boolean; scale: number }) {
  t = clamp(t, 0, DURATION - 1e-6);
  seek(t);
  const q = opts.scale;
  ctx.setTransform(q, 0, 0, q, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const sc = sceneAt(t);
  const frame = Math.round(t * FPS);
  ctx.save();
  sc.draw(ctx, { t, lt: t - sc.start, dur: sc.end - sc.start, frame });
  ctx.restore();
  ctx.setTransform(q, 0, 0, q, 0, 0);
  vignette(ctx, 0.45);
  grain(ctx, frame, sc.grain ?? 0.11);
  letterbox(ctx, 1);
  if (opts.subtitles) drawSubtitles(ctx, t);
}

const SPEAKER_COLORS: Record<string, string> = {
  Selene: '#f3c48e',
  Aldric: '#d9b98c',
  Nolan: '#a9c4ea',
  Joseph: '#f0d7a8',
  Mira: '#f3b3cf',
};

function wrap(ctx: Ctx, text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawSubtitles(ctx: Ctx, t: number) {
  for (const s of subs) {
    if (t < s.start - 0.3 || t > s.end + 0.3) continue;
    const a = smooth(s.start - 0.25, s.start + 0.15, t) * (1 - smooth(s.end - 0.15, s.end + 0.25, t));
    if (a <= 0) continue;
    const inner = s.kind === 'inner';
    const size = 38;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${inner ? 'italic ' : ''}400 ${size}px "Noto Sans", system-ui, sans-serif`;
    const label = inner ? '' : `${characters[s.speaker.toLowerCase() as keyof typeof characters]?.name ?? s.speaker}: `;
    const labelFont = `700 ${size}px "Noto Sans", system-ui, sans-serif`;
    ctx.font = labelFont;
    const lw = label ? ctx.measureText(label).width : 0;
    ctx.font = `${inner ? 'italic ' : ''}400 ${size}px "Noto Sans", system-ui, sans-serif`;
    const lines = wrap(ctx, s.text, 1500 - lw);
    const lh = size * 1.25;
    // centre the block inside the lower cinema bar
    const cy = H - BAR / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      ctx.font = `${inner ? 'italic ' : ''}400 ${size}px "Noto Sans", system-ui, sans-serif`;
      const tw = ctx.measureText(line).width + (i === 0 ? lw : 0);
      let x = W / 2 - tw / 2;
      const y = cy + i * lh;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      if (i === 0 && label) {
        ctx.font = labelFont;
        ctx.fillStyle = SPEAKER_COLORS[s.speaker] ?? '#fff';
        ctx.fillText(label, x, y);
        x += lw;
        ctx.font = `400 ${size}px "Noto Sans", system-ui, sans-serif`;
      }
      ctx.fillStyle = inner ? '#e6ecf5' : '#ffffff';
      ctx.fillText(line, x, y);
    });
    ctx.restore();
  }
}
