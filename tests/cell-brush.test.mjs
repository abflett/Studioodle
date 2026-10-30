import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

let server, model;
let library;
let edgeGeometry;
let fixtures;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  model = await server.ssrLoadModule('/tools/cell-brush/src/model.ts');
  library = await server.ssrLoadModule('/tools/cell-brush/src/profiles.ts');
  edgeGeometry = await server.ssrLoadModule('/tools/cell-brush/src/strokeEdges.ts');
  fixtures = await server.ssrLoadModule('/tools/cell-brush/src/fixtures.ts');
});
after(async () => { await server?.close(); });
const snapshot = field => [field.profile.slice(), field.front.slice(), field.back.slice()];

test('optimized one-pixel fast strokes preserve the pre-optimization cell bytes', async () => {
  const golden = JSON.parse(await readFile(new URL('./fixtures/cell-brush-performance-golden.json', import.meta.url), 'utf8'));
  for (const [name, points] of Object.entries(fixtures.performanceStrokes)) for (const background of ['empty', 'painted']) {
    const field = new model.CellField('straight', false, 1520, 850);
    if (background === 'painted') { field.profile.fill(1); field.front.fill(2); }
    let previous = points[0];
    for (const point of points) { field.paint(previous, point, 4, 1); previous = point; }
    field.endStroke();
    assert.equal(createHash('sha256').update(field.profile).update(field.front).update(field.back).digest('hex'), golden[`${name}:${background}`]);
    assert.equal(field.scratchBytes, 0);
  }
});

test('solid-cell fast paths preserve diagnostic painting, overpaint and erasure geometry', () => {
  const plain = new model.CellField('straight', true, 280, 190), observed = new model.CellField('straight', true, 280, 190);
  observed.onFit = () => {};
  for (const [a, b, radius, slot] of [[[10.2, 15.7], [261.3, 174.1], 8, 1], [[275, 60.3], [13.1, 143.9], 3.5, 5], [[20, 100], [259, 100], 5, 0]]) {
    for (const field of [plain, observed]) { field.paint(a, b, radius, slot); field.paint(b, a, radius, slot); field.endStroke(); }
    assert.deepEqual(snapshot(plain), snapshot(observed));
  }
});

test('reused palette counts retain colors supplied by shared neighboring edges', () => {
  const field = new model.CellField('straight', false);
  for (const color of [200, 17, 5]) {
    const target = new Uint8Array(64); target[0] = 1;
    field.fit(5050, { target, original: { profile: 0, front: 0, back: 0 }, edges: new Uint8Array(128).fill(color) }, 1);
    const cell = field.cell(5050);
    assert.ok(cell.front === color || cell.back === color, 'Populated neighboring colors must participate in retention');
    assert.ok([0, 1, color].includes(cell.front) && [0, 1, color].includes(cell.back), 'Earlier fits must not leak palette counts');
  }
});

test('rectangular display grids address paint, shared edges and bounds independently on both axes', () => {
  for (const [width, height] of [[381, 212], [87, 161]]) {
    const field = new model.CellField('straight', false, width, height);
    assert.equal(field.byteLength, width * height * 3);
    field.paint([width - 12.3, height - 8.7], [width - 1.1, height - 1.2], 2.5, 5);
    field.endStroke();
    assert.equal(field.colorAt(width - 1.1, height - 1.2), 5);
    assert.equal(field.colorAt(width - 8, height - 6), 5);
    assert.equal(field.colorAt(1, 1), 0);
    assert.equal(field.colorAt(width, height - 1), 0);
    assert.equal(field.colorAt(width - 1, height), 0);
    assert.equal(field.scratchBytes, 0);
    field.paint([width - 1.1, height - 1.2], [width - 1.1, height - 1.2], 1, 0); field.endStroke();
    assert.equal(field.colorAt(width - 1.1, height - 1.2), 0);
    field.clear(); assert.equal(field.front.some(Boolean), false);
  }
});

