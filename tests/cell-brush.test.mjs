import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';

let server, model;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  model = await server.ssrLoadModule('/tools/cell-brush/src/model.ts');
});
after(async () => { await server?.close(); });
const snapshot = field => [field.profile.slice(), field.front.slice(), field.back.slice()];

test('coverage selects diagonal and straight profiles and every cell stores at most two slots', () => {
  assert.equal(model.profiles.length, 8);
  const field = new model.CellField();
  field.paint([5.2, 8.7], [90.3, 73.6], 3.7, 2);
  assert.ok(field.profile.some(profile => profile >= 4), 'Diagonal brush edge profiles');
  field.endStroke();
  field.paint([10, 80], [85, 15], 2.3, 5);
  field.endStroke();
  field.paint([50, 10], [50, 90], 2.5, 3);
  assert.ok(field.profile.some(profile => profile === 2), 'Vertical half-cell brush edge');
  assert.equal(field.byteLength, 30000);
  for (let i = 0; i < 10000; i++) {
    const cell = field.cell(i);
    assert.ok(cell.profile >= 0 && cell.profile < 8);
    const colors = new Set();
    for (const x of [.1, .3, .7, .9]) for (const y of [.1, .3, .7, .9]) colors.add(field.colorAt(i % 100 + x, Math.floor(i / 100) + y));
    assert.ok(colors.size <= 2);
  }
});

test('overpainting a blue/paper cell replaces the paper instead of leaving a third-color cross', () => {
  const field = new model.CellField(), index = 50 * 100 + 50;
  field.profile[index] = 2; field.front[index] = 5;
  field.paint([50.75, 49], [50.75, 52], .3, 2);
  for (const x of [.1, .3, .7, .9]) for (const y of [.1, .3, .7, .9]) {
    assert.ok([2, 5].includes(field.colorAt(50 + x, 50 + y)), 'Covered paper must not survive as a hole');
  }
  assert.equal(field.colorAt(50.1, 50.5), 5);
  assert.equal(field.colorAt(50.9, 50.5), 2);
});

test('stroke fitting is independent of pointer segmentation and does not edit untouched neighbors', () => {
  const whole = new model.CellField(), pieces = new model.CellField();
  const a = [10.2, 13.7], b = [85.4, 78.6];
  whole.paint(a, b, 3.25, 2);
  let previous = a;
  for (let i = 1; i <= 30; i++) {
    const next = [a[0] + (b[0] - a[0]) * i / 30, a[1] + (b[1] - a[1]) * i / 30];
    pieces.paint(previous, next, 3.25, 2); previous = next;
  }
  assert.deepEqual(snapshot(pieces), snapshot(whole));
  const before = snapshot(whole);
  const dirty = whole.paint([1.5, 1.5], [1.5, 1.5], .45, 2);
  assert.deepEqual([...dirty], [101]);
  for (let i = 0; i < 10000; i++) if (i !== 101) {
    assert.equal(whole.profile[i], before[0][i]);
    assert.equal(whole.front[i], before[1][i]);
    assert.equal(whole.back[i], before[2][i]);
  }
});

test('stationary input does not accumulate, scratch is released, and paper is transparent', () => {
  const field = new model.CellField();
  field.paint([5, 50], [95, 50], 2, 3);
  for (let x = 6; x < 95; x++) assert.equal(field.colorAt(x + .5, 50.5), 3);
  const first = snapshot(field);
  for (let i = 0; i < 100; i++) assert.equal(field.paint([5, 50], [95, 50], 2, 3).size, 0);
  assert.deepEqual(snapshot(field), first);
  assert.ok(field.scratchBytes > 0);
  field.endStroke(); assert.equal(field.scratchBytes, 0);
  field.paint([-10, 50], [110, 50], 4, 0);
  assert.ok(field.profile.every(profile => profile === 0));
  assert.ok(field.front.every(slot => slot === 0));
  field.clear(); assert.equal(field.scratchBytes, 0);
});
