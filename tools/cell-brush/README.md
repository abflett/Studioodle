# Cell brush experiment

Run `npm run cells` and open http://localhost:1434/. This is an isolated Vite app,
with no imports from the normal app or reviewer and no persistent storage. Build
output goes to ignored `work/cell-brush-dist/`. Commands: `cells:typecheck`,
`cells:build`, `test:cells` (model regressions and a real headless-browser smoke test).

The square page has 100 × 100 cells. Brush diameter is measured in document cells,
independent of screen size. Each cell stores a profile/orientation byte and two palette
slots in three packed Uint8Arrays: 30,000 bytes total (29.30 KiB). Slot zero is
transparent; the paper color comes from the canvas container, not paint data.
Paint data never grows with stroke count. Grid buffers, diagnostic flags and canvas
backings are extra; the UI shows backing-buffer bytes separately. No speedup claim
or production memory bound is established by this demonstration.

The default library has 32 authored families: empty/full, centered/offset splits,
four slopes and four corner wedges, straight/diagonal bands, tapered wedges,
elbows, V bends, beveled caps, a shoulder, square/diamond/octagonal dots and offset
dots, half/quarter circles and a round cap. The byte encodes base shape in bits
0-4, quarter-turn in bits 5-6, and reflection in bit 7. All 256 orientations have
precomputed contours, masks and edge signatures. Identical interior-mask/fine-edge
signatures are skipped during fitting; the UI reports the candidate count. Colors
can swap sides. Circle profiles use fixed 24-segment arc approximations generated
once, not exact circular primitives. No shared corner labels, three-color cells
or junction fallbacks remain.

The Shape library selector offers the original eight silhouettes for comparison;
changing it explicitly clears the page. Draw test strokes replaces the page with
the same shallow line, sine curve, thin ellipse, crossing strokes and dots in either
mode. Brush diameter can be 1-30 cells in quarter-cell steps. Scroll the legend to
inspect all 32 canonical families.

The brush sweeps a capsule over an 8 × 8 staggered sample pattern within each
touched cell. Samples reconstruct the previous two-color profile with new paint
overlaid. The initial fitter minimizes mismatched sample colors using two 32-bit coverage
masks and population-count lookups, trying eligible profiles with both color
assignments. When three colors are present in this
temporary target, the candidate pair is the new color and the most prevalent
surviving old color. Opaque old coverage wins ties against transparency; otherwise
the original foreground wins equal old-color areas. The original cell also remains
a candidate and wins exact objective ties, preventing
unnecessary churn. A color absent from the target cannot be reintroduced by retaining
the original cell. Full coverage becomes solid paint (or fully transparent erase).

Per-cell target samples accumulate only for the active gesture, independent of
event segmentation; they are discarded at release, cancellation, blur or clear.
This is bounded transient working data, not saved supersampled pixels or a stroke
log. The UI reports sample-buffer bytes separately, excluding Map/object overhead.
The maximum sample payload at this resolution is 640,000 bytes if every cell is
touched. Quantizing between separate strokes can still lose detail; no general
topology or event-rate-independent curved input guarantee is claimed.

Simple monotone target boundaries may use only split/wedge families (0-11), with
matching coverage directions. Bands, dots, elbows and curved caps remain available
for non-monotone targets. This prevents complex profiles winning a few samples
while introducing repeated saw teeth or scallops on a straight stroke.

Match edges on release first reconstructs independent fits from the complete
gesture, then runs at most six alternating, sorted join passes over active-stroke
cells only. It compares actual selected neighboring profiles using 32 probes per
edge. The objective is sample error + edge disagreement + a stronger penalty for
cross-cell reversals against the target's monotone direction (eight times each
reversed edge probe). This deliberately permits some local coverage error to
obtain cleaner contours; agreement is no longer just an equal-error tie-breaker.
Probe comparisons use shared palette slots and precomputed edge-difference and
direction tables. A fixed initial state and traversal keep results independent
of event segmentation. Untouched neighbors never change. This bounded local solver
does not guarantee a globally optimal contour or preserve every tiny feature.
Live drawing remains independently fitted; joining happens on stroke release.
The numeric lookup buffers total 72.50 KiB shared across the grid; authored and
transformed polygon arrays, candidate lists and browser Path2D objects are additional.

Canvas2D renders only changed cells, at whole physical pixels per cell; resize
redraws the page. Opaque two-color cells draw one color beneath the other, avoiding
transparent antialias cracks between those colors; transparent fronts erase their
portion of a colored background. The 256 browser paths are constructed once and
reused with per-cell transforms. There is no React, polygon union, curve fitting,
worker or shader. Clear and transparent paper paint allow repeat trials. Strokes are
intentionally unsmoothed to expose quantization. No undo, zoom, fills, sticker
surfaces or output conversion yet. Source ink is not normalized or changed.

Next questions: adequate detail, shape vocabulary, neighbor agreement, loss at
color junctions, and cost versus a palette raster at comparable visual quality. The normal
app still uses its existing engine. Track implementation work only in
`docs/REFINEMENT-TASKS.md`, not a separate experiment backlog.
