> Historical snapshot. The raster paint engine and its executable benchmarks have been retired; current runtime behavior is documented in `docs/VECTOR-PAINT.md`.

# Moon Sorceress raster resolution trials

## Current: 150 DPI in page space

The Moon Sorceress now sets its local paint density multiplier to its placed sticker scale, including fractional scales. After the sticker transform this is one paint pixel per page pixel at 150 DPI. Zoom does not change paint density. Resizing rebuilds the raster and its per-surface hit/region lookup at the same density; uniform fills are reconstructed and mixed brush paint is resampled. The raster dimensions are rounded up, but drawing uses the exact density so the rounding does not stretch the image. Sampled region queries use pixel centers.

At sticker scale 1 the grid is 532 x 750 (399,000 pixels). Paint array and canvas backing are about 1.6 MB each, plus approximately 0.45 MB for this surface lookup. Larger placements scale with their actual page footprint. The original decoded lookup is still shared and bounded at scale 4. Existing 8x-trial saves remain readable and are resampled when rendered/edited. Other stickers retain their existing resolution policy.

The SVG solid-fill shortcut remains disabled for the sorceress. The centerline correction and tiny-component cleanup remain enabled. Test with a newly placed sticker for a comparison free of old mixed-raster artifacts.

## Centerline correction

The one-analysis-pixel region overlap biased first-path lookup precedence. At the belt cross-section x=170, the minimum ink margin at four internal boundaries was only 0.0625 logical units. Setting this asset's `regionOverlapPixels` to zero moved that minimum to 0.25. Sampled exposed boundary points across the asset fell from 168 to 2; these are samples, not a guarantee of perfect coverage everywhere.

The browser check now enforces belt ink margin, paints multiple neighboring belt regions, applies a brush dab, and checks that pixels beyond the dab stay unchanged. It writes a zoomed runtime crop to `work/moon-belt-runtime.png`. The old SVG fails the margin check; the rebuilt SVG passes. High-resolution paint remains enabled to keep geometry and density trials separate.
