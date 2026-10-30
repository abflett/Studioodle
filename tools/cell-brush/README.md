# Cell brush experiment

Run `npm run cells` and open http://localhost:1434/. This isolated Vite app imports
neither the normal app nor the reviewer and has no persistent storage. The user
runs the server manually. Build output and test screenshots go under ignored
`work/`. Commands: `cells:typecheck`, `cells:build`, `test:cells`.

## Libraries and controls

The page stays 100 x 100 cells. The new default is **Straight cuts (16 of 32
slots)**, with neighbor matching off. The previous **Experimental 32 shapes** and
**Original 8 profiles** remain in the dropdown; switching clears the page and
restores the library's matching default (on for the earlier modes).

Draw test strokes creates the same shallow line, sine curve, thin ellipse,
crossings and small marks in each mode. Draw circle dabs creates four solid circles
of different sizes. Toggle Match edges on release and redraw either example to
compare independent fits with joining. Diameter is 1-30 cells in quarter-cell steps.
Scroll the legend to inspect profiles; unused straight-library slots are reserved.

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

The brush accumulates 8 x 8 interior samples and 32 exact-boundary probes on each
of four cell edges for the active gesture. Edge probes evaluate the swept capsule
at shared geometric coordinates. Each group of eight edge probes chooses one
quarter-edge color by majority (ties favor incoming paint). Independent fitting
prioritizes these quarter-edge signatures, then interior coverage error. Matching
edge evidence is from the stroke itself, not a neighbor traversal or diffusion pass.
Both adjacent cells therefore see the same new-stroke evidence on a shared edge.

This is an approximation, not a universal watertightness guarantee: an individual
cell still supports only one straight cut and two colors. Sub-cell dots, narrow
bands, multiple boundary crossings and three-color junctions must lose detail.
Previous quantization, corner collapse and incompatible edge patterns can still
produce quarter-cell steps or small disagreements, especially for thin marks.
The circle fixtures test radial continuity and <=0.3-cell boundary error at three
radii with matching both off and on; they do not establish all-shape quality.

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
mode, the stroke-derived edge signatures remain part of that objective. Untouched
neighbors never change. No global optimum or arbitrary topology guarantee is claimed.

## Storage and rendering

Each cell has three packed bytes: profile/orientation, front slot and back slot.
The grid occupies 30,000 bytes (29.30 KiB), independent of stroke count. Slot zero
is transparent; paper is the container background. It is not white paint.

Temporary sample payload is at most 640,000 bytes for an earlier-library gesture,
or 1,920,000 bytes for straight cuts (64 interior + 128 edge samples per touched
cell). Buffers release on pointer-up, cancellation, blur or clear. This is scratch
coverage, not a saved raster or input-stroke log. UI totals exclude Map/object
bookkeeping and temporary fitting allocations. Quantization between separate
strokes can still lose detail; straight-segment event partition invariance is tested.

Both dictionaries are loaded for comparison. Their typed tables plus the shared
population-count/edge-difference tables occupy 79.75 KiB in total; polygon arrays,
candidate lists and browser Path2D objects are additional. Only the selected
library's browser paths are built. Grid/diagnostic arrays and canvas buffers are
also separate; the UI reports display backing bytes, not total process memory.

Canvas2D redraws changed cells, using prebuilt paths and integer physical pixels
per cell. Resize redraws the page. Opaque colors draw over an opaque base; transparent
fronts erase their portion. No React, polygon union, worker or shader is involved.
There is no smoothing, undo, zoom, fills, stickers, source-art conversion or output
conversion. The normal app's engine and reviewer are unchanged. No production
speedup claim follows from this prototype. Track work in `docs/REFINEMENT-TASKS.md`.
