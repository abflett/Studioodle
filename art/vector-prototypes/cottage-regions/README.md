# Cottage region inspection

Input: the accepted light-preset vector ink in `../pipeline/cottage-light.svg`. This is a region-discovery prototype, not an engine or asset-format migration.

Reproduce: `node scripts/inspect-cottage-regions.mjs` (Node + ImageMagick).

The SVG is rendered at twice its source dimensions (2624 × 2398), then thresholded at 128 for a binary ink barrier. Four-connected white areas touching any image border become exterior ID 0. Remaining enclosed white components receive distinct integer IDs. No gap closing, morphological edits or manual segmentation is used.

Result: 89 enclosed regions; none smaller than 16 source pixels squared. The report records each component's unexpanded area, bounds and centroid. IDs are generated in scan order for this exact trace and must not yet be treated as stable semantic identifiers across artwork changes.

Region IDs extend beneath ink by multi-source four-neighbor propagation, including exterior ID 0. These hidden boundaries approximate nearest-region boundaries in Manhattan distance, not exact vector centerlines. The outer half of a silhouette outline can therefore belong to exterior; a future silhouette mask must account for visible ink independently. Vector ink is rendered above the colored diagnostic map in the preview.

`regions.u16le.gz` stores the full map losslessly as row-major little-endian unsigned 16-bit IDs, gzip compressed (about 53 KB). It has no blended IDs. `regions.json` documents dimensions and metadata. Display PNGs use antialiasing only for presentation; they must not be decoded into region IDs.

`inspect.html` is self-contained: move or tap to inspect IDs and toggle the ink overlay. It uses browser DecompressionStream to read the included map. Colors are diagnostic, not suggested paint colors or heights. Distinct IDs may have similar colors. The image preview is rasterized for inspection; vector line art remains the source.

This establishes enclosed raster regions derived from vector ink, not clean vector region paths. Semantic grouping, native-resolution paint, regenerating maps at other scales, gap/leak handling and save compatibility remain future work. Visual inspection found the expected roof tiles, door planks, window panes, trim and masonry. No app tests or builds were run.