test('a nearly full fallback cell preserves a better inverted quarter-to-half corner', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/cell-brush-nearly-full-corner.json', import.meta.url), 'utf8'));
  for (const slot of [1, 5, 0]) {
    const retained = slot === 0 ? 1 : 0;
    const target = new Uint8Array(64).fill(slot);
    for (const i of fixture.unpaintedSamples) target[i] = retained;
    const outline = fixture.crossings.map((crossing, side) => {
      const first = fixture.paintAtStart[side] ? slot : retained, second = first === slot ? retained : slot;
      return { start: [60 + Number(side === 1), 42 + Number(side === 2)], horizontal: side % 2 === 0,
        runs: [{ from: 0, to: crossing, color: first }, { from: crossing, to: 1, color: second }] };
    });
    const working = { target, outline, original: { profile: retained ? 1 : 0, front: retained, back: 0 },
      edges: Uint8Array.from({ length: 128 }, (_, i) => edgeGeometry.edgeColor(outline[Math.floor(i / 32)], (i % 32 + .5) / 32)) };
    const field = new model.CellField('straight', false);
    let diagnostic; field.onFit = (_, record) => { diagnostic = record; };
    field.fit(fixture.index, working, slot);
    const selected = field.cell(fixture.index);
    assert.equal(diagnostic.mode, 'fallback');
    assert.equal(field.tables.names[selected.profile & 31], 'Corner 1/4-2/4');
    assert.equal(selected.front, retained, 'The small corner restores the retained color');
    assert.equal(selected.back, slot);
    const mismatch = cell => Array.from(target).filter((color, i) => field.tables.sampleColor(cell.profile, cell.front, cell.back, i) !== color).length;
    assert.equal(mismatch(selected), 2, 'Keep the corner that improves on four solid-cell mismatches');
    assert.equal(field.colorAt(60.0625, 42.9375), retained, 'Do not paint the protruding bottom-left corner');
    assert.equal(field.colorAt(60.1875, 42.9375), retained);
  }
});

test('seeded pointer flutter, fractional starts and tightening bends survive repeated boundary traversal', () => {
  for (const kind of ['arc', 'short', 'spiral', 'tightening', 'boundary']) for (const seed of [1, 17, 529]) {
    const offset = [(seed * .17321) % 1, kind === 'boundary' ? .007 : (seed * .61937) % 1];
    const jitter = seed === 1 ? .03 : seed === 17 ? .09 : .21;
    const points = fixtures.thinCurve(kind, offset, 240, { seed, jitter });
    const replay = fixtures.thinCurve(kind, offset, 240, { seed, jitter, retrace: true });
    assert.deepEqual(points, fixtures.thinCurve(kind, offset, 240, { seed, jitter }), 'The seed reproduces the exact samples');
    assert.ok(replay.length > points.length, 'Include duplicate events and backwards retraversal');
    assert.ok(points.every(p => p.every(v => v > 0 && v < 100)));
    if (kind === 'boundary') assert.ok(points.filter((p, i) => i && Math.floor(p[1]) !== Math.floor(points[i - 1][1])).length > 20, 'Flutter must repeatedly cross an actual grid boundary');
    for (const matching of [false, true]) {
      const plain = new model.CellField('straight', matching), flutter = new model.CellField('straight', matching);
      const records = new Map(); flutter.onFit = (index, record) => records.set(index, record);
      for (const [field, samples] of [[plain, points], [flutter, replay]]) {
        let previous = samples[0];
        for (const point of samples) { field.paint(previous, point, .5, 1); previous = point; }
        field.endStroke();
      }
      assert.deepEqual(snapshot(flutter), snapshot(plain), `${kind}, seed ${seed}, matching ${matching}: traversing existing coverage must not change the result`);
      assert.equal(flutter.scratchBytes, 0);
      // Verify accumulated analytic edges against the whole noisy capsule union,
      // rather than incorrectly requiring a jittered contour to be monotone.
      const distance2 = (p, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
        const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
        return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
      };
      const checked = new Set();
      for (const record of records.values()) for (const edge of record.edges) {
        const key = `${edge.start}:${edge.horizontal}`;
        if (checked.has(key)) continue; checked.add(key);
        for (const t of [.173, .493, .819]) {
          const p = [edge.start[0] + (edge.horizontal ? t : 0), edge.start[1] + (edge.horizontal ? 0 : t)];
          const inside = points.some((point, i) => distance2(p, points[Math.max(0, i - 1)], point) < .25 - 1e-9);
          assert.equal(edgeGeometry.edgeColor(edge, t) === 1, inside, `Accumulated coverage disagrees at ${p}`);
        }
      }
    }
  }
});

