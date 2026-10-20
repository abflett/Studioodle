# Hybrid sticker engine

All runtime stickers use the [single-SVG pipeline](STICKER-PIPELINE.md): SVG region
and ink paths on disk, shared raster lookup arrays in memory, and per-instance raster
paint. The old JSON-mask decoder remains only in benchmark fixtures, outside `src/`.

## Authoring

Run `npm run assets:build` (or `node scripts/build-stickers.mjs <asset-id>`) from the
repository root. Requires ImageMagick and Potrace. Set `POTRACE_PATH` or place the
portable binary at `work/tools/potrace/potrace-1.16.win64/potrace.exe`.
Authoring tools are not bundled with the application.

Raster tracing uses alpha onto white, grayscale, Gaussian sigma 0.04 times estimated
stroke width, 50% threshold, Potrace alpha max 1.2 and optimization tolerance 0.5 times
stroke width / 12. Speckle suppression scales with stroke width. Extracted garden crops
isolate the main outline and enclosed ink to reject neighboring marks.

Authored vectors retain their path/stroke geometry. The builder discovers four-connected
regions at 4x logical resolution for assets up to 300,000 logical pixels and 2x above
that size. Explicit cutout seeds become outside space. Region labels propagate under
ink from interior and exterior to approximate the centerline boundary. Every region
is traced with fine tolerance and no speckle removal, then stored as a closed SVG path.
Standalone exterior ink has no paint backing. Hidden horizon closures are not visible ink.

The SVG contains region paths, visible ink, optional inverse vector clips for authored
white-shape occlusion, logical bounds and analysis scale. `catalog.json` contains only
lightweight dimensions/placement data. `art/conversion-report.json` records region
counts and tiny-region review flags. Successful rebuilds remove obsolete per-asset JSON
transport files. Source artwork and manifest entries remain the editable source of truth.

## Runtime

`prepareStickers` fetches the same external SVG URLs used by the picker. The decoder
creates Path2D geometry and rasterizes each region into a temporary cropped alpha mask.
At 50% coverage it writes the integer ID to a shared Uint8Array or Uint16Array, with
first-region precedence for overlaps. Zero denotes outside and provides hit coverage.
No RGB ID blending or repeated geometric queries are used during normal painting.
The temporary masks are released after loading.

Every page and sticker uses vector backing styles and brush blobs. Exact SVG region paths clip display/output; a worker compacts same-style coverage and removes occluded colors. Shared hit maps remain independent of painting. See [Vector Painting](VECTOR-PAINT.md).

## Persistence and verification

Current documents use format 5 and fresh v5 picture/template namespaces. Old raster drawing formats are unsupported. Captured migration reports describe historical implementations; executable legacy paint comparisons have been removed. See `AGENTS.md` for the pre-release breaking-change policy.

Run `npm run check:regions` for browser paint/hit/worker regressions and `npm run assets:preview` for offline compositions. No bulk sticker conversion is being performed while tiny-region cleanup is under review.

## Sticker focus

Focus is transient editor state, not part of the saved document. It hides the paper and all other stickers, and restricts paint ownership, fill, brush, erase, and selection to the focused silhouette, including its cutouts. Saved documents and exports still contain the whole scene.

The drawer persists when switching to brush, fill, erase, pan, or select. Zoom cycles around the focused sticker's fitted view. Focus can be tapped again to refit after moving or transforming the sticker. The checkmark ends focus, restores the previous page view, and selects the bucket. Empty-space clicks do not dismiss focus. Adding, duplicating, deleting, and changing layer order are disabled until focus ends. Undo within focus stops at entry so it cannot remove the focused sticker; those earlier undo steps remain available after leaving focus.

## Precision bucket input

`usePrecisionFill` owns the bucket's captured pointer gesture above Phaser. A quick tap sends a logical `fill-at` command on release. After 500ms, the hook temporarily magnifies around the live pointer, then maps the release through the current view transform before restoring the previous view. Phaser's pointer-down bucket path is disabled to prevent duplicate or premature fills. The engine still owns region/color flood filling, focus restrictions, and undo snapshots. Brush and sticker movement continue to use Phaser input.
