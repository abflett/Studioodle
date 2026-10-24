# Artwork sources

`stickers.json` is the authoring manifest for the shipped sticker library.
`scene-kits.json` groups reusable assets for composition. The bundled page layouts
live only in `src/assets/coloringBook.json`.

- `source/stickers/<pack>/`: original PNG/JPEG/BMP artwork, accepted editable SVGs,
  prompts and provenance JSON. Pack names describe origin, not picker categories.
- `source/interface/`: original beach/night paintings and their prompts.
- `reviews/`: active exported annotations awaiting a repair pass (completed exports live in Git history).

Original artwork is preserved byte-for-byte. In particular, the original Moon
Sorceress PNG remains beside its corrected SVG, the crater JPEG remains beside its
curated horizon SVG, and the original garden/safari sheets remain available for crops.
Use the manifest to find the accepted source for each runtime asset.

| Purpose | Location |
| --- | --- |
| Untouched originals and provenance | `source/stickers/<pack>/`, `source/interface/` |
| Accepted merged repair ink | `source/stickers/line-repairs/` (`inkSource` in the manifest) |
| Current asset metadata/settings | `stickers.json` |
| Reusable composition groups | `scene-kits.json` |
| New review inputs awaiting work | `reviews/` |
| Shipped assets and page layouts | `../src/assets/vector/`, `../src/assets/coloringBook.json` |

Prefer `inkSource` when present for subsequent conversion; do not revert it to the
untouched original and lose accepted repairs. Original source packs are the backup,
not another pending workload. Generated trials/catalogs belong in `../work/`.

## Browse and convert

```sh
npm run assets:catalog
# Open work/catalog/index.html (offline visual browser)
# work/catalog/index.json is the full machine-readable authoring index.
node scripts/build-stickers.mjs <asset-id>
npm run assets:preview -- <page-id>
```

Catalog generation refreshes the small runtime catalogs and sticker type, but never
retraces artwork. Conversion writes SVGs to `src/assets/vector/`; intermediate
files stay in `work/assets/`. Prefer targeted rebuilds while inspecting artwork.
Do not edit generated runtime SVGs directly; edit their accepted sources.

See [the conversion pipeline](../docs/STICKER-PIPELINE.md) and
[scene authoring](../docs/SCENE-AUTHORING.md).

## Interface paintings

The app uses lossless WebP copies. To re-encode the retained originals:

```sh
magick art/source/interface/selection-night.png -define webp:lossless=true -quality 100 src/assets/backgrounds/selection-night.webp
magick art/source/interface/selection-beach.png -define webp:lossless=true -quality 100 src/assets/backgrounds/selection-beach.webp
```

## Visual review candidates

These are general inspection prompts, not unapplied repair instructions. The submitted
v5 line/marker pass is complete; inspect the current art before deciding on more edits.

- Alphabet A astronaut and V viking: check letter recognition and silhouette.
- Alphabet unicorn: inspect the arm/hair intersection for a missing closure.
- Sandwich and toy blocks: fine texture can create excessive small regions.
- Fire engine: decide whether to retain the friendly windshield face.
- Windmill: check open spaces in the sail lattice.
- Stegosaurus: review tail-spike anatomy.
- Child using a wheelchair: review spokes and limb/chair separation.
- Seabed horizon: consider simplifying dense rocks and contours.
- Birch woodland: inspect dense canopy/trunk detail. Explicit authored closures now replace the old analysis gap-closure setting.
- Interiors and fantasy costumes: review handle openings, negative spaces, tiny
  decorative regions and fine wood/masonry detail.
