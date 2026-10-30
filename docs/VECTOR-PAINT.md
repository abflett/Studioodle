# Vector painting

Ordinary page and sticker paint is vector geometry. The isolated experimental spray overlay is pixel-only; it never enters vector fill topology. There are no raster flood-fill queues or density upgrades. Disposable display caches accelerate complex surfaces without becoming document paint. Canvas2D rasterizes the vectors only at the visible/output resolution, as browsers do for SVG. Compact categorical hit arrays remain shared per sticker definition; these are interaction data, not paint.

`Artwork` owns transforms, layer ordering and visible surface selection. `Surface` has a vector definition (a rectangle for the page) and `VectorPaint`. A swept brush shape is transformed into each surface, intersected with its regions, and removed from the coverage passed to lower layers. Erasing restores white on stickers or the page's original background color.

Ordinary ink and square strokes use swept convex brush outlines. Round and diagonal tips retain their numeric vector outlines. Input nodes snap to a 1/64 logical-unit grid. Scatter instead uses the isolated raster overlay described below.

The exact SVG region curves clip rendering. Lazy adaptive flattening (0.01 logical-unit tolerance) supplies polygon geometry for intersections and connected-component filling. It handles SVG arcs, quadratic/cubic curves, transforms, holes and separate components. The display retains the original curves.

Boolean geometry uses Clipper2 with a shared 1/4096 logical-unit lattice for both inputs and calculated intersections. This is vector coordinate precision, not a pixel buffer. Ring winding and nested holes are normalized at the boundary. The former floating-point sweep engine was removed after repeated brush intersections caused incomplete-ring and sweep-queue errors.

A region has a backing paint style and colored blobs. Bucket clicks on a blob recolor its connected polygon. When strokes divide a backing into separate areas, polygon difference identifies the clicked component; a closed brush outline on the page can be filled without recoloring the outside. Dots, stripes and checks are vector paths with a compact pattern descriptor, not bitmap tiles.

Disjoint color paths rasterized separately can expose the backing through their partially covered shared-edge pixels, even when their coordinates meet exactly. Mixed paint therefore receives a two-device-pixel solid-color underpaint before its exact paths are drawn. That underpaint is clipped to the combined paint coverage and the original region, so it cannot enlarge the brush outline or alter saved/hit geometry. Single-style paint skips this pass. The combined coverage Path2D is cached and extended as strokes arrive.

A module worker batches same-style coverage, unions it, subtracts new coverage from other styles, and drops fully hidden geometry. Completed-prefix checks preserve edits made during a job. Merging runs periodically during continuous painting (120 ms scheduling interval, one live job per paint instance) and immediately on stroke release; input no longer restarts an idle-only timer. Pending geometry draws and saves immediately; undo captures affected regions through shallow checkpoints with shared immutable geometry. History checkpoints compact independently in the worker; they never rewrite the live drawing.

Opening the editor starts loading the worker before the first fill. Restoring saved paint is read-only: previews and exports do not enqueue maintenance. Undo restores compacted checkpoints directly; a pending checkpoint can schedule live cleanup after restoration. A bucket request waits for its surface's in-flight merge and then uses that result, rather than queuing a second merge of the same raw samples. Same-style samples use balanced union batches so long strokes do not repeatedly reprocess a growing outline.

Bucket topology on painted regions also runs in that worker. It does not compact brushes synchronously inside the pointer handler. The editor queues subsequent commands and gestures until the fill completes, preserving fill/brush/save/undo order. A revision check rejects stale results. Filled results are fully compacted before publication, including merging touching same-style blobs and removing replaced coverage. The first displayed frame therefore uses final color boundaries rather than retaining an old-color antialias fringe until later maintenance. Accepted fills are marked stable instead of scheduling a redundant cleanup job. A failed job preserves paint, and later edits may retry compaction.

Repeated coverage compacts, but more visible islands and color edges require more geometry. Undo also retains earlier states. There is no promise of constant memory for arbitrary drawings. Worker failure preserves original geometry rather than deleting paint.

## Current data format

Picture/document format is 6; coloring-book format is 2. Surfaces optionally
contain `vectorPaint` (version 1), with region IDs, backing styles and blob geometry,
and experimental `rasterSpray` (version 1) pixel sections. The current IndexedDB
namespace is `studioodle-library-v9`; schema 2 also owns pages and thumbnails.
Old general raster paint runs and density fields remain unsupported.


Geometry-only coloring-page export removes vector paint. PNG output defaults to 300 DPI, with 150/600 DPI choices; `renderPicture` accepts an output DPI without changing stored paint. Print, SVG and PDF output retain ordinary vectors and embed spray PNG sections. See [picture output](PICTURE-OUTPUT.md); PNG resolution choices do not affect SVG/PDF output.

## Verification

