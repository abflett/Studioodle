import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './', publicDir: false,
  cacheDir: '../../node_modules/.vite-cell-brush',
  server: { port: 1434, strictPort: true },
  build: { outDir: '../../work/cell-brush-dist', emptyOutDir: true },
});