test('thin curve diagnostics preserve painting and retain immutable crossing snapshots only when enabled', () => {
  for (const kind of ['arc', 'spiral']) {
    const points = fixtures.thinCurve(kind, .375);
    const plain = new model.CellField('straight', false), observed = new model.CellField('straight', false);
    const records = new Map(); observed.onFit = (index, diagnostic) => records.set(index, diagnostic);
    let previous = points[0];
    for (const point of points) { plain.paint(previous, point, .5, 1); observed.paint(previous, point, .5, 1); previous = point; }
    plain.endStroke(); observed.endStroke();
    assert.deepEqual(snapshot(observed), snapshot(plain), 'Observation must not change profile selection');
    assert.ok(records.size > 100);
    assert.ok([...records.values()].some(record => record.mode === 'cut'));
    assert.ok([...records.values()].some(record => record.actual.some(([x, y]) => !Number.isInteger(x * 4) || !Number.isInteger(y * 4))));
    for (const [index, record] of records) {
      assert.deepEqual(record.selected, observed.cell(index));
      assert.ok(record.snapped.every(point => point.every(v => Number.isInteger(v * 4))));
      assert.deepEqual(record.snapped, edgeGeometry.cellCrossings(record.edges, 1));
    }
    const saved = structuredClone([...records]);
    observed.onFit = undefined; observed.clear(); observed.paint([20, 20], [80, 80], 3, 2); observed.endStroke();
    assert.deepEqual([...records], saved, 'Later edits must not rewrite captured diagnostics');
    assert.equal(observed.scratchBytes, 0);
  }
});

test('repeatable one-cell open curves have monotone contours across grid offsets', () => {
  for (const offset of [0, .125, .25, .375, .5, .625, .75, .875]) {
    const field = new model.CellField('straight', false), points = fixtures.thinCurve('arc', offset);
    let previous = points[0];
    for (const point of points) { field.paint(previous, point, .5, 1); previous = point; }
    field.endStroke();
    let last;
    for (let x = 30 + offset; x < 70 + offset; x += .0625) {
      let top, bottom;
      for (let y = 35 + offset; y < 50 + offset; y += .03125) if (field.colorAt(x, y)) { top ??= y; bottom = y; }
      assert.notEqual(top, undefined, 'The thin curve must remain connected');
      if (last && (last.x < 50 + offset) === (x < 50 + offset)) {
        const direction = x < 50 + offset ? -1 : 1;
        assert.ok((top - last.top) * direction >= -.07, `Outer contour reversal at ${x}, offset ${offset}`);
        assert.ok((bottom - last.bottom) * direction >= -.07, `Inner contour reversal at ${x}, offset ${offset}`);
      }
      last = { x, top, bottom };
    }
  }
});

function crossingAt(field, index, side) {
  const cell = field.cell(index), mask = field.tables.fineEdgeMasks[cell.profile * 4 + side];
  const colors = Array.from({ length: 32 }, (_, i) => mask & (1 << i) ? cell.front : cell.back);
  return colors.flatMap((color, i) => i && color !== colors[i - 1] ? [i / 32] : []);
}

