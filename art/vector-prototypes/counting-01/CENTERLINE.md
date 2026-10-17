# Centerline comparison

Conversion experiment only; no app assets or runtime code changed.

AutoTrace centerline mode run against the same full-resolution binary ink input as Potrace. Both profiles use white as the ignored background. Output is normalized to an SVG namespace/viewBox, one decimal place and a 12-source-pixel black stroke with round joins/caps. No hand corrections were made, so the limitations of automatic tracing remain visible.

| Version | Curves | Lines | Raw bytes | Gzip | Brotli |
| --- | ---: | ---: | ---: | ---: | ---: |
| Potrace minimal | 392 | 0 | 10561 | 4919 | 4101 |
| Centerline, error 2 / filter 4 | 268 | 10 | 9566 | 4364 | 3767 |
| Centerline smooth, error 4 / filter 8 | 189 | 8 | 6968 | 3248 | 2799 |

The stroke-only versions lose filled-eye appearance, shift some helmet/cuff joins and alter outline weight. The smoother version also introduces waviness in formerly straight parts of the numeral. These are comparison candidates, not production replacements or validated region boundaries. Some solid details should remain filled shapes if we adopt centerlines.

Reproduce: `node scripts/trace-counting-one-centerline.mjs`. Requires ImageMagick and AutoTrace; set `AUTOTRACE_PATH`, or use `work/tools/autotrace-static.exe`. Run the prior Potrace script to rebuild the comparison baseline.

The official Windows 0.31.10 release was downloaded/extracted locally but failed to start. This experiment uses the older static Windows build from https://github.com/scottvr/autotrace-win64-binaries (binary at `bin/autotrace.exe`). All tooling remains in ignored `work/tools`; nothing was installed globally or added to application dependencies.

Raw AutoTrace outputs are retained alongside normalized SVGs. Preview images are rendered with antialiasing and a white background; the SVGs themselves have no base fill. Region extraction and engine migration remain deferred.
