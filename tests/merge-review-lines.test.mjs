import assert from 'node:assert/strict';
import { test } from 'node:test';
import paper from 'paper';
import { mergeReviewLines } from '../scripts/merge-review-lines.mjs';

test('closure outlines union into existing vector ink while preserving holes and curved strokes', () => {
  const svg = '<svg><g id="ink"><path fill="black" stroke="none" transform="matrix(1 0 0 1 0 0)" d="M0 0H4V1H1V9H9V1H6V0H10V10H0Z"/></g></svg>';
  const line = { a: { x: 3.8, y: .5 }, b: { x: 6.2, y: .5 }, control: null, width: 1 };
  const result = mergeReviewLines(svg, [line], 10, 10);
  assert.equal(result.lines, 1); assert(result.addedArea > 1);
  assert.equal((result.svg.match(/<path /g) ?? []).length, 1);
  assert(!result.svg.includes('<image')); assert(result.svg.includes('stroke="none"'));
  const scope = new paper.PaperScope(); scope.setup(new scope.Size(10, 10));
  try {
    const shape = new scope.CompoundPath({ pathData: / d="([^"]+)"/.exec(result.svg)[1], insert: false });
    assert(shape.contains(new scope.Point(5, .5)), 'Gap is now black ink');
    assert(shape.contains(new scope.Point(.5, 5)), 'Original side remains ink');
    assert(!shape.contains(new scope.Point(5, 5)), 'Interior remains a hole');
    const curved = mergeReviewLines(svg, [{ ...line, a: { x: 2, y: 4 }, b: { x: 8, y: 4 }, control: { x: 5, y: 8 }, width: .2 }], 10, 10);
    scope.activate();
    const curveShape = new scope.CompoundPath({ pathData: / d="([^"]+)"/.exec(curved.svg)[1], insert: false });
    assert(curveShape.contains(new scope.Point(5, 6)), 'Quadratic stroke passes through its exact midpoint');
    assert(!curveShape.contains(new scope.Point(5, 4)), 'Curve is not replaced by its straight chord');
  } finally { scope.remove(); }
  assert.throws(() => mergeReviewLines(svg, [{ ...line, width: 0 }], 10, 10), /Invalid closure/);
});
