# Vector painting

All page and sticker paint is vector geometry. There are no color rasters, per-surface image buffers, pixel flood-fill queues, density upgrades, or texture-tool fallbacks. Canvas2D rasterizes the vectors only at the visible/output resolution, as browsers do for SVG. Compact categorical hit arrays remain shared per sticker definition; these are interaction data, not paint.

`Artwork` owns transforms, layer ordering and visible surface selection. `Surface` has a vector definition (a rectangle for the page) and `VectorPaint`. A swept brush shape is transformed into each surface, intersected with its regions, and removed from the coverage passed to lower layers. Erasing restores white on stickers or the page's original background color.

Ordinary ink and square strokes use swept convex brush outlines. The brush style adds bristles; pencil and spray generate vector particles. Input nodes snap to a 1/64 logical-unit grid. Textures require genuine geometry and may grow more than solid brushwork. None of the styles converts to raster.

The exact SVG region curves clip rendering. Lazy adaptive flattening (0.01 logical-unit tolerance) supplies polygon geometry for intersections and connected-component filling. It handles SVG arcs, quadratic/cubic curves, transforms, holes and separate components. The display retains the original curves.

Boolean geometry uses Clipper2 with a shared 1/4096 logical-unit lattice for both inputs and calculated intersections. This is vector coordinate precision, not a pixel buffer. Ring winding and nested holes are normalized at the boundary. The former floating-point sweep engine was removed after repeated brush intersections caused incomplete-ring and sweep-queue errors.

A region has a backing paint style and colored blobs. Bucket clicks on a blob recolor its connected polygon. When strokes divide a backing into separate areas, polygon difference identifies the clicked component; a closed brush outline on the page can be filled without recoloring the outside. Dots, stripes and checks are vector paths with a compact pattern descriptor, not bitmap tiles.

Disjoint color paths rasterized separately can expose the backing through their partially covered shared-edge pixels, even when their coordinates meet exactly. Mixed paint therefore receives a two-device-pixel solid-color underpaint before its exact paths are drawn. That underpaint is clipped to the combined paint coverage and the original region, so it cannot enlarge the brush outline or alter saved/hit geometry. Single-style paint skips this pass. The combined coverage Path2D is cached and extended as strokes arrive.

A module worker batches same-style coverage, unions it, subtracts new coverage from other styles, and drops fully hidden geometry. Completed-prefix checks preserve edits made during a job. Merging runs after brief idle periods and stroke release. Pending geometry draws and saves immediately; undo captures affected regions through shallow checkpoints with shared immutable geometry. History checkpoints compact independently in the worker; they never rewrite the live drawing.

Opening the editor starts loading the worker before the first fill. Restoring saved paint is read-only: previews, exports and undo restoration do not enqueue maintenance. A bucket request waits for its surface's in-flight merge and then uses that result, rather than queuing a second merge of the same raw samples. Same-style samples use balanced union batches so long strokes do not repeatedly reprocess a growing outline.

Bucket topology on painted regions also runs in that worker. It does not compact brushes synchronously inside the pointer handler. The editor queues subsequent commands and gestures until the fill completes, preserving fill/brush/save/undo order. A revision check rejects stale results. A failed job preserves paint, and later edits may retry compaction.

Repeated coverage compacts, but more visible islands and color edges require more geometry. Undo also retains earlier states. There is no promise of constant memory for arbitrary drawings. Worker failure preserves original geometry rather than deleting paint.

## Current data format

Picture/document format is 5; coloring-book format is 2. Surfaces optionally contain `vectorPaint` (version 1), with region IDs, backing styles and blob geometry. Old paint runs, paint-density fields and format versions are rejected. New development libraries use `studioodle.v5.picture.`, `studioodle.v5.coloring.` and `studioodle.workshop.v2`. There are no compatibility decoders or migrations. Bundled layouts have been updated directly.

Geometry-only coloring-page export removes vector paint. PNG and normal print output still default to 150 DPI; `renderPicture` accepts an output DPI without changing stored paint. SVG document export and new DPI UI controls are separate features.

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
