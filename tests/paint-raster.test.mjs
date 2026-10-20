import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server, resize, density, valid;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  ({ resizeStickerPaint: resize, stickerPaintScale: density } = await server.ssrLoadModule('/src/editor/paintRaster.ts'));
  ({ isSavedPicture: valid } = await server.ssrLoadModule('/src/editor/pictureValidation.ts'));
});
after(async () => { await server?.close(); });

test('sticker raster density grows in bounded steps and never discards detail on shrink', () => {
  assert.equal(density(340, 480, 1), 1);
  assert.equal(density(340, 480, 1.1), 2);
  assert.equal(density(340, 480, 4), 4);
  assert.equal(density(340, 480, .5, 4), 4);
  assert.equal(density(1440, 1440, 4), 1);
});

test('solid regions recover their exact bounds without painting adjacent empty regions', () => {
  const region = (x, y) => y >= 0 && y < 2 && x >= .3 && x < 3.8 ? x < 1.8 ? 1 : 2 : 0;
  const old = new Uint32Array([0, 0xcc4489, 0, 0, 0, 0xcc4489, 0, 0]);
  const paint = resize(old, 4, 2, 1, 16, 8, 4, region);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    assert.equal(paint[y * 16 + x], region(x / 4, y / 4) === 1 ? 0xcc4489 : 0);
  }
});

test('mixed brush colors use nearest neighbors without blending or crossing regions', () => {
  const region = (x, y) => x >= 0 && x < 4 && y >= 0 && y < 2 ? x < 1.8 ? 1 : 2 : 0;
  const old = new Uint32Array([0xff0001, 0x000100, 0x000001, 0, 0, 0xff0001, 0, 0x000001]);
  const paint = resize(old, 4, 2, 1, 16, 8, 4, region);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const value = paint[y * 16 + x];
    assert.ok((region(x / 4, y / 4) === 1 ? [0, 0xff0001, 0x000100] : [0, 0x000001]).includes(value));
  }
  assert.ok(paint.includes(0xff0001)); assert.ok(paint.includes(0x000100));
  assert.ok(paint.includes(0x000001)); assert.ok(paint.includes(0));
});

function picture() {
  return { version: 3, id: 'test', title: 'Test', format: 'landscape', size: { width: 100, height: 70 }, background: '#ffffff', leafColor: 0, updatedAt: 1,
    document: { version: 3, width: 100, height: 70, surfaces: [
      { id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
      { id: 'sticker', kind: 'fantasy-moon-sorceress', x: 50, y: 35, color: 0, scale: 4, paint: [] },
    ] } };
}
test('saved pictures accept legacy rasters and explicit density without misreading pixel runs', () => {
  const p = picture(); assert.equal(valid(p), true);
  const sticker = p.document.surfaces[1];
  sticker.paintScale = 4; sticker.paint = [[1_000_000, 3, 0xabcdef]];
  assert.equal(valid(p), true);
  delete sticker.paintScale; assert.equal(valid(p), false);
  sticker.paintScale = 3; assert.equal(valid(p), false);
  sticker.paintScale = 4; p.document.surfaces[0].paintScale = 2;
  assert.equal(valid(p), false);
  p.document.surfaces[0].paintScale = 1;
  sticker.kind = 'spring-meadow';
  assert.equal(valid(p), false); // Reject an oversized upgraded raster.
});
