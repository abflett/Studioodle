import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';

test('lookup cache evicts expensive maps without losing prepared source text or duplicating fetches', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', plugins: [{
    name: 'definition-memory-fixture', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './svgDefinition' && importer?.replaceAll('\\', '/').endsWith('/src/editor/vectorStickers.ts')) return '\0test-definition';
    },
    load(id) { if (id === '\0test-definition') return 'export function decodeSvgDefinition(text) { return JSON.parse(text); }'; },
  }], optimizeDeps: { noDiscovery: true, include: [] } });
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; await Promise.resolve(); return { ok: true, text: async () => JSON.stringify({ typedArrayBytes: 40 * 1024 * 1024 }) }; };
  try {
    const { prepareStickers, vectorDefinition, releaseStickerDefinitions } = await server.ssrLoadModule('/src/editor/vectorStickers.ts');
    await Promise.all([prepareStickers(['garden-house']), prepareStickers(['garden-house'])]);
    assert.equal(fetches, 1);
    const first = vectorDefinition('garden-house');
    await prepareStickers(['fantasy-moon-sorceress']);
    assert.notEqual(vectorDefinition('garden-house'), first, 'Reuse budget must evict a 40 MB definition when another arrives');
    assert.equal(fetches, 2, 'Eviction must retain source text for synchronous restoration');
    releaseStickerDefinitions();
    assert.notEqual(vectorDefinition('garden-house'), first);
    assert.equal(fetches, 2);
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
