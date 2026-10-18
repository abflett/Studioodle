# Hybrid sticker engine

Start with [How stickers actually work](STICKER-PIPELINE.md) for the source-to-screen
walkthrough, SVG/JSON responsibilities, loading behavior and measured data costs.

All catalogued stickers use one engine. `art/stickers.json` is the source inventory;
`scripts/build-stickers.mjs` generates definitions under `src/assets/vector/`.
The old binary-outline renderer, procedural raster shapes, legacy operation imports,
pilot-only definition and version-1/2 save readers have been removed.

## Authoring

Run `node scripts/build-stickers.mjs` from the repository root, or pass one asset ID
to regenerate that definition. Requires ImageMagick and Potrace. Set `POTRACE_PATH`
or place the portable executable at `work/tools/potrace/potrace-1.16.win64/potrace.exe`.
No authoring binary is bundled with the application.

Raster sources use the agreed Light preset at source resolution: alpha onto white,
grayscale, Gaussian sigma 0.04 times estimated stroke width, 50% threshold, Potrace
alpha max 1.2 and optimization tolerance 0.5 times stroke width / 12. Short-run mode
estimates stroke width; speckle suppression scales with its square. Garden BMP crops
isolate the main connected outline and its enclosed ink to reject neighboring marks.
Source dimensions map to the authored logical sticker dimensions recorded in the manifest.

Authored SVG shapes retain their vector paths/strokes. Primitive circles/rectangles
are represented as vector paths, not traced pixel contours. Later white-filled shapes
occlude earlier outlines through inverse clipping, so overlapping petals/pickets stay
correct without painting white over the user's colors.

The builder samples final SVG ink at 4x logical resolution for assets up to
300,000 logical pixels and 2x for larger artwork to bound region-map memory. It
discovers 4-connected enclosed regions, applies authored cutouts, then propagates
categorical IDs through ink from both interior and exterior. IDs are never blended.
The white/paint backing uses the interior side of that propagation, placing its
boundary near the ink midpoint instead of applying fixed erosion to thin details.
It is traced with a 0.05-logical-pixel optimization tolerance. Standalone ink specks
get no white backing. Hit coverage still includes the ink for selection.
`art/conversion-report.json` records region counts and tiny-region review flags.
View generated authoring sheets under `work/hybrid/`.
Run `node scripts/preview-scenes.mjs` for offline compositions of the built-in coloring
pages under `work/hybrid/scenes/`.

## Runtime

Each scene contains a fixed rectangular background surface and placed stickers.
A definition stores immutable line art, a silhouette, categorical region map and hit
mask. Each instance stores transform, outline color and its own RLE raster paint.

Rendering order per sticker is base white, raster paint clipped to silhouette, then
colored vector ink. Whole composites follow scene order. Canvas2D renders only the
visible viewport at device resolution; Phaser supplies input and the selection overlay.
PNG export redraws at output resolution. Raster paint uses 150 DPI against 96 logical
scene units per inch; brush size, patterns and Fit-relative zoom use logical units.

Brushes cross internal regions beneath protected ink and use visible ownership.
Bucket clicks choose the visible surface; the flood then follows that surface's own
region IDs and connected paint colors, continuing behind foreground stickers. Hidden
stickers therefore do not leave unfilled background silhouettes when moved. The former
four-unit bleed band is removed. Existing paint boundaries still stop a fill, and only
the clicked surface changes. Boundary checks use cached hit masks rather than per-pixel
vector queries. Fill queues are reused. Erasing reveals the surface base.

For the reindeer, an offline comparison sampled at 8x found 35 backing pixels beyond
the SVG exterior before this change and zero afterwards, with zero uncovered interior
pixels in both cases. This checks mask alignment, not runtime interaction. Existing
unpainted patches in saved pictures remain existing paint data; fill them once to
repair them rather than expecting a conversion to rewrite saved artwork.

## Loading and memory

The catalog contains lightweight dimensions and SVG thumbnails. Full JSON definitions
are separate lazy Vite imports and are prepared only for a chosen scene, thumbnail or
sticker. Instances share decoded geometry/masks; paint remains per instance. Parsed
source packs use a 24-entry cache; decoded definitions stay available during editing
for duplicate/undo and are released when leaving the editor. Placed instances retain
their references while alive. There is no preload of the whole collection at splash.

## Persistence and intentional break

Only version-3 documents are read/written, under `studioodle.v3.picture.` keys.
Earlier development pictures are ignored; there is no compatibility renderer or
migration. Earlier keys are not automatically deleted from the browser. Definitions
and logical dimensions are regenerated from the manifest; any future incompatible
change needs an explicit document-version decision.

Built-in scenes and every picker item use these definitions. The generated
[asset catalog](../art/CATALOG.md) is the current inventory; `art/conversion-report.json`
records conversion statistics. Add specific artwork issues alongside the affected
manifest/source rather than maintaining a second conversion checklist.

## Review

Inspect generated contact sheets and scene compositions after artwork changes.
Review fills, outlines at zoom, transforms, undo, save/reopen, PNG output and printing
in the app. Offline mask checks do not establish interaction correctness. Tiny regions
are retained for fidelity unless a specific artwork correction is requested.

## Sticker focus

Focus is transient editor state, not part of the saved document. It hides the paper and all other stickers, and restricts paint ownership, fill, brush, erase, and selection to the focused silhouette, including its cutouts. Saved documents and exports still contain the whole scene.

The drawer persists when switching to brush, fill, erase, pan, or select. Zoom cycles around the focused sticker's fitted view. Focus can be tapped again to refit after moving or transforming the sticker. The checkmark ends focus, restores the previous page view, and selects the bucket. Empty-space clicks do not dismiss focus. Adding, duplicating, deleting, and changing layer order are disabled until focus ends. Undo within focus stops at entry so it cannot remove the focused sticker; those earlier undo steps remain available after leaving focus.

## Precision bucket input

`usePrecisionFill` owns the bucket's captured pointer gesture above Phaser. A quick tap sends a logical `fill-at` command on release. After 500ms, the hook temporarily magnifies around the live pointer, then maps the release through the current view transform before restoring the previous view. Phaser's pointer-down bucket path is disabled to prevent duplicate or premature fills. The engine still owns region/color flood filling, focus restrictions, and undo snapshots. Brush and sticker movement continue to use Phaser input.
