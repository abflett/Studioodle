# Entire library: single-SVG migration

All 71 production stickers now use one SVG each. SVG contains region geometry,
visible ink and metadata; the loader builds shared categorical lookup arrays once.
Per-asset JSON transport and its runtime decoder have been removed from production.
The legacy decoder is retained only under `experiments/garden-house/` for comparisons.

## Evidence and reproduction

- [Baseline manifest](../../experiments/svg-migration/baseline.json) records sizes,
  dimensions, region counts, lookup bytes and source hashes from commit
  `c460b3e16d31cd67754b40531271b4f36612a8c8`.
- [Measured results](../../experiments/svg-migration/results.json) contain all per-asset
  comparisons, browser version, timings, checks and generated SVG hashes.
- [Before/after contact sheet](../../experiments/svg-migration/comparison.png): original
  left, converted right in every pair.
- [House experiment](GARDEN-HOUSE.md) preserves the earlier direct-path and runtime-map
  performance comparisons. [JSON baseline documentation](JSON-BASELINE.md) is historical.

```sh
npm run assets:build
npm run assets:preview
npm run benchmark:stickers
npm run check
```

Conversion requires ImageMagick and Potrace. The benchmark requires an installed
Chromium browser; set `BENCHMARK_BROWSER` if it is not found automatically. It starts
an isolated local browser and Vite on localhost:1433, then closes both. Original
baseline files are reconstructed from Git into ignored `work/svg-migration/baseline/`;
a checkout containing the baseline commit is required. No saved pictures are read or
rewritten. Use `/experiments/svg-migration/index.html` on the dev server for the visual
comparison after reconstructing the baseline.

## Size and retained lookup memory

MB means 1,000,000 bytes. Gzip uses Node's default compression level 6, independently
for each file in both versions; these are estimates rather than observed HTTP traffic.

| Measure | Original JSON + SVG pairs | Single SVG files |
| --- | ---: | ---: |
| Raw asset package | 28,004,263 bytes | 2,416,210 bytes |
| Gzip asset package | 2,446,830 bytes | 888,158 bytes |
| All shared lookup arrays decoded together | 268,309,640 bytes | 139,161,920 bytes |

That is about 91.4% less raw asset data, 63.7% less gzip data and
48.1% less retained lookup-array memory. The app does not normally load the full library.
SVG files remain external, fetched on demand; the picker and editor share their URLs.
The small `catalog.json` remains for dimensions and placement, without masks or geometry.

The figures exclude native Path2D memory, per-instance paint/canvas backings,
ownership/fill scratch arrays, browser overhead and temporary rasterization allocations.
The largest source SVG can still take noticeable CPU time to prepare; the existing
loading UI covers preparation. Single-pass per-asset decode timings are diagnostic,
not warmed-up performance guarantees. The house benchmark measures warmed-up fill and
brush behavior and showed runtime arrays recovering the original interaction speed.

## Fidelity and runtime checks

- All **2,541 regions** survive, both as paths and observable runtime IDs. No missing IDs.
- Every asset uses the actual SVG URL loader and raster-array lookup path; repeated
  preparation returns the same cached definition.
- Original ink and converted ink match pixel-for-pixel for all 71 assets at the
  240 x 180 comparison size. Authored circles/flowers/fences preserve white-shape
  occlusion with inverse vector clips. This is a finite-resolution check, not a proof
  of pixel identity at every transform or zoom.
- Full native analysis grids compare **126,263,360 samples**. **135,436 samples
  (0.1073%)** differ in region ID after path tracing and rasterization.
  These are predominantly boundary differences; **61 samples** also pass the
  eight-neighbor interior check and remain recorded for review. This is not claimed
  to be bit-identical reconstruction of the old maps.
- Twelve representative assets exercise actual fills, save/restore, horizontal flip,
  rotation/scale, duplication and PNG rendering, including small shapes, overlapping
  authored vectors, the house, reindeer, lion, large horizons, spaceship and crater.
  All checks pass.
- All six built-in scenes render through the updated offline compositor. Embedded
  instances prefix SVG IDs so clip references cannot collide.

IDs, logical dimensions, 150-DPI paint layout, transforms, version-3 document schema
and local-storage namespaces are unchanged. Existing paint is not rewritten. Slight
boundary differences can affect edge paint clipping or outer-ink click coverage.
Normal manual touch/desktop review remains useful; native dialogs and an installed
desktop build are not covered by this browser comparison.

## Current format and engine

The pipeline now always emits region/ink SVGs, retaining original ink curves and
tracing closed paint regions up to the existing centerline approximation. Successful
asset builds remove their obsolete generated JSON counterpart. Runtime no longer
branches between asset formats. Closed regions collectively define the silhouette.
Optional explicit region IDs aid diagnostics; absent IDs are assigned during decoding.

Masks are generated only on load from cropped alpha renders, then converted to integer
IDs. Antialiased colors are never treated as IDs. IDs up to 255 use Uint8Array; larger
values use Uint16Array. Nonzero membership also supplies hit coverage. Arrays and
vector geometry are shared between instances; paint remains independent per instance.

See [pipeline](../STICKER-PIPELINE.md) and [engine](../HYBRID-ENGINE.md) for current code,
source authoring and cache behavior. Future sticker creation/import is not implemented
by this migration; the generated SVG structure provides its foundation.
