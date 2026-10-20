# Creating Coloring Pages From The Asset Library

Start with [CATALOG.md](CATALOG.md). For AI-assisted authoring, read [catalog/index.json](catalog/index.json), then the relevant subject guide or [scene-kits.json](scene-kits.json). Use the searchable index to choose assets before opening their full region/ink SVG geometry. The [visual browser](catalog/index.html) opens directly from disk and filters by keywords, category, scene kit and detail level.

## Choose A Coherent Collection

1. Pick a setting and a small set of focal subjects. Filter tags such as `safari`, `water`, `garden`, `space` or `celebration`; combine them with roles and detail level.
2. Inspect the SVG previews. Prefixes identify source packs, not usage restrictions: `winter-pond` has no snow in its art and is useful as a watering hole; `garden-tree` has no attached apples and works as a generic leafy tree.
3. Choose a background/ground, several subjects, then a few accents. Avoid filling every gap. Keep detailed zebra stripes, giraffe spots, leopard spots and spacecraft panels large enough to color.
4. Read each asset's `placementNotes`, dimensions, visible bounds and facing. Prefer simple scenery around detailed focal subjects. `none` facing means no directional recommendation, rather than a guaranteed side profile.

The six scene kits are suggestions, not exhaustive or mandatory combinations. The safari kit contains all 12 animals as candidates; the example page uses eight, with trees, a pond, sky and ground accents. It is a playful arrangement, not a biologically scaled wildlife diagram.

## Coordinates And Layers

- Create a typed `EditorSetup` in `src/editor/<name>Scene.ts`; use `StickerKind` for placements and `SurfaceData` for instances. See [safariScene.ts](../src/editor/safariScene.ts) for a full example.
- Source composition sizes can be convenient design units such as 1920 x 1280. `fullPageScene()` fits the whole composition onto landscape A4; use it once in the selection-screen sample list. Preserve deliberate breathing room rather than stretching the art to fill the paper.
- Set document `version: 3`, `horizonLayout: 2`, white paper/background, and a first canvas surface with `color: 0xffffff`, `paint: []`. Sticker surfaces use `color: 0x000000`, `paint: []`, unique instance IDs and real catalog kinds.
- Surfaces draw back to front. Ground/horizon goes first, then scenery and distant subjects; foreground animals and accents follow. Reusing a kind for several placements is supported.
- Sticker `x` and `y` refer to the center of its logical rectangle, not its top-left corner or feet. `scale` preserves aspect ratio; `rotation` is in degrees and `flipX`/`flipY` mirror the sticker. Keep scale positive and at most 4, and rotations within 0 to less than 360 for saved-document compatibility.
- Catalog `width` and `height` are logical units. Visible `bounds` are left/top/right/bottom within that rectangle. At zero rotation without a flip, visible left is `x + (bounds.left - floor(width / 2)) * scale`; bottom is `y + (bounds.bottom - floor(height / 2)) * scale`. Use these to align feet, shores and margins rather than assuming the full logical rectangle is opaque.
- Horizons intentionally include deep ground. For a 1920 x 1440 horizon at scale 1, a center y of 1220 puts its logical top at 500. Extend the lower ground beyond the page; do not shrink it to fit fully inside. `horizonStart` is the interactive tool's suggested top fraction, not the authored center coordinate.
- Check the local height of a curved horizon at each tree trunk and animal foot; sharing a baseline across a rolling horizon can leave objects floating. Allow intentional overlap (for example a hippo partly covering the pond edge), but keep faces and narrow legs clear. Off-page clipping should be deliberate and limited to background ground, not accidental cropped animals or trees.

## Preview And Register

1. Add the exported scene to `src/ui/SelectionScreen.tsx` and include it in the offline preview script's scene list.
2. Run `node scripts/preview-scenes.mjs safari` (replace the name with the supported scene name). This renders artwork only, independently of app builds/tests. Inspect `work/hybrid/scenes/<name>.png` for clipped outlines, dense details, odd tangencies and awkward gaps; adjust placements and render again when needed.
3. Run `node scripts/build-asset-catalog.mjs` after editing placements so each asset's `usedIn` points to current scene examples.
4. Update the corresponding kit in `art/scene-kits.json` when useful. Source descriptions, tags, titles, category, sort order and roles live in `art/stickers.json`; generated guides/index/runtime labels must not be hand-edited.

## Adding Or Changing Assets

Every manifest entry needs `title`, `category`, `sortOrder`, `description`, `tags`, `roles`, `detail`, `facing` and `placementNotes`, alongside the existing tracing/source fields. Use one of the existing nine subject categories. Roles are `background`, `subject`, `foreground`, `accent`; detail is `simple`, `moderate`, `detailed`; facing is `left`, `right`, `front`, `none`. Give names a capital initial on every word, keep IDs stable, and describe visible artwork rather than an imagined use only.

Rebuild changed artwork through `node scripts/build-stickers.mjs [asset-id]`. The pipeline refreshes the catalog afterward. For metadata-only edits run `node scripts/build-asset-catalog.mjs`, which updates the human/AI index, category guides, offline HTML browser and the small `src/assets/assetLibrary.json` projection used by the sticker picker. The metadata command validates IDs, source/preview existence, logical dimensions, roles and kit references without retracing any images.
