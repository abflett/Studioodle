import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { cleanA4InkPockets, cleanTinyInkPockets, traceContours } from '../scripts/ink-pocket-cleanup.mjs';
const source = fs.readFileSync('experiments/moon-sorceress/06-traced-ink.svg', 'utf8');
const paths = [...source.matchAll(/<path\s+d="([^"]+)"/g)].map(match => match[1]);

test('pocket cleanup removes narrow holes while retaining the sorceress eye highlights', () => {
  const result = cleanTinyInkPockets(paths);
  assert.equal(traceContours(paths).length, 338);
  assert.equal(result.report.removed, 19);
  // Inspected original contours: left eye's main white highlight and right eye's round sparkle.
  assert.equal(result.report.pockets.some(p => p.index === 31 || p.index === 40), false);
  assert.equal(traceContours([result.d]).length, 319);
});

test('cleanup decisions are invariant under scaling the source coordinates', () => {
  const scaled = paths.map(d => d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g, value => String(Number(value) * 2)));
  const a = cleanTinyInkPockets(paths), b = cleanTinyInkPockets(scaled);
  assert.deepEqual(a.report.pockets.map(p => p.index), b.report.pockets.map(p => p.index));
  assert.ok(Math.abs(b.report.meanLineWidth - a.report.meanLineWidth * 2) < 1e-8);
});

test('combining unmodified Potrace contours preserves cubic geometry', () => {
  const contours = traceContours(paths);
  const combined = traceContours([contours.map(c => c.d).join('')]);
  assert.equal(combined.length, contours.length);
  for (let i = 0; i < contours.length; i++) {
    assert.ok(Math.abs(combined[i].signedArea - contours[i].signedArea) < 1e-8);
    assert.ok(Math.abs(combined[i].perimeter - contours[i].perimeter) < 1e-8);
  }
});


test('A4 area-only cleanup removes six pinholes at nine pixels while preserving eye highlights', () => {
  assert.equal(cleanA4InkPockets(paths, 888, 1254, 3).report.removed, 0);
  const result = cleanA4InkPockets(paths, 888, 1254, 9);
  assert.equal(result.report.removed, 6);
  assert.equal(result.report.pockets.some(p => p.index === 31 || p.index === 40), false);
  assert.ok(result.report.pockets.every(p => p.areaPixels < 9));
  const landscape = cleanA4InkPockets(paths, 1254, 888, 9);
  assert.deepEqual(landscape.report.pockets, result.report.pockets);
});
