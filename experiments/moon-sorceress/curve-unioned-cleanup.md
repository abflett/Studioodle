# Curve-unioned small-region cleanup

Historical cleanup result: [SVG](curve-unioned-cleanup.svg). The production source has since received a localized [cape correction](cape-correction.md); this reference remains unchanged. Production is updated only for Moon Sorceress; no bulk library rebuild.

The previous pixel patch left a visible white rim around the small teardrop near logical (172, 197). The replacement removes that exact hole contour from the ink. It does not insert a stair-stepped bitmap shape into the hole. The updated source is one compound ink path with original Bezier curves.

The A4-normalized cutoff remains 10.2 square pixels. Initial analysis finds 212 components and 13 below-cutoff candidates. Six are exact small holes. Seven others need local curve intersections/unions because the analysis grid split a thin opening differently from the continuous SVG geometry. One of these is exterior-connected and uses a curved local union. Two microscopic slivers introduced by unions are removed directly afterward.

The final SVG has 199 paint regions and no below-cutoff analysis components. Its ink has 133 positive components, matching the original, so no detached black patches were added. The small round eye sparkle remains white. Ink is rendered again before final region discovery; labels are not merely edited to pretend the patch succeeded.

`tests/ink-component-cleanup.test.mjs` checks the exact teardrop location, sparkle retention, one outer contour per region, absence of tiny holes, and that closing a synthetic curved hole leaves its original outer curve unchanged. `browser-analysis.js` is a diagnostic comparing original ink discovery with the browser renderer; it is not part of the application.

Reproduce the final experimental SVG:

```sh
node scripts/build-stickers.mjs fantasy-moon-sorceress --experiment-output=experiments/moon-sorceress/curve-unioned-cleanup.svg
```

Paper.js is an authoring-only development dependency. It is not included in the application paint engine.