function assertSharedCrossings(field) {
  let compared = 0;
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
    const index = y * 100 + x;
    for (const [next, side, opposite] of [[x < 99 ? index + 1 : -1, 1, 3], [y < 99 ? index + 100 : -1, 2, 0]]) {
      if (next < 0) continue;
      const a = crossingAt(field, index, side), b = crossingAt(field, next, opposite);
      // A uniform cell can carry a contour along the grid edge itself. Compare
      // entry/exit coordinates where both cuts continue through the two cells.
      if (!a.length || !b.length) continue;
      assert.deepEqual(a, b, `The contour must enter cell ${next} exactly where it exits ${index}`);
      compared++;
    }
  }
  assert.ok(compared > 10, 'Exercise actual shared contour exits');
}

test('capsule intersections use the brush outline rather than edge-center occupancy', () => {
  for (const position of [.125 - 1e-12, .125, .125 + 1e-12]) assert.equal(edgeGeometry.snapQuarter(position), .25, 'Numerical noise must not split a shared rounding tie');
  const interval = edgeGeometry.capsuleInterval([0, 0], true, [.4, .3], [.4, .3], .5);
  assert.ok(Math.abs(interval[0]) < 1e-9 && Math.abs(interval[1] - .8) < 1e-9);
  assert.deepEqual(edgeGeometry.capsuleInterval([0, 0], true, [-1, .25], [2, .25], .5), [0, 1]);
  assert.equal(edgeGeometry.capsuleInterval([0, 0], true, [.5, 1], [.5, 1], .5), undefined);
  const a = [12.3, 14.7], b = [85.2, 44.1];
  for (let x = 10; x < 90; x++) {
    const forward = edgeGeometry.capsuleInterval([x, 20], true, a, b, 2);
    const reverse = edgeGeometry.capsuleInterval([x, 20], true, b, a, 2);
    assert.equal(!!forward, !!reverse);
    if (forward) for (let i = 0; i < 2; i++) assert.ok(Math.abs(forward[i] - reverse[i]) < 1e-9);
  }
  const empty = [{ from: 0, to: 1, color: 0 }];
  const first = edgeGeometry.paintRuns(empty, [.25, .75], 1);
  assert.deepEqual(first, [{ from: 0, to: .25, color: 0 }, { from: .25, to: .75, color: 1 }, { from: .75, to: 1, color: 0 }]);
  assert.strictEqual(edgeGeometry.paintRuns(first, [.3, .7], 1), first, 'Repeated coverage must not accumulate edge records');
  assert.deepEqual(edgeGeometry.paintRuns(first, [.5, 1], 2), [{ from: 0, to: .25, color: 0 }, { from: .25, to: .5, color: 1 }, { from: .5, to: 1, color: 2 }]);
});

test('straight contours share exact exit/entry positions without neighbor matching', () => {
  for (const matching of [false, true]) {
    for (const [cx, cy, radius] of [[50, 50, 6], [50.125, 50.375, 7.25], [50.3, 49.7, 14]]) {
      const field = new model.CellField('straight', matching);
      field.paint([cx, cy], [cx, cy], radius, 1); field.endStroke(); assertSharedCrossings(field);
    }
    for (const code of [0, 32, 64, 96, 128, 160, 192, 224]) {
      const transform = point => library.transformPoint(point.map(v => v / 100), code).map(v => v * 100);
      const field = new model.CellField('straight', matching);
      field.paint(transform([10.2, 20.3]), transform([88.1, 43.7]), 3.5, 1); field.endStroke();
      assertSharedCrossings(field);
    }
    const wave = new model.CellField('straight', matching);
    let previous = [10, 50];
    for (let i = 0; i <= 64; i++) {
      const next = [10 + i * 1.25, 50 + Math.sin(i * Math.PI / 32) * 10];
      wave.paint(previous, next, 3, 1); previous = next;
    }
    wave.endStroke(); assertSharedCrossings(wave);
  }
  // This stroke's upper outline is y = x/4 + 25.5, so cell (50,38) must
  // connect its top-left corner to 1/4 down its right edge: full -> 3/4.
  const field = new model.CellField('straight', false);
  field.paint([10, 30], [90, 50], 2 / Math.sqrt(1.0625), 1); field.endStroke();
  const cell = field.cell(3850);
  const active = side => {
    const mask = field.tables.fineEdgeMasks[cell.profile * 4 + side];
    return (cell.front === 1 ? mask : ~mask) >>> 0;
  };
  assert.equal(active(3), 0xffffffff, 'The entry is at the corner, not an invented 3/4 split');
  assert.equal(active(1), 0xffffff00, 'The exit is exactly one quarter down the right edge');
});

