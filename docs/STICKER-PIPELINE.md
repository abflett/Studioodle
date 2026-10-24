# Sticker pipeline

Use the [artwork review inspector](ARTWORK-REVIEW.md) to browse shipped assets,
mark missing or unwanted regions, and export repair notes with SVG coordinates.

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

Cleanup defaults to **10.2 square pixels**, measured at the largest proportional A4
fit at 150 DPI (either orientation), matching the accepted Moon Sorceress settings.
`minimumRegionAreaPixels` can override that default per source. Connected components
are classified separately before filtering; disconnected specks cannot hide inside
a larger region. Authoring-only Paper.js removes true tiny hole contours and unions
curved local caps for raster-split pockets. Explicit negative-space cutouts are
preserved. The ink is rendered again and regions rediscovered, with up to four
passes to close newly exposed tiny pockets. Remaining small regions are reported.

Authored SVG strokes remain intact: when cleanup is necessary, only the additional
pocket-closing curves are appended to the original geometry. The runtime SVG still
contains only vector ink and region paths.

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
Original SVG curves clip rendering. Source text is cached while the editor is open; decoded
interaction definitions are released when leaving the editor.

[Vector painting](VECTOR-PAINT.md) explains brush geometry, worker merging,
connected-component fills, seam rendering and output. Documents store only vector
paint, transforms and asset IDs; they never store lookup arrays or color rasters.

## Batch regeneration

```sh
npm run assets:rebuild
npm run assets:rebuild -- --resume
npm run assets:audit
# After reviewing the staged before/after comparison:
npm run assets:promote
```

The rebuild runner processes the complete manifest in isolated Node processes (two
at a time by default), limits ImageMagick threading, and stages all results under
`work/sticker-upgrade/`. It does not overwrite production SVGs or source artwork.
`--jobs=1` reduces load; `--timeout=180000` controls each asset's deadline.
`--out=work/another-review` selects a different staging directory. Resume validates
both input and converter hashes; changed sources or algorithms are rebuilt.
For a targeted pass, `--ids-file=work/targets.json` reads a JSON array of asset IDs.
The summary records that exact target set, and audit/promotion validate only that
set. Unknown or duplicate IDs are rejected. Promotion also validates manifest
metadata, including cutout seeds, against the conversion report.

The staging directory contains untouched `before/` copies, rebuilt `vector/` files,
per-asset `reports/`, failure logs, `summary.json`, and the audit's `review.html` and
`audit.json`. The audit verifies checksums, original-source preservation, dimensions,
contiguous region IDs, no raster payloads, no unresolved tiny regions, and exactly
one connected outer contour per paint region. Promotion rechecks input/output checksums and the converter revision before replacing runtime SVGs; it refreshes the catalog afterward. Review before promoting results.

For one staged asset, use:

```sh
node scripts/build-stickers.mjs fantasy-moon-sorceress --out=work/sticker-upgrade/vector --report=work/sticker-upgrade/reports/moon.json --no-catalog
```

Regenerated region IDs are a development breaking change. Use a fresh drawing-library
namespace when promoting an incompatible library, rather than interpreting old paint
against different region IDs. Original art and saved page layouts are preserved.

## Repairs from an artwork review

`node scripts/plan-artwork-repairs.mjs docs/review.json` checks review checksums and
writes a conservative plan plus target IDs under `work/artwork-repair-pass/`.
Use `--out=work/another-repair-pass` for a later pass; a promoted stage cannot be
replanned in place, preserving its before snapshots and audit trail.
`--apply` appends safe negative-space seeds to `art/stickers.json`; the original
review and source art remain unchanged. It does not draw inferred closures.
Conflicting add/remove requests and regions exceeding 35% of paintable area are
left for visual review. Duplicate markers on one region produce one seed.
Review exports can also contain explicit `closures` with endpoint/curve geometry,
width and a fill seed. The planner retains them as `proposedLines`, including
assets whose only annotation is a line. Cutout `--apply` does not apply these
curves; verify and apply them in a separate line-repair pass before rediscovering
regions and checking the supplied fill seeds.

Rebuild that target set into the same staging directory, audit it, then run
`node scripts/validate-artwork-repairs.mjs work/artwork-repair-pass`. The additional
validator requires unchanged ink, the exact expected reduction in region count,
transparent seed points, preserved interiors of unmarked regions, and unchanged
source/review checksums. Review the before/after gallery before promoting.

