import { createServer, mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/** Headless source loading for tests/authoring, with no listeners or dev-cache writes. */
export function createSsrServer(options = {}) {
  return createServer(mergeConfig({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    configFile: false,
    cacheDir: fileURLToPath(new URL('../../work/tests/vite-cache/ssr-' + process.pid, import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  }, options));
}
