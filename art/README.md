# Sticker artwork

`stickers.json` is the complete source manifest for 71 hybrid definitions. It records
source paths, original-image crop rectangles and logical display dimensions. Raster
illustrations and their generation prompts remain in `source/`; the original garden
BMP remains the source for extracted sun/cloud/butterfly/window assets. Corrected
`source/winter/reindeer.png` is the accepted four-legged version.

The only production authoring command is `node scripts/build-stickers.mjs`. It handles
Light-preset raster tracing, existing vector artwork, region discovery, silhouettes,
hit masks, SVG thumbnails and catalog/type generation. Output goes to
`src/assets/vector/`, with region statistics in `conversion-report.json` and contact
sheets in ignored `work/hybrid/`.

Original illustration PNGs are source material, not runtime paint layers. Old binary
masks, pixel-row SVGs, rejected reindeer source, comparison traces and pilot assets
were removed after migration. See `docs/HYBRID-ENGINE.md` for the current pipeline and
`docs/STICKER-CONVERSIONS.md` for inventory/review status.

Horizon sources use un-stroked closed white silhouettes plus separate visible horizon paths. The manifest `horizon` flag adds closed boundaries only to offline region analysis; these boundaries never enter runtime ink or previews. Keep the extended lower silhouette when editing these sources.

Enclosed negative space is authored with `cutouts: [[x, y], ...]` in the sticker manifest. Each seed lies inside one enclosed white region in logical sticker coordinates. The offline builder floods those regions as outside before constructing paint regions, hit coverage, and the vector silhouette. This keeps holes transparent in the editor and SVG previews while retaining their ink outlines. Seeds that hit ink, outside space, or another cutout fail conversion rather than silently changing the asset.

Mask analysis uses the final traced SVG, with finer sampling for small artwork and an ink-midpoint backing boundary. See `docs/HYBRID-ENGINE.md` for the sampling/memory policy and the distinction between offline masks and bucket behavior underneath overlapping stickers.

The safari animals come from `source/animals/safari-sheet.jpg` (1408 ? 768). Manifest crops isolate 12 animals at their native pixel density. This source is usable for smooth broad outlines; the small spotted/striped details are the limiting factor. Future source artwork should preferably be lossless PNG with each animal roughly 1000?2000 pixels tall, clean black outlines, no shading, white margins, and clear enclosed fill areas. More decoration is unnecessary; higher-resolution, cleanly separated lines improve tracing.

Space sources are in `source/space/`. Alien and spaceship use cropped Light Potrace conversions. `node scripts/build-crater-source.mjs` traces the original crater and composes `crater-horizon.svg` with an open rolling horizon, closed hidden ground boundary, extended cracks, and a few peripheral rocks. Run `node scripts/build-stickers.mjs space-crater` afterwards to rebuild its hybrid definition.

Horizon placement is declared by `horizon: true` and optional `horizonStart` (a page-height fraction) in the manifest/catalog. They start at full page width behind other stickers. Ground depth is accounted for so the bottom remains covered on portrait pages. The crater starts higher than ordinary horizons to keep its large landmark visible.
