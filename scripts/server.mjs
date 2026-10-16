// Serves the film for Playwright: FILM_URL (e.g. a running `npm run dev`) or a fresh build.
import { build, preview } from 'vite';

export async function startServer() {
  if (process.env.FILM_URL) return { url: process.env.FILM_URL, close: async () => {} };
  await build({ logLevel: 'warn', base: './' });
  const server = await preview({ preview: { port: 4179, strictPort: false, host: '127.0.0.1' }, logLevel: 'warn' });
  const url = server.resolvedUrls.local[0];
  return { url, close: () => server.httpServer.close() };
}
