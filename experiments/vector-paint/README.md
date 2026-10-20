# Vector paint prototype

Enabled for newly placed, unpainted Moon Sorceress stickers. Existing raster paint and explicit raster density remain on the legacy path. Reload Vite and place a fresh sticker to compare.

## Model

Each SVG region has a backing color and painted color blobs. Normal round/square ink strokes sweep a convex capsule whose input coordinates snap to a 1/64 logical-unit grid. Rendering clips blobs to the original SVG region path and draws the ink above. Paint surfaces do not allocate a sticker-sized Uint32 paint array or RGBA paint canvas (a 1x1 context remains for compatibility); the shared hit lookup remains independent.

A module worker batches consecutive same-color geometry, unions coverage, subtracts new coverage from other colors, and drops fully covered shapes. It runs after short idle intervals and stroke release. Edits draw immediately while merging happens. Completed-prefix checks prevent stale results replacing concurrent edits. Vector-painted pictures use format version 4; version 3 raster saves remain readable, and clean coloring-page exports remain version 3. The existing local repository namespace is retained. Older builds reject version 4 rather than silently dropping vector paint. Saved/undo snapshots include pending geometry and are cloned, so saving never depends on worker timing.

Backing bucket fills preserve brush detail. Clicking a painted blob recolors that connected polygon component. Base-color filling is region-wide, rather than a flood fill of disconnected visible backing pieces. Erasing paints white and compaction removes redundant white coverage when the backing is already white.

## Deliberate prototype limits

- Only ordinary ink strokes, square strokes, erasing and solid buckets are vector-native. Textured brushes and patterned fills convert this surface to the existing page-resolution raster path while preserving its current appearance.
- Geometry is clipped to exact SVG curves at render time. Stored brush geometry is not yet physically trimmed against the curved region outline. Color-over-color boolean subtraction is performed in the worker.
- Input snapping limits redundant input precision; boolean intersections retain precision to avoid topology damage. There is no arbitrary node cap that silently drops visible detail.
- More visible color islands/edges can require more nodes. Undo history also intentionally retains previous states. Memory is not constant for all possible drawings.
- Vector brush paint belongs to its sticker; other stickers visually occlude it. It can remain underneath them when they are moved, like region fills. Raster brush ownership behavior remains unchanged elsewhere.
- The normal PNG/print export still targets the existing page DPI. Paint itself can render at higher resolution (covered by the browser check); new export controls and SVG document export are separate work.
- Other stickers and free page drawing keep their existing engine.

## Verification

`npm run check:regions` now also tests real worker merging, concurrent edits, vector save/restore, undo after compaction, erasing, textured fallback and higher-resolution rendering. It writes `work/moon-vector-paint.png` for visual review.

A 400-stroke repeated two-color fixture compacted to about 1.7 KB. The unit test also checks 1,000 identical strokes compact to one stable outline. Those fixtures demonstrate repeated-coverage behavior, not a universal memory bound.

Boolean operations use the MIT-licensed [polygon-clipping](https://github.com/mfogel/polygon-clipping) library (0.15.7).
