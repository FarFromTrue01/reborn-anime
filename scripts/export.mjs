// npm run export
// Renders the film frame by frame (1080p30 PNG) in headless Chromium, renders
// the soundtrack with Tone.Offline (WAV), and muxes both into
// export/reborn-prolog.mp4 with ffmpeg.
//
//   WORKERS=4      parallel browser pages (default: CPU count, max 4)
//   KEEP_FRAMES=1  also keep every PNG in export/frames/
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { cpus } from 'node:os';
import { startServer } from './server.mjs';

const OUT = 'export';
const FPS = 30;
const keep = process.env.KEEP_FRAMES === '1';
mkdirSync(OUT, { recursive: true });
if (keep) mkdirSync(`${OUT}/frames`, { recursive: true });

const { url, close } = await startServer();
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(`${url}?export`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  return page;
}

const t0 = Date.now();
const first = await openPage();
const info = await first.evaluate(() => ({ duration: window.__film.DURATION, fps: window.__film.FPS }));
const total = Math.round(info.duration * FPS);
console.log(`Film: ${info.duration}s → ${total} frames @ ${FPS}fps`);

// 1) soundtrack
console.log('Rendering soundtrack (Tone.Offline)…');
const b64 = await first.evaluate(() => window.__film.audio());
writeFileSync(`${OUT}/audio.wav`, Buffer.from(b64, 'base64'));
console.log(`  audio.wav written (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

// 2) frames, split into contiguous ranges, each piped into its own encoder
const workers = Math.max(1, Math.min(Number(process.env.WORKERS ?? Math.min(4, cpus().length)), 8));
const per = Math.ceil(total / workers);
let done = 0;
async function renderRange(k, page) {
  const a = k * per, b = Math.min(total, a + per);
  const seg = `${OUT}/seg${k}.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const finished = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  const canvas = await page.$('#screen');
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.__film.render(t), f / FPS);
    const png = await canvas.screenshot({ type: 'png' });
    if (keep) writeFileSync(`${OUT}/frames/f${String(f).padStart(5, '0')}.png`, png);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 60 === 0) console.log(`  frames ${done}/${total}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await finished;
  return seg;
}
const pages = [first];
for (let k = 1; k < workers; k++) pages.push(await openPage());
const segs = await Promise.all(pages.map((p, k) => renderRange(k, p)));
await browser.close();
await close();

// 3) mux
writeFileSync(`${OUT}/segments.txt`, segs.map((s) => `file '${s.replace(`${OUT}/`, '')}'`).join('\n'));
const mp4 = `${OUT}/reborn-prolog.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${OUT}/segments.txt`, '-i', `${OUT}/audio.wav`,
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(info.duration), '-movflags', '+faststart', mp4], { stdio: 'inherit' });
segs.forEach((s) => rmSync(s));
rmSync(`${OUT}/segments.txt`);

const probe = (stream) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', stream, '-show_entries', 'stream=duration,nb_frames', '-of', 'csv=p=0', mp4]).toString().trim();
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${mp4}`);
console.log(`  video (duration,frames): ${probe('v:0')}`);
console.log(`  audio (duration):        ${probe('a:0')}`);
