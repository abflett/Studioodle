# Potrace simplification limits

Two experiments, with original artwork and current recommended `line-art.svg` preserved. No runtime changes.

## Curve optimization alone

`node scripts/trace-counting-one-stress.mjs` uses the full-resolution bitmap, alpha max 1.334 and optimization tolerances 4, 12, 40. Results: 386, 383, 383 cubic segments. Tolerances 12 and 40 produce identical SVG files (10,349 bytes). Increasing tolerance alone plateaus rather than continually simplifying this artwork.

## Three progressively lower-fidelity candidates

`node scripts/trace-counting-one-limits.mjs` reduces source sampling before thresholding/tracing. All files remain scalable vector artwork with 1024 × 1536 display dimensions; their viewBoxes reflect the tracing resolution. Alpha max is 1.334, speckle suppression 8 tracing pixels. Because that cutoff is fixed in tracing pixels, it removes proportionally larger details at lower resolution. These profiles deliberately combine stronger tracing tolerance and reduced source detail to explore failure, not isolate one parameter scientifically.

| Candidate | Source sampling | Tolerance | Curves | Contours | Raw bytes | Brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Existing minimal reference | 100% | 2 | 392 | 46 | 10561 | 4101 |
| limit-high | 50% | 4 | 329 | 46 | 8681 | 3339 |
| limit-medium | 25% | 12 | 290 | 44 | 7330 | 2825 |
| limit-low | 12.5% | 40 | 262 | 43 | 6377 | 2437 |

Visual review: high retains facial highlights but rounds the buckle and other corners; medium loses eye highlights and changes line weight and small shapes; low visibly distorts helmet, body and boots with pinched/broken-looking contours. It is unsuitable for clean coloring regions. Contour counts are geometry statistics, not proof of valid coloring topology. No region extraction or app tests were performed.

These show diminishing returns: roughly 18%, 31%, 41% compressed savings relative to the existing reference, at increasing visual cost. The existing line-art.svg remains the recommended baseline pending user comparison.
