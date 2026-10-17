# Shared raster-to-vector pipeline

Authoring-only comparison for the beach ball, original cottage-garden house (not the winter cabin), and number 1 astronaut. Original sources and runtime masks are unchanged.

## Recommended default: light

1. Use the full-resolution source, preserving its dimensions and registration. No downsampling.
2. Composite transparency onto white, then convert to grayscale.
3. Estimate typical stroke width from the most frequent short black run across horizontal and vertical scans (threshold 128, runs 3 through 4% of the smaller image dimension). This is a heuristic and should be visually reviewed on new art styles.
4. Apply Gaussian smoothing with sigma = 0.04 × estimated stroke width.
5. Threshold at 50%.
6. Potrace 1.16: alphamax 1.2; optimization tolerance = 0.5 × stroke width / 12; speckle area = max(2, round(8 × (stroke width / 12)^2)).
7. Preserve the original SVG viewBox. Output only black vector ink with transparent spaces; no base fill, silhouette or region IDs yet.
8. Visually inspect thin joins, corners, small enclosed details and the full silhouette before accepting an asset.

No gap closing, dilation, erosion or manual drawing changes are applied. Avoid automatic gap closing until we explicitly address region topology. Antialiasing is used for presentation previews only.

## Comparison presets

| Preset | Sigma / stroke | Alpha max | Tolerance at 12 px stroke |
| --- | ---: | ---: | ---: |
| light (default) | 0.04 | 1.2 | 0.5 |
| balanced | 0.08 | 1.3 | 1 |
| strong | 0.18 | 1.334 | 2 |

All use identical threshold/speckle rules. Source stroke estimates: ball 18 px, cottage 7 px, astronaut 11 px. The profile differences intentionally vary preprocessing and tracing together; this is a production-preset comparison, not a controlled measurement of blur alone.

## Observations

The ball tolerates all presets. Cottage details reveal the tradeoff: balanced/strong round window corners and change narrow door-plank joins. Light is the conservative shared default; balanced can be used for organic assets after review. Strong saves relatively little and is not recommended as the library default. None guarantees perfect joins, and region topology has not been verified.

Light output sizes: ball 2,552 bytes / 1,135 Brotli; cottage 23,383 / 8,810; astronaut 12,727 / 4,879. Full geometry counts and settings are in `report.json`. Compression measurements concern vector ink only, not future paint/masks.

Reproduce: `node scripts/compare-vector-pipeline.mjs` from the repository root. Requires ImageMagick and Potrace; `POTRACE_PATH` may override the default ignored portable tool path. Comparison sheets are written to `work/vector-pipeline/` and candidate SVGs here. No app tests or builds are run.
