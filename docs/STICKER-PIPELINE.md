# Sticker pipeline

Each runtime sticker is one SVG containing closed paint-region paths and visible
ink. Paper and sticker paint are vector geometry; categorical raster arrays are
shared hit-test data, not paint buffers. Original art is never shipped to the editor.

## Authoring files

- `art/stickers.json`: accepted source path, crop, dimensions, subject metadata and
  optional horizon/cutout/cleanup settings.
- `art/source/stickers/<pack>/`: original artwork, accepted editable SVGs and generation metadata.
- `src/assets/vector/<id>.svg`: generated runtime region/ink geometry and picker image.
- `src/assets/vector/catalog.json`, `src/assets/assetLibrary.json` and
  `src/editor/stickerKinds.ts`: lightweight generated metadata from the manifest.

`npm run assets:catalog` validates all source/runtime paths and dimensions, refreshes
runtime metadata, and writes a searchable HTML/JSON/Markdown library into `work/catalog/`.
Catalog page-usage references come from the canonical `src/assets/coloringBook.json`.

## Convert and inspect

```sh
node scripts/build-stickers.mjs <asset-id>
node scripts/build-stickers.mjs --pending
node scripts/build-stickers.mjs <raster-source-id> --inspect=work/inspection/<asset-id>
```

Requires ImageMagick and Potrace. Set `POTRACE_PATH`, or install the portable binary at
`work/tools/potrace/potrace-1.16.win64/potrace.exe`. Conversion intermediates live in
`work/assets/`; inspection captures are also generated output. The inspection option
captures the current numbered stages without replacing runtime art or catalogs.
`--inspect-threshold=<percent>` supports diagnostic threshold comparisons for raster
sources. Accepted authored SVGs bypass bitmap normalization and ink retracing.

The default build converts the complete manifest. Prefer a single asset while
reviewing changes. `--pending` skips assets whose runtime SVG already exists;
explicitly rebuild an ID after changing its source. Conversion never overwrites source
art or regenerates hand-edited source shapes. It refreshes metadata after completion.

## Offline conversion

Raster sources are cropped, composited onto white and normalized to grayscale.
Estimated stroke thickness sets a small Gaussian blur (0.04 times stroke width),
50% threshold, Potrace tolerance and speckle suppression. Extracted sheets isolate
the main connected outline so neighboring subjects do not enter the sticker.

The final ink is analyzed independently of runtime lookup density: typically 8x
for small artwork and 4x/2x for larger scenery, within a bounded pixel budget.
Connected white components become regions; exterior space and explicit cutout seeds
are excluded. Labels extend under ink toward its centerline. Each region is traced
into a closed vector path with tight fitting tolerance. There is no extra boundary
expansion toward neighboring line edges.

Optional `minimumRegionAreaPixels` measures white components at their largest
proportional A4 fit at 150 DPI. Authoring-only Paper.js removes true tiny hole
contours and unions curved local caps for raster-split pockets. The updated ink is
rendered again and regions are rediscovered. This rule remains opt-in while assets
are reviewed; the curated Moon Sorceress uses a 10.2-square-pixel cutoff.

Authored SVG sources retain curved line art. Later white shapes occlude earlier ink
through generated inverse clips. The same clips apply to SVG previews and Canvas2D
rendering. Horizon closures affect analysis without drawing a box around scenery;
interior backgrounds keep their walls/floor paintable. Manifest cutout seeds define
intentional transparent openings and fail conversion when they hit ink/outside space.

```xml
<svg viewBox="0 0 340 480" data-region-format="1"
     data-region-scale="4" data-analysis-scale="8" data-bounds="...">
  <g id="regions" fill="white">
    <path id="region-1" data-bounds="..." transform="matrix(...)" d="..."/>
  </g>
  <g id="ink">
    <path id="ink-1" fill="black" stroke="none" transform="matrix(...)" d="..."/>
  </g>
</svg>
```

The region union supplies the backing/silhouette. Optional authored IDs are assigned
when absent; saved vector paint refers to those IDs. Region regeneration can change
IDs and invalidate development drawings. This pre-release app provides no migrations.

## Runtime loading and painting

The picker and editor use the same external SVG URL. Definitions load on demand,
not as a startup download of the entire library. The decoder samples each region
separately so antialiased color mixtures cannot invent IDs. Visible ink inherits a
nearby region for line clicks; isolated ink blocks click-through without inventing
paintable space. Temporary masks and propagation scratch are released.

IDs use one byte where possible, otherwise two (four at the maximum ID limit), plus
compact ink flags. Instances share the immutable lookup and lazy boolean geometry.
Original SVG curves clip rendering. Source text is retained up to the shipped catalog (about 24 MB of SVG files); decoded
interaction definitions are released when leaving the editor.

[Vector painting](VECTOR-PAINT.md) explains brush geometry, worker merging,
connected-component fills, seam rendering and output. Documents store only vector
paint, transforms and asset IDs; they never store lookup arrays or color rasters.
