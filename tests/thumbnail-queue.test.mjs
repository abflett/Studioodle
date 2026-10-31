import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createSsrServer } from '../scripts/lib/ssr-server.mjs';
let server, createThumbnailQueue;
before(async () => {
  server = await createSsrServer();
  ({ createThumbnailQueue } = await server.ssrLoadModule('/src/app/thumbnailQueue.ts'));
});
after(async () => { await server?.close(); });

test('thumbnail generation retains only one running and the latest waiting task', async () => {
  const queue = createThumbnailQueue(), calls = []; let finish;
  const first = queue.run(() => { calls.push('first'); return new Promise(resolve => { finish = resolve; }); });
  await new Promise(setImmediate);
  const obsolete = queue.run(async () => { calls.push('obsolete'); return 2; }).catch(error => error.name);
  const latest = queue.run(async () => { calls.push('latest'); return 3; });
  assert.equal(await obsolete, 'AbortError');
  assert.deepEqual(queue.stats(), { active: true, pending: true });
  finish(1); assert.equal(await first, 1); assert.equal(await latest, 3);
  await new Promise(setImmediate);
  assert.deepEqual(calls, ['first', 'latest']);
  assert.deepEqual(queue.stats(), { active: false, pending: false });
});

test('cancelling a queued preview never starts its generation', async () => {
  const queue = createThumbnailQueue(); let finish, called = false;
  const first = queue.run(() => new Promise(resolve => { finish = resolve; })); await new Promise(setImmediate);
  const controller = new AbortController();
  const canceled = queue.run(async () => { called = true; }, controller.signal).catch(error => error.name);
  controller.abort(); assert.equal(await canceled, 'AbortError');
  assert.deepEqual(queue.stats(), { active: true, pending: false });
  finish(); await first; await new Promise(setImmediate); assert.equal(called, false);
});
