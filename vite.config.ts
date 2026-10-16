import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo>/; BASE can override it (e.g. "/" locally).
export default defineConfig({
  base: process.env.BASE ?? './',
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