`npm test` covers geometry, compaction, serialization, validation, books and session transactions. `npm run test:browser` runs real browser/worker checks for SVG hits, solid fill edges, vector textures and patterns, page outline filling, save/restore, undo after compaction, concurrent edits, erasing and rendering at a higher resolution. It writes a crop to `work/tests/moon-vector-paint.png`.

The browser suite begins with a fresh-worker ink test on a blank A4 canvas, before other checks can warm it. A 2,400-sample outline is filled immediately after release and filled again, with a first-fill latency limit. A unit test verifies that read-only restores do not start a worker or queue jobs.

The seam regression leaves a pale pocket beside dark ink, purple fill and dark background, then checks five output scales (0.75–8x) for leaked pale pixels, retained antialiasing and unchanged outer paint bounds. `node scripts/test-browser.mjs --debugger` also attaches the browser debugger to the page and worker with async stack tracking; this does not emulate every DevTools panel or setting.

Runtime painting is independent of offline source conversion. See [the sticker pipeline](STICKER-PIPELINE.md) for current source authoring and region cleanup.

Paint maintenance is indexed by region ID and submits only dirty regions. Solid
whole-region fills avoid worker geometry entirely. The shared `paintWorker.ts`
client owns transport, and both execution paths call the same `runPaintJob`.
Closing/deleting/replacing artwork cancels delayed maintenance and rejects stale
results; undo snapshots remain independent.

## Brush responsiveness

The smoothing trail is capped at two screen pixels rather than six, with a brief
frame-driven catch-up when the pointer pauses. Curves remain causal; no background
job reshapes already committed paint. Continuous input no longer postpones live
compaction indefinitely, limiting accumulated raw blobs while a long stroke runs.

`regionSearch.ts` builds a conservative bounds grid lazily for definitions with at
least 24 regions. The grid is shared through a WeakMap and preserves original region
order. It selects candidates only; exact polygon intersections and SVG display
clipping remain authoritative. Small definitions keep the simple bounds scan.

Fully contained paper strokes skip redundant rectangular booleans. Page-edge
strokes still clip, and lower-layer coverage subtraction remains in place wherever
another layer can receive the remaining paint. Focused painting and the bottom
paper need no subtraction after their final surface.

`node scripts/test-browser.mjs --brush-profile` runs the browser regressions plus a
seeded diagnostic trace on blank paper, Moon Sorceress ink and spray, writing
`work/tests/brush-profile.json`. Timings are diagnostic rather than test thresholds.
A warmed local comparison against `eb5ca54` processed 120 samples in approximately
65.4 -> 55.6 ms for ink, 269.3 -> 242.7 ms for spray and 8.3 -> 2.4 ms for blank
paper. These are synchronous brush-processing totals, excluding display rendering,
worker time and end-to-end input latency. Region-bound reads fell from 23,400 to
1,304 for ink and 1,693 for spray, including index construction. First-use curve
flattening and exact clipping still have costs; this is not a promise of identical
speedups across devices or artwork.


### Dense paint rendering

Brush polygons build cached `Path2D` objects with numeric `moveTo`/`lineTo` calls,
without serializing SVG path text. The viewport adds new clipped coverage to
complex-surface display caches incrementally. Worker compaction preserves coverage,
so it does not invalidate that display. Fills and undo repaint the existing buffer
in place when its dimensions still fit. Saves, hit testing, previews, exports and
print use vector data; output never enlarges cached screen pixels.

`Artwork.render` prepares the whole visible working set before drawing any member.
Large surfaces cache the visible area plus 18% margins for panning; small surfaces
can keep their whole image. Pan reuses covered pixels. Zoom reprojects existing
images while moving and requests a refinement after 150 ms of quiet. Cropped
windows rebuild when new areas become visible. Rotation and flips use inverse
view transforms for the local coverage window.

All display caches share a 64 MiB RGBA pixel ceiling with LRU retention for inactive
surfaces. This is a ceiling, not a startup allocation. Planned members cannot evict
one another during the same frame: the planner fits their combined target to 90%
of the budget and evicts unused caches first. Under pressure it quantizes a shared
resolution reduction instead of rebuilding the same visible surfaces endlessly.
The remaining headroom handles rounding and inactive reuse. Buffers are released
with their artwork. This is presentation data, never document paint or a hit map.

The budget counts `width * height * 4`, excluding main-canvas pixels, geometry,
undo, worker copies, browser/GPU overhead and storage. It is not a total app memory
limit. The advanced 26-sticker fixture used roughly 9?60 MiB across its measured
views. A repeated 128 MiB comparison did not establish a response-time advantage,
so the default remains 64 MiB. See [the follow-up measurements](PERFORMANCE.md).

Worker jobs carry the length of the already-compacted, disjoint color prefix.
Only new coverage must be compared against those partitions. Accepted results
release obsolete native path caches; history retains immutable geometry only.

