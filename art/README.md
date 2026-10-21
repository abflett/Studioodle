# Artwork sources

`stickers.json` is the authoring manifest for the shipped sticker library.
`scene-kits.json` groups reusable assets for composition. The bundled page layouts
live only in `src/assets/coloringBook.json`.

- `source/stickers/<pack>/`: original PNG/JPEG/BMP artwork, accepted editable SVGs,
  prompts and provenance JSON. Pack names describe origin, not picker categories.
- `source/interface/`: original beach/night paintings and their prompts.
- `REVIEW.md`: outstanding visual-review notes.

Original artwork is preserved byte-for-byte. In particular, the original Moon
Sorceress PNG remains beside its corrected SVG, the crater JPEG remains beside its
curated horizon SVG, and the original garden/safari sheets remain available for crops.
Use the manifest to find the accepted source for each runtime asset.

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
