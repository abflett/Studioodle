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
