# Cottage garden pack

The 1536 × 1024 scene is defined in `src/editor/gardenScene.ts` as an ordered collection of independently editable stickers. Repeated objects share one mask; each placed instance owns its own paint. Apples are condensed to one picker item. Old apple masks remain available for saved-document compatibility.

The supplied `source/cottage-garden-PAINT-READY.bmp` provided the sun, cloud, butterflies and apple. The built-in image_gen tool generated the completed cottage, tree without apples, bush, flower and mushroom as transparent source artwork. Originals and exact prompts are in `source/generated/` and `source/generated/prompts.json`. The blossom reuses the generated flower head. Simple rainbow, fence, path, stepping stone and grass shapes are authored SVGs.

Runtime assets: `src/assets/stickers/`. Coverage and outline masks are bit-packed 1-bit planes. They resolve to black outlines, white interiors and transparent exteriors. Transparency needs its own bit; a single black/white bit alone cannot describe all three states. Palette PNG and SVG previews use the same binary data. No intermediate gray or partial alpha values enter the artwork surfaces.

Generated high-resolution art is sized once during asset authoring to match the scene's pixel density, then thresholded. In the editor every sticker uses its authored native dimensions at 1:1; there is no placement resampling. Original BMP cutouts retain their original source resolution.

From the repository root, with Node and ImageMagick on PATH:

```sh
node scripts/extract-cottage-masks.mjs art/source/cottage-garden-PAINT-READY.bmp
node scripts/build-garden-pack.mjs
node scripts/preview-garden.mjs
```

The last command renders a visual composition preview under ignored `work/garden/`. The app loads the individual masks and editable instances. The house is one sticker with independently fillable internal regions; its roof, door and windows are not separately movable pieces.

Visual inspection covered generated source artwork, binary edge conversion and the assembled page. No app build or automated tests were run for this change.
