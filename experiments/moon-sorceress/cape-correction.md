# Moon Sorceress cape correction

The curls behind the left sleeve, beside the waist, are replaced with an open cloth panel and a tapered crease. The surrounding hair, sleeve, bodice and belt retain their original geometry. Detached remnants created by removing those curls are discarded within the edited area only.

The corrected native vector source is `art/source/fantasy/moon-sorceress.svg`; the original PNG is retained as reference. The asset now uses the existing SVG authoring path, avoiding a new trace of the entire illustration. The small-region-cleaned ink from `curve-unioned-cleanup.svg` is the starting point. Production has 194 connected paint regions after rebuilding.

Reproduce the edit and rebuild only this sticker:

```sh
node experiments/moon-sorceress/correct-cape.mjs
node scripts/build-stickers.mjs fantasy-moon-sorceress
```

`correct-cape.mjs` uses authoring-only Paper.js. No runtime or other sticker changes are required.
