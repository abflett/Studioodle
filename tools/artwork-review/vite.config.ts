import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  publicDir: false,
  plugins: [react()],
  cacheDir: '../../node_modules/.vite-review',
  optimizeDeps: { entries: ['artwork-review.html'] },
  server: {
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
  build: {
    // Keep original SVG bytes intact for annotation revision hashes.
    assetsInlineLimit: 0,
    outDir: '../../work/artwork-review-dist',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('artwork-review.html', import.meta.url)) },
  },
});
