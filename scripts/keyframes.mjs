// Render selected frames to PNG for visual QA.
//   npm run frames                → default key times of every scene
//   npm run frames -- 4.2 9.6     → specific times (seconds)
// Uses a running dev server if FILM_URL is set, otherwise builds + previews.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startServer } from './server.mjs';

const DEFAULT = [1.5, 4.5, 7.0, 9.8, 11.5, 13.8, 15.8, 17.1, 18.0, 19.2, 20.6, 22.0, 24.5, 27.5, 31.0, 33.6, 35.0, 36.3, 37.8, 40.0, 42.2, 44.4, 47.0, 50.2, 52.8, 55.8, 58.0, 59.6];
const args = process.argv.slice(2);
const times = args.length ? args.map(Number) : DEFAULT;
const outDir = process.env.OUT ?? 'export/keyframes';
mkdirSync(outDir, { recursive: true });

const { url, close } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
await page.goto(`${url}?export`);
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
const canvas = await page.$('#screen');
for (const t of times) {
  await page.evaluate((t) => window.__film.render(t), t);
  const file = `${outDir}/t${t.toFixed(2).padStart(5, '0')}.png`;
  await canvas.screenshot({ path: file });
  console.log(file);
}
await browser.close();
await close();