test('straight library covers every quarter-edge cut with only 16 base profiles', () => {
  const straight = library.straight;
  assert.equal(straight.shapes.length, 16);
  assert.ok(straight.candidates.every(code => (code & 31) < 16));
  const signatures = new Set(straight.candidates.flatMap(code => {
    const edges = Array.from(straight.fineEdgeMasks.slice(code * 4, code * 4 + 4));
    return [edges.join(','), edges.map(mask => (~mask) >>> 0).join(',')];
  }));
  const points = [];
  for (let i = 0; i <= 4; i++) for (const p of [[i, 0], [i, 4], [0, i], [4, i]]) if (!points.some(q => q[0] === p[0] && q[1] === p[1])) points.push(p);
  const lines = new Set();
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const a = points[i], b = points[j];
    if ((a[0] === b[0] && [0, 4].includes(a[0])) || (a[1] === b[1] && [0, 4].includes(a[1]))) continue;
    const nx = b[1] - a[1], ny = a[0] - b[0], c = nx * a[0] + ny * a[1];
    const scale = gcd(gcd(Math.abs(nx), Math.abs(ny)), Math.abs(c)) * (nx ? Math.sign(nx) : Math.sign(ny));
    lines.add([nx / scale, ny / scale, c / scale].join(','));
    const masks = [0, 0, 0, 0];
    for (let n = 0; n < 32; n++) {
      const t = (n + .5) / 32 * 4, e = .000004;
      [[t, e], [4 - e, t], [t, 4 - e], [e, t]].forEach(([x, y], side) => { if (nx * x + ny * y <= c) masks[side] = (masks[side] | (1 << n)) >>> 0; });
    }
    assert.ok(signatures.has(masks.join(',')), `Missing edge combination ${a} to ${b}`);
  }
  assert.equal(lines.size, 80);
});

test('straight circle dabs are close to circles with or without neighbor matching', () => {
  for (const matching of [false, true]) for (const radius of [3.5, 6.25, 14]) {
    const field = new model.CellField('straight', matching), center = [50.3, 49.7];
    field.paint(center, center, radius, 1);
    const before = snapshot(field);
    assert.ok(field.scratchBytes > 0);
    field.endStroke(); assert.equal(field.scratchBytes, 0);
    if (!matching) assert.deepEqual(snapshot(field), before, 'Independent fits must not change on release');
    assert.equal(field.byteLength, 30000);
    for (let n = 0; n < 360; n++) {
      const a = n * Math.PI / 180;
      let edge = 0, leftPaint = false;
      for (let distance = 0; distance <= radius + 1; distance += .0625) {
        const on = field.colorAt(center[0] + Math.cos(a) * distance, center[1] + Math.sin(a) * distance) !== 0;
        if (on) { assert.equal(leftPaint, false, 'Dab must not have holes or isolated radial spikes'); edge = distance; }
        else leftPaint = true;
      }
      assert.ok(Math.abs(edge - radius) <= .3, `Dab edge error exceeds quarter-cell stepping budget: ${edge - radius}`);
    }
  }
});

