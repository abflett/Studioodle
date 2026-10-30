# Cell brush experiment

Run `npm run cells` and open http://localhost:1434/. This isolated Vite app imports
neither the normal app nor the reviewer and has no persistent storage. The user
runs the server manually. Build output and test screenshots go under ignored
`work/`. Commands: `cells:typecheck`, `cells:build`, `test:cells`.

## Libraries and controls

The default **4 x 4 display pixels per cell** mode fits a rectangular grid to the
visible drawing area using CSS pixels, leaving a scrollable tool panel alongside
it on desktop. A 1920 x 1080 browser viewport currently yields 380 x 212 cells
(236.02 KiB of cell data); browser zoom and available viewport space affect this.
The badge shows dimensions and the note shows actual cell size. **100 x 100
comparison grid** preserves the coarse experiment. Changing modes or clicking
**Fit grid to view (clears)** allocates a fresh grid and clears both drawing and
reference. Window resizing preserves model/reference and aspect ratio; refit
explicitly to restore approximately four-pixel cells at the new window size.

The default library is **Straight cuts (16 of 32
slots)**, with neighbor matching off. The previous **Experimental 32 shapes** and
**Original 8 profiles** remain in the dropdown; switching clears the page and
restores the library's matching default (on for the earlier modes).

Draw test strokes creates the same shallow line, sine curve, thin ellipse,
crossings and small marks in each mode. Draw circle dabs creates four solid circles
of different sizes. Toggle Match edges on release and redraw either example to
compare independent fits with joining. Diameter is 1-30 cells in quarter-cell steps.
Scroll the legend to inspect profiles; unused straight-library slots are reserved.

Compare coverage switches between Cell profiles, Round brush reference and a
visual Difference overlay. The reference records the same incoming points as
Canvas2D round-capped segments/circle dabs without cell fitting. In comparison mode its canvas is 1000 x 1000; display mode
allocates it at approximately four physical pixels per cell (adjusted for device
pixel ratio). It starts with the current page; refreshing resets both views.
Clear, examples and library changes clear both; resize preserves the reference.
Drawing also works while the reference is displayed.

Draw overlapping dabs demonstrates an important distinction: even ordinary round
dabs leave pointed cusps where their arcs meet, including a narrow pointed hole
between three overlapping circles. A round tip does not make the resulting union's
entire boundary round. The reference separates those real input corners from
additional cell-fitting artifacts. The difference overlay is a visual blend, not
a numerical error metric. No further profile correction is implied by this tool.

## Straight-cut dictionary

The byte layout is base shape in bits 0-4, quarter-turn in bits 5-6 and reflection
in bit 7. Colors can swap sides. The 16 active bases are:

- Empty and full.
- Uniform splits at 1/4 and 1/2 (3/4 is a transformed/color-swapped variant).
- Ten adjacent-edge corner wedges: all unordered pairs from 1/4, 1/2, 3/4, 1.
- Two opposite-edge cuts, from 1/4 to 1/2 and from 1/4 to 3/4.

Together they cover all 80 nondegenerate straight boundaries whose endpoints are
quarter positions on the cell perimeter, including color complements. A focused
regression enumerates every case. No bands, caps, dots or curves are in this set;
slots 16-31 are excluded from selection, not silently used as empty profiles.

Straight mode intersects the actual round-capped brush segment with each grid
edge analytically: the swept strip and two circular caps. Each physical edge has
one shared active-gesture record of colored intervals. Painting overwrites and
merges those intervals; it does not append an input-stroke log. Quarter crossings
are cached per edge version, with stable numerical handling at rounding ties.

For a cell with one contour, its two outline crossings determine the profile by
a precomputed endpoint index. Coverage samples choose which side is painted; they
cannot replace an endpoint with a better-scoring but incompatible exit. These
simple cases do not need neighbor matching. A contour that collapses onto one
border becomes a uniform cell with the contour along the grid edge; paired
crossings that snap to the same corner cancel. This avoids fitting contradictory
whole-edge color masks near rounded tangencies.

The prior sampled-edge scorer and nearly uniform fallback remain only for cells
with more complex crossings that one straight cut cannot represent. This is still
coverage-aware: nearly uniform normalization may replace a selected cut only if
the solid cell has no more source-sample mismatches. The reconstructed inspector
case (60,42) previously selected an inverted Corner 1/4-2/4, then unconditionally
overrode it with Full at 60/64 painted samples. The regression now retains the
corner (two mismatches instead of four), including color-swapped and erased cases.
This fixes that identified fallback override; it does not prove every pictured
tooth has the same cause. The representation remains
an approximation: narrow bands, tiny enclosed marks and three-color junctions can
lose detail. Do not infer universal watertightness for arbitrary geometry from the
simple-contour tests. Regressions check analytic intervals, all 80 quarter-edge
cuts, actual exit/entry coordinates on continuing cuts, a known full-to-3/4 case,
curved/shallow strokes in every orientation, circle radial error and the 384-dab
rounding sweep, with matching off/on.

## Earlier library and optional joins

The earlier 32-family dictionary retains bands, wedges, elbows, V bends, caps,
dots and simple curves (24-segment arc approximations). All orientations have
precomputed contours, coverage masks and edge signatures. Equivalent masks with
identical fine edges are skipped during fitting. Counts appear in the UI.

