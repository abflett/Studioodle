# Cell brush experiment

Run `npm run cells` and open http://localhost:1434/. This is an isolated Vite app,
with no imports from the normal app or reviewer and no persistent storage. Build
output goes to ignored `work/cell-brush-dist/`. Commands: `cells:typecheck`,
`cells:build`, `test:cells` (model regressions and a real headless-browser smoke test).

The square page has 100 × 100 cells. Brush diameter is measured in document cells,
independent of screen size. Each cell stores one of eight profiles and two palette
slots in three packed Uint8Arrays: 30,000 bytes total (29.30 KiB). Slot zero is
transparent; the paper color comes from the canvas container, not paint data.
Paint data never grows with stroke count. Grid buffers, diagnostic flags and canvas
backings are extra; the UI shows backing-buffer bytes separately. No speedup claim
or production memory bound is established by this demonstration.

Eight silhouettes: empty, full, vertical half, horizontal half and four diagonal
half-cell corner triangles. Colors can swap sides. There are no shared corner
labels, composite saddle profiles, three-color cells or junction fallbacks.

The brush sweeps a capsule over an 8 × 8 staggered sample pattern within each
touched cell. Samples reconstruct the previous two-color profile with new paint
overlaid. The fitter minimizes the number of mismatched sample colors, trying each
profile with both color assignments. When three colors are present in this
temporary target, the candidate pair is the new color and the most prevalent
surviving old color. Opaque old coverage wins ties against transparency; otherwise
the original foreground wins equal old-color areas. The original cell also remains
a candidate and wins equal-error ties, preventing barely touching strokes from
churning it. A color absent from the target cannot be reintroduced by retaining
the original cell. Full coverage becomes solid paint (or fully transparent erase).

Per-cell target samples accumulate only for the active gesture, independent of
event segmentation; they are discarded at release, cancellation, blur or clear.
This is bounded transient working data, not saved supersampled pixels or a stroke
log. The UI reports sample-buffer bytes separately, excluding Map/object overhead.
The maximum sample payload at this resolution is 640,000 bytes if every cell is
touched. Quantizing between separate strokes can still lose detail; no general
topology or event-rate-independent curved input guarantee is claimed.

No neighbor correction or diffusion pass runs: only cells whose sampled coverage
changes are fitted. This deliberately avoids cascading edits. Profiles have shared
fixed geometric positions but independently fitted neighbors can still disagree
about a contour; perfect boundary connectivity is not guaranteed. Judge blocky
joins visually before adding edge-agreement rules or a larger profile vocabulary.

Canvas2D renders only changed cells, at whole physical pixels per cell; resize
redraws the page. Opaque two-color cells draw one color beneath the other, avoiding
transparent antialias cracks between those colors; transparent fronts erase their
portion of a colored background. There is no React, polygon union, curve fitting,
worker or shader. Clear and transparent paper paint allow repeat trials. Strokes are
intentionally unsmoothed to expose quantization. No undo, zoom, fills, sticker
surfaces or output conversion yet. Source ink is not normalized or changed.

Next questions: adequate detail, shape vocabulary, neighbor agreement, loss at
color junctions, and cost versus a palette raster at comparable visual quality. The normal
app still uses its existing engine. Track implementation work only in
`docs/REFINEMENT-TASKS.md`, not a separate experiment backlog.
