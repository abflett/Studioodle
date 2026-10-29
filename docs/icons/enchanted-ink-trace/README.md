# Enchanted Ink / actual book trace

[Compare the original PNG and traced SVG](index.html), or open the
[vector file](book-traced.svg) directly.

The previous app icons were hand interpretations and lost the reference's tapered
strokes and organic geometry. This proof uses **the actual PNG shapes** rather
than redrawing a similar book. It is not installed in the app yet.

Source: [01-enchanted-ink.png](../directions/01-enchanted-ink.png), rectangle
`(288, 352, 424, 480)` in source pixels. `book-reference.png` is the unchanged crop
of its small dark-theme book example, including the original button tile. The SVG
contains the symbol only; its comparison tile is CSS and is not traced artwork.

Conversion:

1. Resample the source's existing antialiased boundary at 4x before masking.
2. Extract the light symbol from the dark background, then separate the gold.
3. Trace each mask with Potrace 1.16 (`alphamax=1`, `opttolerance=.35`, `turdsize=2`).
4. Layer gold over the complete ink silhouette, preserving variable widths and
   the actual asymmetric pages. No uniform SVG stroke reconstruction is used.

The result is approximately **5.7 KB**, with two filled path layers and no embedded
bitmap, raster texture or image filter. Color flattening deliberately removes the
PNG's small tonal variations; its background, antialiasing and soft glow are not
part of the symbol. The limited-resolution source still constrains exactness,
especially when enlarged. This is a conversion proof to review before any rollout.

Reproduce from the repository root with Pillow and Potrace installed:

```
python docs/icons/enchanted-ink-trace/trace.py
```

The script uses `POTRACE_PATH` when provided, otherwise the ignored
`tools/bin/potrace/potrace-1.16.win64/potrace.exe`. PBM masks and intermediate SVGs
go under ignored `work/enchanted-ink-trace/`. No ImageGen call is used for this
conversion; the original concept board remains untouched.
