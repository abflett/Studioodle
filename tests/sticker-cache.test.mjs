import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSsrServer } from '../scripts/lib/ssr-server.mjs';

test('lookup cache evicts strong ownership while sharing live definitions and clearing idle sources', async () => {
  const server = await createSsrServer({plugins: [{
    name: 'definition-memory-fixture', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './svgDefinition' && importer?.replaceAll('\\', '/').endsWith('/src/editor/vectorStickers.ts')) return '\0test-definition';
    },
    transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/editor/vectorStickers.ts'))return code+'\nexport const cacheState=()=>({entries:definitions.size,lookupBytes,sources:sources.size});';},
    load(id) { if (id === '\0test-definition') return 'export function decodeSvgDefinition(text) { return JSON.parse(text); }'; },
  }]});
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; await Promise.resolve(); return { ok: true, text: async () => JSON.stringify({ typedArrayBytes: 40 * 1024 * 1024 }) }; };
  try {
    const { prepareStickers, vectorDefinition, releaseStickerDefinitions,cacheState } = await server.ssrLoadModule('/src/editor/vectorStickers.ts');
    await Promise.all([prepareStickers(['garden-house']), prepareStickers(['garden-house'])]);
    assert.equal(fetches, 1);
    const first = vectorDefinition('garden-house');
    await prepareStickers(['fantasy-moon-sorceress']);
    assert.equal(cacheState().entries,1);assert.equal(cacheState().lookupBytes,40*1024*1024);
    assert.equal(vectorDefinition('garden-house'), first, 'Eviction must not duplicate a definition still in use');
    assert.equal(fetches, 2, 'Concurrent preparation and live reuse must not refetch');
    releaseStickerDefinitions();
    assert.deepEqual(cacheState(),{entries:0,lookupBytes:0,sources:0});
    assert.equal(vectorDefinition('garden-house'), first, 'An active preview may still own the shared definition');
    assert.equal(fetches, 2);
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
