import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createSsrServer } from '../scripts/lib/ssr-server.mjs';

let server, paperSize, presetSize;
before(async () => {
  server = await createSsrServer();
  ({ paperSize } = await server.ssrLoadModule('/src/editor/document.ts'));
  ({ presetSize } = await server.ssrLoadModule('/src/editor/paperPresets.ts'));
});
after(async () => { await server?.close(); });

test('new-page presets and fallback page dimensions agree on A4 at 96 logical units per inch', () => {
  assert.deepEqual(presetSize('full', 'portrait'), { width: 794, height: 1123 });
  assert.deepEqual(presetSize('full', 'landscape'), { width: 1123, height: 794 });
  assert.deepEqual(paperSize('portrait'), presetSize('full', 'portrait'));
  assert.deepEqual(paperSize('landscape'), presetSize('full', 'landscape'));
  const square = paperSize('square'); assert.equal(square.width, square.height);
  assert.deepEqual(paperSize('portrait', { width: 320, height: 500 }), { width: 320, height: 500 });
});

test('every bundled coloring page uses matching A4 document and page dimensions', async () => {
  const book = JSON.parse(await readFile(new URL('../src/assets/coloringBook.json', import.meta.url), 'utf8'));
  assert.ok(book.pages.length > 0);
  for (const page of book.pages) {
    assert.deepEqual(page.size, presetSize('full', page.format), page.title);
    assert.equal(page.document.width, page.size.width, page.title);
    assert.equal(page.document.height, page.size.height, page.title);
  }
});
