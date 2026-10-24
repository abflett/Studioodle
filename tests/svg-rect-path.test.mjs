import assert from 'node:assert/strict';
import { test } from 'node:test';
import paper from 'paper';
import { svgRectPath } from '../scripts/svg-rect-path.mjs';

test('rounded rectangle conversion keeps the authored circular boundary at all four corners', () => {
  const scope = new paper.PaperScope(); scope.setup(new scope.Size(220, 280));
  try {
    const shape = new scope.CompoundPath({ pathData: svgRectPath({ x: 15, y: 30, width: 190, height: 160, rx: 65 }), insert: false });
    for (const [cx, cy, sx, sy] of [[80, 95, -1, -1], [140, 95, 1, -1], [140, 125, 1, 1], [80, 125, -1, 1]]) {
      assert(shape.contains(new scope.Point(cx + sx * 64.5 / Math.SQRT2, cy + sy * 64.5 / Math.SQRT2)));
      assert(!shape.contains(new scope.Point(cx + sx * 65.5 / Math.SQRT2, cy + sy * 65.5 / Math.SQRT2)), 'The converted outline must not bulge beyond the circular SVG corner');
    }
    const ellipse = new scope.CompoundPath({ pathData: svgRectPath({ width: 80, height: 40, rx: 100, ry: 100 }), insert: false });
    assert(ellipse.contains(new scope.Point(40, 20))); assert(!ellipse.contains(new scope.Point(1, 1)), 'Radii clamp independently to half each dimension');
    const square = new scope.CompoundPath({ pathData: svgRectPath({ width: 80, height: 40, rx: 10, ry: 0 }), insert: false });
    assert(square.contains(new scope.Point(1, 1)), 'A zero radius leaves square corners');
  } finally { scope.remove(); }
});