test('rounded tangencies stay monotone across cell offsets instead of choosing repeated corner teeth', () => {
  const offsets = [0, .125, .25, .375, .5, .625, .75, .875];
  for (const matching of [false, true]) for (const radius of [4, 6, 7.25]) {
    for (const ox of offsets) for (const oy of offsets) {
      const field = new model.CellField('straight', matching), cx = 50 + ox, cy = 50 + oy;
      field.paint([cx, cy], [cx, cy], radius, 1); field.endStroke();
      let previous;
      for (let x = cx - radius + .5; x < cx + radius - .5; x += .125) {
        const height = Math.sqrt(radius * radius - (x - cx) ** 2);
        let top = Infinity, bottom = -Infinity;
        for (let y = cy - height - .75; y < cy - height + .75; y += .03125) if (field.colorAt(x, y)) { top = y; break; }
        for (let y = cy + height + .75; y > cy + height - .75; y -= .03125) if (field.colorAt(x, y)) { bottom = y; break; }
        assert.ok(Number.isFinite(top) && Number.isFinite(bottom), 'Dab must not develop gaps');
        if (previous && (x < cx) === (previous.x < cx)) {
          const direction = x < cx ? 1 : -1;
          assert.ok((top - previous.top) * direction <= .07, `Top tooth: r=${radius}, offset=${ox},${oy}, matching=${matching}`);
          assert.ok((previous.bottom - bottom) * direction <= .07, `Bottom tooth: r=${radius}, offset=${ox},${oy}, matching=${matching}`);
        }
        previous = { x, top, bottom };
      }
    }
  }
  const nearSolid = new model.CellField('straight', false);
  nearSolid.paint([50, 50], [50, 50], 6, 1);
  for (const index of [4449, 4450, 4944, 5044]) assert.equal(nearSolid.profile[index], 1, 'Nearly full tangent cells should normalize to full');
  const smallCut = new model.CellField('straight', false);
  smallCut.paint([50, 50], [50, 50], .35, 1);
  assert.equal(smallCut.profile.filter(profile => profile > 1).length, 4, 'Representable small corner cuts must survive');
});

test('straight stroke fitting and edge coverage are independent of event segmentation', () => {
  for (const matching of [false, true]) {
    const whole = new model.CellField('straight', matching), pieces = new model.CellField('straight', matching);
    const a = [10.2, 20.3], b = [88.1, 43.7];
    whole.paint(a, b, 3.5, 2);
    let previous = a;
    for (let i = 1; i <= 24; i++) {
      const next = [a[0] + (b[0] - a[0]) * i / 24, a[1] + (b[1] - a[1]) * i / 24];
      pieces.paint(previous, next, 3.5, 2); previous = next;
    }
    whole.endStroke(); pieces.endStroke();
    assert.deepEqual(snapshot(pieces), snapshot(whole));
    for (let x = 15; x < 83; x += .25) {
      const y = a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
      assert.equal(whole.colorAt(x, y), 2);
    }
  }
});

test('all byte codes transform geometry and masks consistently, including reflections', () => {
  assert.equal(library.variants.length, 256);
  assert.ok(library.candidates.length > 64 && library.candidates.length <= 256);
  for (let code = 0; code < 256; code++) {
    for (const point of [[.137, .219], [.371, .813], [.729, .431], [.863, .681]]) {
      const mapped = library.transformPoint(point, code);
      assert.equal(model.inProfile(code, ...mapped), model.inProfile(code & 31, ...point), `Code ${code}`);
    }
    for (let i = 0; i < 64; i++) {
      assert.equal(library.sampleColor(code, 3, 5, i), model.inProfile(code, library.sampleX[i], library.sampleY[i]) ? 3 : 5);
    }
    const low = library.maskLow[code], high = library.maskHigh[code];
    assert.equal(library.pop32(low) + library.pop32(high), Array.from({ length: 64 }, (_, i) => library.sampleColor(code, 1, 0, i)).reduce((a, b) => a + b, 0));
  }
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) assert.equal(library.edgeDifference[a * 256 + b], library.pop8[a ^ b]);
});