A marker can sit on ink covering its region path. Such a seed fails discovery;
choose a verified white interior point of the same reviewed region and record
the adjustment separately from the original marker coordinates. Resume rebuilds
only changed inputs. Do not rerun the original planning command after promotion:
the review checksums intentionally stop matching modified assets.

## Explicit line-repair pass

For exported A/B or curved closure geometry, run:

```sh
node scripts/prepare-line-repairs.mjs docs/line-review.json --out=work/line-pass --apply
node scripts/rebuild-stickers.mjs --ids-file=work/line-pass/targets.json --out=work/line-pass
node scripts/audit-stickers.mjs work/line-pass
# Inspect work/line-pass/review.html before promoting.
node scripts/promote-stickers.mjs work/line-pass
```

Preparation verifies every reviewed SVG checksum before writing anything. It starts
from the current shipped filled ink, outlines only the proposed strokes with round
ends/joins (0.002 logical-unit flattening tolerance, five-decimal offset precision),
and unions them with the original Beziers. It checks that original black area was
not lost. Markers and fill seeds never drive this pass. Existing accepted manifest
cutouts remain in force during region discovery.

The accepted editable compound-ink SVGs live in `art/source/stickers/line-repairs/`.
Manifest `inkSource` selects these on subsequent rebuilds; `source` and the original
art stay unchanged. Staging, resume, audit and promotion hash both source inputs,
so the edits cannot be silently lost or reused after an ink source changes.
Normal small-region cleanup still runs after region rediscovery.

Record the promoted before/after hashes and applied closure IDs in a repair ledger
like `studioodle-line-repairs-2026-10-24.progress.json`. The inspector uses that ledger
to select the exact rebuilt assets, retire applied proposals, refresh region IDs,
and reopen those assets for inspection without replaying lines or deleting notes.
The original exported JSON stays untouched. Regenerated IDs use a fresh development
drawing namespace; no old-save compatibility is added.

### Markers after an explicit line pass

Do not use exported region IDs after line regeneration. After auditing and promoting
that line stage, derive a working review with the same point coordinates and refreshed
region IDs:

```sh
node scripts/prepare-marker-repairs.mjs docs/review.json --line-stage=work/line-pass --out=work/marker-pass
node scripts/plan-artwork-repairs.mjs work/marker-pass/review.json --out=work/marker-pass --apply
node scripts/rebuild-stickers.mjs --ids-file=work/marker-pass/targets.json --out=work/marker-pass
node scripts/audit-stickers.mjs work/marker-pass
node scripts/validate-artwork-repairs.mjs work/marker-pass
node scripts/promote-stickers.mjs work/marker-pass
```

The remapper requires the same review checksum and a recorded promoted line stage;
other artwork revision changes are rejected. The original export is never rewritten.
Check add/fill points against the rebuilt SVG: closures may already satisfy them,
while genuinely missing regions need a further authored fix. Record satisfied fill
IDs along with completed cutout IDs, so the inspector retires exactly the instructions
that were applied. A satisfied fill can share the line-stage checksum without requiring
an artificial artwork change. The v3 marker ledger demonstrates this case for Forest Elf.

### Explicit fill requests that reverse cutouts

If an add/fill point remains transparent after the line pass, it may match a previously
accepted cutout rather than an open gap. `restore-reviewed-cutouts.mjs` renders the
current ink and discovers its white components with cutout seeds temporarily disabled.
It removes only seeds in the same enclosed component as an explicit add marker and
rejects requests that match no such component. The original marker positions stay intact.

```sh
node scripts/restore-reviewed-cutouts.mjs work/marker-pass/review.json --out=work/marker-pass --apply
# Add restoration asset IDs to the targeted rebuild, then audit and validate:
node scripts/validate-restored-cutouts.mjs work/marker-pass
```

Restoration validation requires byte-identical ink, newly paintable requested points,
and retained interiors for every existing region. Keep the restoration report with the
stage and promote only after both the cutout and restoration validations pass. Record
restored seeds in the marker ledger. Do not remove unrelated cutouts or add speculative
closures to satisfy the request.

Authored SVG rounded rectangles use exact elliptical arc commands via
`svg-rect-path.mjs`; quadratic corner approximations caused region/outline mismatch.
The helper is part of the build/resume/promotion fingerprint so changing it invalidates
cached conversions. Only explicitly selected assets are rebuilt after a converter fix.
