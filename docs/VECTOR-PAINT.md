# Vector painting

All page and sticker paint is vector geometry. There are no color rasters, per-surface image buffers, pixel flood-fill queues, density upgrades, or texture-tool fallbacks. Canvas2D rasterizes the vectors only at the visible/output resolution, as browsers do for SVG. Compact categorical hit arrays remain shared per sticker definition; these are interaction data, not paint.

`Artwork` owns transforms, layer ordering and visible surface selection. `Surface` has a vector definition (a rectangle for the page) and `VectorPaint`. A swept brush shape is transformed into each surface, intersected with its regions, and removed from the coverage passed to lower layers. Erasing restores white on stickers or the page's original background color.

Ordinary ink and square strokes use swept convex brush outlines. The brush style adds bristles; pencil and spray generate vector particles. Input nodes snap to a 1/64 logical-unit grid. Textures require genuine geometry and may grow more than solid brushwork. None of the styles converts to raster.

The exact SVG region curves clip rendering. Lazy adaptive flattening (0.01 logical-unit tolerance) supplies polygon geometry for intersections and connected-component filling. It handles SVG arcs, quadratic/cubic curves, transforms, holes and separate components. The display retains the original curves.

A region has a backing paint style and colored blobs. Bucket clicks on a blob recolor its connected polygon. When strokes divide a backing into separate areas, polygon difference identifies the clicked component; a closed brush outline on the page can be filled without recoloring the outside. Dots, stripes and checks are vector paths with a compact pattern descriptor, not bitmap tiles.

A module worker batches same-style coverage, unions it, subtracts new coverage from other styles, and drops fully hidden geometry. Completed-prefix checks preserve edits made during a job. Merging runs after brief idle periods and stroke release. Pending geometry draws and saves immediately; undo snapshots are cloned and never rewritten by compaction.

Repeated coverage compacts, but more visible islands and color edges require more geometry. Undo also retains earlier states. There is no promise of constant memory for arbitrary drawings. Worker failure preserves original geometry rather than deleting paint.

## Current data format

Picture/document format is 5; coloring-book format is 2. Surfaces optionally contain `vectorPaint` (version 1), with region IDs, backing styles and blob geometry. Old paint runs, paint-density fields and format versions are rejected. New development libraries use `studioodle.v5.picture.`, `studioodle.v5.coloring.` and `studioodle.workshop.v2`. There are no compatibility decoders or migrations. Bundled layouts have been updated directly.

Geometry-only coloring-page export removes vector paint. PNG and normal print output still default to 150 DPI; `renderPicture` accepts an output DPI without changing stored paint. SVG document export and new DPI UI controls are separate features.

## Verification

`npm test` covers geometry, compaction, serialization, validation, books and session transactions. `npm run check:regions` runs real browser/worker checks for SVG hits, solid fill edges, vector textures and patterns, page outline filling, save/restore, undo after compaction, concurrent edits, erasing and rendering at a higher resolution. It writes a crop to `work/moon-vector-paint.png`.

Runtime painting is independent of offline source conversion. Tiny-region ink cleanup still needs tuning on Moon Sorceress before bulk sticker rebuilding. Generated SVGs are not being blanket-reprocessed as part of the paint engine change.