test('expanded profiles improve independent coverage and joining stays inside a one-cell error budget', () => {
  const a = [10.2, 20.3], b = [88.1, 43.7], radius = 1.125;
  const coverageError = field => {
    let error = 0;
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    for (let y = 18; y <= 46; y++) for (let x = 8; x <= 90; x++) for (let i = 0; i < 64; i++) {
      const px = x + library.sampleX[i], py = y + library.sampleY[i];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / length2));
      const expected = (px - a[0] - t * dx) ** 2 + (py - a[1] - t * dy) ** 2 <= radius ** 2 ? 2 : 0;
      if (field.colorAt(px, py) !== expected) error++;
    }
    return error;
  };
  const legacy = new model.CellField('legacy'), expanded = new model.CellField();
  legacy.paint(a, b, radius, 2); expanded.paint(a, b, radius, 2);
  const before = coverageError(expanded), oldError = coverageError(legacy);
  assert.ok(before < oldError, `${before} should improve on ${oldError} sample mismatches`);
  const untouched = new Set(Array.from({ length: 10000 }, (_, i) => i).filter(i => {
    const x = i % 100 + .5, y = Math.floor(i / 100) + .5;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) > radius + Math.SQRT1_2;
  }));
  const old = snapshot(expanded);
  expanded.endStroke();
  // Joining deliberately trades some local sample accuracy for a clean contour.
  assert.ok(coverageError(expanded) < oldError * 2, 'Joined coverage must remain bounded');
  for (const index of untouched) {
    assert.equal(expanded.profile[index], old[0][index]);
    assert.equal(expanded.front[index], old[1][index]);
    assert.equal(expanded.back[index], old[2][index]);
  }
});

test('shallow strokes have no backward contour teeth across rotations, reflections and input direction', () => {
  const a = [10.2, 20.3], b = [88.1, 43.7], slope = (b[1] - a[1]) / (b[0] - a[0]);
  for (const radius of [1.125, 3.5]) for (const code of [0, 32, 64, 96, 128, 160, 192, 224]) {
    const transform = (x, y) => library.transformPoint([x / 100, y / 100], code).map(v => v * 100);
    const field = new model.CellField(), reverse = new model.CellField();
    field.paint(transform(...a), transform(...b), radius, 1); field.endStroke();
    reverse.paint(transform(...b), transform(...a), radius, 1); reverse.endStroke();
    assert.deepEqual(snapshot(reverse), snapshot(field), 'Input direction must not choose a different profile layout');
    let previousTop, previousBottom;
    for (let x = 15; x < 83; x += .125) {
      const center = a[1] + (x - a[0]) * slope;
      let top = Infinity, bottom = -Infinity;
      for (let y = center - radius - 2; y < center + radius + 2; y += .0625) if (field.colorAt(...transform(x, y))) {
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      assert.ok(Number.isFinite(top) && Number.isFinite(bottom), 'Stroke must not develop gaps');
      const extent = radius * Math.sqrt(1 + slope * slope);
      assert.ok(Math.abs(top - (center - extent)) < .8 && Math.abs(bottom - (center + extent)) < .8, 'Contour may step but must stay close to the intended stroke');
      if (previousTop !== undefined) {
        assert.ok(top >= previousTop - .07, `Backward top-edge tooth, orientation ${code}, radius ${radius}`);
        assert.ok(bottom >= previousBottom - .07, `Backward bottom-edge tooth, orientation ${code}, radius ${radius}`);
      }
      previousTop = top; previousBottom = bottom;
    }
  }
});

test('coverage selects diagonal and straight profiles and every cell stores at most two slots', () => {
  assert.equal(model.profiles.length, 32);
  const field = new model.CellField();
  field.paint([5.2, 8.7], [90.3, 73.6], 3.7, 2);
  assert.ok(field.profile.some(profile => (profile & 31) >= 4), 'Diagonal brush edge profiles');
  field.endStroke();
  field.paint([10, 80], [85, 15], 2.3, 5);
  field.endStroke();
  field.paint([50, 10], [50, 90], 2.5, 3);
  assert.ok(field.profile.some(profile => (profile & 31) === 2), 'Vertical half-cell brush edge');
  assert.equal(field.byteLength, 30000);
  for (let i = 0; i < 10000; i++) {
    const cell = field.cell(i);
    assert.ok(cell.profile >= 0 && cell.profile < 256);
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
  pieces.endStroke(); whole.endStroke();
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
