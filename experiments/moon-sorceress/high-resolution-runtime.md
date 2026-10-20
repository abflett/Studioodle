# High-resolution raster runtime trial

Enabled only for `fantasy-moon-sorceress` through `src/editor/stickerRasterSettings.ts`.

- Paint density multiplier: minimum 8 (12.5 samples per logical unit).
- Paint raster: 4250 x 6000 = 25,500,000 pixels; 102,000,000 bytes for Uint32 paint, plus about the same RGBA canvas backing.
- Shared region lookup: 5440 x 7680, scale 16; retained typed arrays 47,001,600 bytes.
- Combined nominal paint + canvas + lookup: 251,001,600 bytes (~239 MiB), excluding temporary buffers, browser overhead, undo history and other surfaces. Fill scratch adds roughly 127.5 MB and an image upload can add another 102 MB temporarily.
- Uniform SVG fill rendering is disabled for this asset. Both bucket and brush paint use the raster path; SVG ink and silhouette clipping remain.
- Other stickers retain their existing resolution policy.
- Saves retain paintScale=8 and validation accepts that density only for this trial asset. Fresh stickers give a clean comparison; upsampling old mixed brush paint cannot recover lost source detail.

Browser regression `npm run check:regions` exercises the real Moon SVG, checks visible ink hits at lookup scale 16, applies a bucket and a brush stroke, verifies both raster colors and saved density, and renders the result. This is a mechanics check, not a claim that visual inspection is no longer needed.

## Centerline correction

The one-analysis-pixel region overlap biased first-path lookup precedence. At the belt cross-section x=170, the minimum ink margin at four internal boundaries was only 0.0625 logical units. Setting this asset's `regionOverlapPixels` to zero moved that minimum to 0.25. Sampled exposed boundary points across the asset fell from 168 to 2; these are samples, not a guarantee of perfect coverage everywhere.

The browser check now enforces belt ink margin, paints multiple neighboring belt regions, applies a brush dab, and checks that pixels beyond the dab stay unchanged. It writes a zoomed runtime crop to `work/moon-belt-runtime.png`. The old SVG fails the margin check; the rebuilt SVG passes. High-resolution paint remains enabled to keep geometry and density trials separate.
