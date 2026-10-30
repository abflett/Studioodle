# Cell brush experiment

Run `npm run cells` and open http://localhost:1434/. This is an isolated Vite app,
with no imports from the normal app or reviewer and no persistent storage. Build
output goes to ignored `work/cell-brush-dist/`. Commands: `cells:typecheck`,
`cells:build`, `test:cells` (model regressions and a real headless-browser smoke test).

The square page has 100 × 100 cells. Brush diameter is measured in document cells,
independent of screen size. Dragging paints a swept capsule into a shared 101 × 101
corner-label lattice. Long pointer jumps interpolate spatially; browser coalesced
samples are consumed when available. Holding still does not accumulate geometry.
One byte per corner references one of eight palette slots: 10,201 bytes total.
Paint data never grows with stroke count. Grid buffers, diagnostic flags and canvas
backings are extra; the UI shows backing-buffer bytes separately. No speedup claim
or production memory bound is established by this demonstration.

Eight base silhouettes: empty, full, vertical half, horizontal half and four corner
triangles. Color inversion supplies the complementary silhouettes. Opposite-corner
cases compose two corner profiles. Binary neighbors share midpoint edge crossings;
lower palette index wins connectivity at a diagonal saddle. This deliberately
simple choice means connectivity depends on palette index, not visual coverage or
stroke order. It must be revisited before production bucket behavior.

Cells with three or four corner colors use four corner quadrants meeting at the
center. The optional magenta outlines reveal these exceptional cells. This fallback
is bounded and matches neighboring edge labels, but it is not an eight-profile
two-color encoding and can introduce visibly square junctions. Profile geometry is
derived while drawing; there is no stored per-cell profile byte in this prototype.
It tests shared-corner painting, not the previously discussed three-byte cell format.

Canvas2D renders only changed cells, at whole physical pixels per cell; resize or
diagnostic changes redraw the page. There is no React, polygon union, curve fitting,
worker or shader. Clear and paper-colored paint allow repeat trials. Strokes are
intentionally unsmoothed to expose quantization. No undo, zoom, fills, sticker
surfaces or output conversion yet. Source ink is not normalized or changed.

Next questions: adequate detail, shape vocabulary, saddle connectivity, junction
fallback, and cost versus a palette raster at comparable visual quality. The normal
app still uses its existing engine. Track implementation work only in
`docs/REFINEMENT-TASKS.md`, not a separate experiment backlog.
