# Moon Sorceress: 50% threshold inspection

Open [b-index.html](b-index.html) for a visual sequence. Files are numbered in processing order. Click an image for full resolution.

Stages 1-10 capture the current pipeline; 11-13 are diagnostic views of the final SVG, not additional production steps. This stops before browser hit maps, painting, Phaser, or resizing. No alternate Potrace options or proposed fixes are included.

Reproduce from the repository root:

```sh
node scripts/build-stickers.mjs fantasy-moon-sorceress --inspect=experiments/moon-sorceress/thresholds --inspect-threshold=50 --inspect-prefix=b- --inspect-shared-source=../
```

Inspection mode writes here and in ignored work/hybrid intermediates; it does not replace production SVGs, reports, or catalogs. Settings and path counts are in [b-00-settings.json](b-00-settings.json).

1. **Original source** - [PNG](../01-original.png). Untouched source PNG.

2. **Crop** - [PNG](../02-cropped.png). Crop: 888x1254+193+0. No resizing.

3. **Grayscale** - [PNG](../03-grayscale.png). White background, alpha removed, grayscale. The production command performs stages 2 and 3 together.

4. **Blur before threshold** - [PNG](../04-blurred.png). Gaussian blur sigma 0.12 source pixels.

5. **Binary bitmap** - [PNG](b-05-threshold.png). 50% threshold. PNG is an exact view of the accompanying PBM passed to Potrace.

6. **First SVG: traced black ink** - [PNG](b-06-traced-ink.png)  |  [SVG](b-06-traced-ink.svg). 133 black-filled paths, 338 closed contours. White is transparent; no region paths yet. PNG shown on white.

7. **Render ink for region discovery** - [PNG](b-07-analysis-render.png)  |  [SVG](b-07-analysis-render.svg). 2720 x 3840; 8 samples per logical unit. Exact grayscale pixels used for discovery.

8. **Discovered white regions** - [PNG](b-08-discovered-regions.png). 212 regions, shown in diagnostic colors. Black = ink barrier; pale gray = outside. Colors are IDs, not paint.

9. **Extend ownership beneath ink** - [PNG](b-09-regions-extended-under-ink.png). Same categorical region labels after propagation into the ink, approaching its centerline. No ink overlay, so the boundaries are visible.

10. **Threshold result SVG** - [PNG](b-10-final.png)  |  [SVG](b-10-final.svg). 212 white region paths plus 133 original ink paths. Exact current builder output.

11. **Final vector backing only** - [PNG](b-11-final-backing.png)  |  [SVG](b-11-final-backing.svg). Diagnostic view: the final white region paths without ink, on a contrasting background. This is their union, not a separately generated silhouette.

12. **Final vector regions only** - [PNG](b-12-final-colored-regions.png)  |  [SVG](b-12-final-colored-regions.svg). Diagnostic view: each final SVG region gets the same ID color as stages 8 and 9. Ink hidden to expose gaps/overlaps.

13. **Final vector regions with ink** - [PNG](b-13-final-colored-regions-with-ink.png)  |  [SVG](b-13-final-colored-regions-with-ink.svg). Diagnostic view: stage 12 with the original black ink drawn on top.

The colored images show region identity only. Pale gray/white outside the backing is not a fill region. PNGs intentionally preserve their native analysis pixels; preview them at 100% when inspecting raster edges. SVGs remain scalable.
