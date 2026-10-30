import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('normal development serves only the app entry and rejects reviewer source', async () => {
  const server = await createServer({
    configFile: 'vite/config.dev.ts',
    server: { host: '127.0.0.1', port: 0, open: false, watch: null },
  });
  try {
    await server.listen();
    const origin = server.resolvedUrls.local[0];
    assert.equal((await fetch(origin)).status, 200);
    for (const route of ['artwork-review.html', 'tools/artwork-review/src/artworkReviewMain.tsx', 'tools/cell-brush/index.html', 'tools/cell-brush/src/main.ts']) {
      assert.equal((await fetch(new URL(route, origin))).status, 404);
    }
    assert.deepEqual(server.config.optimizeDeps.entries, ['index.html']);
    assert.equal(server.config.build.rollupOptions.input, 'index.html');
    assert.equal([...server.environments.client.moduleGraph.idToModuleMap.keys()]
      .some(id => id.replaceAll('\\', '/').includes('/tools/artwork-review/')), false);
  } finally {
    await server.close();
  }
});
