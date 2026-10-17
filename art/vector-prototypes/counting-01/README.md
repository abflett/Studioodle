# Number 1: vector line-art prototype

Conversion only: the running app still uses the existing sticker and masks.

`line-art.svg` is the recommended low-point trace, identical to `minimal.svg`. Black ink is represented by filled cubic Bezier contours, with transparent interiors and background. There is no embedded bitmap, white base, silhouette mask or region map yet. Original 1024 × 1536 registration is preserved.

Source: `art/source/counting/01.png`, full-resolution generated original.

Pipeline: composite alpha onto white, grayscale, Gaussian blur sigma 0.6 source pixels, threshold 50%, Potrace 1.16 with speckle suppression 8. These preprocessing choices suppress the source halo and microscopic irregularities without tracing the small pixelated runtime sticker.

| Profile | Alpha max | Optimization tolerance | Cubic segments | Straight segments | SVG bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Faithful | 1.0 | 0.2 | 592 | 94 | 15578 |
| Smooth | 1.2 | 1.0 | 406 | 20 | 11033 |
| Minimal (recommended) | 1.3 | 2.0 | 392 | 0 | 10561 |

All three have 8 path elements and 46 contours. Segment counts include implicit SVG command repetitions. The minimal profile reduces total segments by about 43% relative to the faithful profile. Visual comparison retained the face, star, helmet and clothing boundaries; region topology has not yet been validated.

Reproduce from repository root with `node scripts/trace-counting-one.mjs`. Requires ImageMagick and Potrace. Set `POTRACE_PATH` to the executable, or use the default portable installation at `work/tools/potrace/potrace-1.16.win64/potrace.exe`. Tool binaries are ignored and are not application dependencies.

Official binary: https://potrace.sourceforge.net/download/1.16/potrace-1.16.win64.zip
Parameter documentation: https://potrace.sourceforge.net/index.html

The next region experiment should derive enclosed spaces from vector ink geometry. These are filled ink shapes, not centerline strokes, so changing stroke-width will not thin them. Antialiasing belongs in presentation; categorical region IDs must not be blended when rasterized or resized. No engine, magnifier or region-generation work is included here.
