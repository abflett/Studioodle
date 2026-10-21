# Moon Sorceress cape correction

The front shoulder strand is retained through its original curl. Only the unrelated rear curls behind the sleeve become an open cloth panel with a tapered crease. The lower sleeve and skirt borders are rebuilt along the original Bezier arcs, with overlapping ends. The native belt/skirt junction is restored after clearing the rear locks, preventing a fill leak. The old rear-lock spur and nearby stray marks are removed.

[Colored detail preview](cape-correction-preview.png): hair is yellow, the inner cape is purple, and the neighboring sleeve/skirt are gray. These remain distinct fill regions.

The corrected native vector source is `art/source/fantasy/moon-sorceress.svg`; the original PNG is retained as reference. The asset now uses the existing SVG authoring path, avoiding a new trace of the entire illustration. The small-region-cleaned ink from `curve-unioned-cleanup.svg` is the starting point. Production has 195 connected paint regions after rebuilding.

Reproduce the edit and rebuild only this sticker:

```sh
node experiments/moon-sorceress/correct-cape.mjs
node scripts/build-stickers.mjs fantasy-moon-sorceress
```

`correct-cape.mjs` uses authoring-only Paper.js. No runtime or other sticker changes are required.

The regression in `tests/ink-component-cleanup.test.mjs` samples the front strand and unrelated artwork against the unmodified reference, and verifies four separate production regions for the hair tip, inner cape, sleeve and skirt.
