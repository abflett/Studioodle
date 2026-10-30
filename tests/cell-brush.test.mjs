import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';

let server, model;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  model = await server.ssrLoadModule('/tools/cell-brush/src/model.ts');
});
after(async () => { await server?.close(); });

function inside(polygon, x, y) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function sample(labels, x, y) {
  let color = Math.min(...labels);
  for (const patch of model.patches(labels)) if (inside(patch.polygon, x, y)) color = patch.slot;
  return color;
}

test('all binary configurations preserve corner labels and share matching edge crossings', () => {
  assert.equal(model.profiles.length, 8);
  for (let mask = 0; mask < 16; mask++) {
    const labels = [0, 1, 2, 3].map(i => (mask >> i) & 1);
    for (let i = 0; i < 4; i++) {
      const [x, y] = model.corners[i];
      assert.equal(sample(labels, x ? .999 : .001, y ? .999 : .001), labels[i], `corner ${i}, mask ${mask}`);
    }
  }
  // Binary and exceptional cells must agree across an edge regardless of their
  // other corner colors. Exercise all four-color endpoint/interior combinations.
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++) {
      const left = [c, a, b, d], right = [a, d, c, b];
      const top = [c, d, b, a], bottom = [a, b, d, c];
      for (const t of [.13, .37, .63, .87]) {
        assert.equal(sample(left, .99999, t), sample(right, .00001, t));
        assert.equal(sample(top, t, .99999), sample(bottom, t, .00001));
      }
    }
  }
});

test('long strokes remain connected and repeated painting has fixed authoritative storage', () => {
  const field = new model.CellField();
  const dirty = field.paint([0, 50], [100, 50], 2, 3);
  assert.ok(dirty.size > 100);
  for (let x = 0; x <= 100; x++) assert.equal(field.labels[50 * 101 + x], 3);
  const first = field.labels.slice();
  for (let i = 0; i < 1000; i++) assert.equal(field.paint([0, 50], [100, 50], 2, 3).size, 0);
  assert.deepEqual(field.labels, first);
  assert.equal(field.labels.byteLength, 10201);
  field.paint([-10, 50], [110, 50], 3, 0);
  assert.ok(field.labels.every(slot => slot === 0));
});
