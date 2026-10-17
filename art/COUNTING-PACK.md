# Counting costume parade

An original numeral-character coloring page: 1–10 each have a different costume, with the numeral itself as the body. These are not stacked-block characters. Costumes are astronaut, pirate, chef, gardener, knight, wizard, explorer, ballet dancer, firefighter and musician.

The scene is 1920 × 960 pixels, reserving about 120 pixels from a 1080p screen for the editor ribbon. Actual available space depends on browser chrome and responsive ribbon wrapping. The canvas keeps its native dimensions; zoom and pan handle other window sizes.

Sources were generated individually with the built-in image_gen tool. Transparent originals and exact prompts are saved in `art/source/counting/`. The intended line weight is roughly 5 pixels at final sticker size, with natural variation. Bunting and a star are simple authored vector decorations.

Runtime masks and previews are in `src/assets/stickers/`. Every character is a separate native-size sticker, including the paired digits of 10 as one character. Scene instances are defined in `src/editor/countingScene.ts` and can be moved, colored, resized, rotated and reordered independently. The picker offers the same artwork under Costume numbers, with six choices per page and no scrolling.

Regenerate the pack and visual preview from the repository root, with Node and ImageMagick installed:

```sh
node scripts/build-counting-pack.mjs
```

ImageMagick resizes source artwork once during authoring. The script thresholds it into two 1-bit planes for coverage and protected outlines, then creates matching black/white/transparent SVG and PNG previews. Runtime placement does not resample the asset. Source files are retained so conversion can be adjusted later without another image generation.

The script writes `work/counting/scene.png` for visual review. This preview is a flattened rendering only; the app scene remains composed of individual stickers.