`node scripts/test-browser.mjs --dense-profile` adds a dense multicolor diagnostic
and writes metrics plus a PNG under `work/tests/`. It forces a pixel readback to
include deferred Canvas rasterization; that diagnostic is not a hardware frame-rate
measurement. The advanced scene diagnostic uses normal visible rendering without
per-frame readbacks. Initial builds, fills, undo, newly exposed crop windows and
settled zoom refinements still require vector drawing.

## Experimental raster spray (31 October 2026)

`rasterSpray.ts` owns pixel storage, section snapshots and rendering. Artwork routes
scatter to it before constructing any vector stroke geometry. Each surface owns
sparse 128x128 RGBA sections at fixed local resolution (up to 1536px long edge and
1,048,576 pixels before section padding). There is no retained particle list.
Soft radial dabs accumulate RGB/alpha; palette colors resolve when painted.
Later palette edits do not change these pixels. Fill operates on vector paint only.
The order is ordinary paint, raster spray, then line art; later ordinary brushwork
remains below spray. The eraser affects both paint layers with existing surface
ownership and clipping.

Prior sections are captured once per action, included in the 128MiB undo budget,
and restored on cancellation/undo. Detached save checkpoints share immutable
RGBA typed-array section records; live canvases mutate independently. Format 6 surfaces
have an optional `rasterSpray` version 1 field. Empty surfaces allocate no raster.
SVG/PDF/print embed PNGs made from the same pixels; PNG/gallery use normal Artwork
rendering. Zoom never upgrades the authoritative spray resolution. This is a
removable experiment, not a second general painting engine or cell integration.

The fixed per-surface pixel cap does not cap whole-scene or undo memory. Existing
vector spray in development drawings remains vector data; new spray uses pixels.
Physical-device speed, heavy sticker overlap and user acceptance remain to test.

`node scripts/test-browser.mjs --raster-spray` checks section undo, erasing both
layers, fill isolation, IndexedDB/reload, detached checkpoints, sticker lifecycle,
overlap ownership, 4x section seams and SVG/PDF bitmap output. It writes diagnostics
and a preview under ignored `work/tests/`. A seeded 640x480 three-pass multicolor
stress run retained 20 sections (1.25MiB authoritative RGBA; excludes canvases,
masks, undo and browser overhead), with zero vector paint blobs. One local headless
Chromium run measured ~286/282/273ms aggregate pass submission, ~1.9ms p95 input
call (~9ms maximum), ~1.2ms checkpoint capture and ~11ms for 20 renders plus a
readback. These are synthetic desktop timings, not hardware frame-rate, full app
input latency or Android guarantees. Initial mask construction and heavily
layered sticker scenes still need measurement.

## Local brush and fill work (31 October 2026)

Ordinary paint remains numeric vector geometry at the existing 1/64 brush and
1/4096 boolean precision. A conservative boundary-cell index can prove a brush's
entire bounds are inside a region: cells crossed by any outer/hole boundary are
never accepted. Interior cells reuse one exact inside/outside classification;
uncertain cases still perform exact clipping. Narrow regions retain the ordinary
path. This is a boolean-work shortcut, not raster paint or approximate clipping.

Immutable sticker boundaries register Clipper's reusable input data, avoiding
repeated coordinate normalization and vertex allocation across samples. An LRU
caps retained data at 8MiB of conservative estimates (not measured heap bytes),
separate from the display-cache budget. Live paint is never registered here.
Brush disc offsets also reuse a bounded radius table; chord tolerance is unchanged.

Worker compaction bounds-checks disconnected paint components before subtraction
or merging. Distant islands retain their geometry instead of entering every
boolean. Single-component dense geometry and large complex brush batches keep the direct boolean path. A fill
moves its already-disjoint connected component from the old style to the new
style and merges only that destination; other colors need no repeated subtraction.
Backing components still use exact boundary difference. Fill dispatch retains a
shallow immutable checkpoint instead of cloning it once before postMessage clones
it again. Existing revision checks, undo and asynchronous maintenance remain.

`node scripts/benchmark-paint.mjs work/tests/paint-model.json` runs repeatable
model diagnostics. `node scripts/test-browser.mjs --paint-profile` measures the
real Moon Sorceress brush trace and model workloads in Chromium; append
`--paint-baseline` to load the original modules from commit 26074b6 in the test
server only. Normal app builds contain one implementation. Tests preserve sampled
color signatures and cover holes/notches, remote components, destination merging,
immutable input reuse and prepared-cache accounting. Outputs stay in `work/`.

For longer dense/component-fill timing comparisons use
`node --expose-gc scripts/benchmark-paint.mjs --compare work/tests/paint-interleaved.json`.
This alternates baseline/current versions after ten warm-up trials, with thirty
measured trials each. See PERFORMANCE.md for timing scope and results.