Earlier-library monotone boundaries are limited to direction-compatible splits/
wedges. Independent scoring minimizes sample mismatch. New paint is paired with
the most prevalent surviving old color, using current interior samples and (for
straight cuts) edge samples; opaque coverage wins ties against transparency.

Optional joining begins again from complete-gesture independent fits and runs at
most six alternating sorted passes over touched cells. It compares actual selected
neighbors using 32 probes per edge, with coverage, continuity and stronger reversal
penalties. It may sacrifice local coverage to obtain cleaner contours. In straight
mode, direct endpoint construction takes precedence; this scorer is used only for
unsupported complex crossing cases. Untouched
neighbors never change. No global optimum or arbitrary topology guarantee is claimed.

## Storage and rendering

### Thin contour investigation

Use **Draw 1-cell test** to draw an open arc, short nine-cell-wide arc, spiral, loose-to-tight bend or
boundary-flutter line with diameter one. Independent X/Y offsets have 0.001-cell
steps, so starts need not align with cells or quarter crossings. Mouse jitter is
seeded, independent per-axis noise up to the selected amplitude in cell units.
The seed reproduces the same samples; change it for a different flutter pattern.
**Repeat and retrace input samples** adds stationary duplicates and short backwards
traversals of already-painted segments. Boundary flutter repeatedly hovers around
a horizontal grid edge; use Y offset 0 or 0.007 to keep noise crossing that edge.
Press the button again after changing the controls. It clears the drawing
and enables diagnostic capture. For a hand-drawn reproduction, enable **Capture
cell diagnostics** before drawing, then enable **Click to inspect instead of
paint** and click the suspect cell. The inspector shows that cell and its eight
neighbors, actual crossings in orange, quarter-snapped crossings in blue, the
selected byte/color slots and the actual fitting route (cut/uniform/fallback).
Pink dots mark the selected profile's disagreements with the 64 accumulated
source samples; their count is shown below the enlarged cell. This is a sampling
diagnostic, not a guarantee that the entire contour matches.
Existing reference/difference views and optional matching remain available.

Capture is off by default. It copies the latest fit's samples/edge intervals per
touched cell, not an input-stroke log. Gesture-end snapshots refresh after shared
edges settle. Clear, library changes, disabling capture and replacement test
drawings release the snapshots. Diagnostic JS objects and the 300 × 300 inspector
canvas (360,000 backing bytes) are extra memory outside the displayed counters.
Capture affects diagnostic timings; disable it for performance comparisons.

Tests verify observer neutrality, immutable snapshots, browser inspection without
painting and monotone noiseless open-arc contours at eight offsets. A further sweep
covers five shapes, three seeds/jitter amplitudes (0.03/0.09/0.21 cells), independent
fractional starts, matching off/on and repeated boundary crossings. Duplicate and
backwards traversal must leave output identical to the same noisy path without
repeats. Captured analytic edge coverage is checked against the complete noisy
capsule union; noisy contours are not required to be monotone. Browser checks also
replay noisy samples through native mouse events. These checks do not establish
the cause of the user's pictured teeth. No profile dictionary,
snapping or fallback selection change is claimed by this instrumentation.

### Packed cell storage

Each cell has three packed bytes: profile/orientation, front slot and back slot.
The grid occupies width x height x 3 bytes, independent of stroke count. The
100 x 100 mode occupies 30,000 bytes (29.30 KiB). Slot zero
is transparent; paper is the container background. It is not white paint.

Temporary sample payload is 64 bytes per touched cell in an earlier library,
or 192 bytes for straight cuts (64 interior + 128 edge samples). Larger grids
therefore increase worst-case gesture scratch as well as authoritative storage. The analytic shared-edge interval records are additional transient allocations
(excluded from the sample-buffer counter). Both buffers and intervals release on
pointer-up, cancellation, blur or clear. This is scratch
coverage, not a saved raster or input-stroke log. UI totals exclude Map/object
bookkeeping and temporary fitting allocations. Quantization between separate
strokes can still lose detail; straight-segment event partition invariance is tested.

Both dictionaries are loaded for comparison. Their typed tables plus the shared
population-count/edge-difference tables occupy 79.75 KiB in total; polygon arrays,
endpoint-index maps, candidate lists and browser Path2D objects are additional. Only the selected
library's browser paths are built. Grid/diagnostic arrays and canvas buffers are
also separate; the UI reports display backing bytes, not total process memory.
The diagnostic reference contributes width x height x 4 backing bytes, included
in that counter; it is 3.81 MiB in the 100 x 100 comparison mode. It stores pixels only, with no stroke log, and is never used to paint,
correct or save the cell model. Edit timings now include reference rendering;
they are not isolated cell-engine measurements. This is standalone comparison
instrumentation, not a raster-engine addition to Studioodle.

Painted/boundary counters update from dirty cells without scanning the entire
grid each frame. Canvas2D redraws changed cells, using prebuilt paths and integer physical pixels
per cell. Resize redraws the page. Opaque colors draw over an opaque base; transparent
fronts erase their portion. No React, polygon union, worker or shader is involved.
There is no smoothing, undo, zoom, fills, stickers, source-art conversion or output
conversion. The normal app's engine and reviewer are unchanged. No production
speedup claim follows from this prototype. Track work in `docs/REFINEMENT-TASKS.md`.
