# Selection Background Paintings

Two original PNGs generated with built-in image_gen for the selection screen, with exact prompts in `prompts.json`. These are decorative interface artwork, not sticker sources; do not feed them into the region SVG conversion pipeline.

The application uses quality-82 WebP copies in `src/assets/backgrounds/`. CSS adds a slight blur and a theme-specific tint, keeps the artwork behind the controls, and anchors the left-side glow so it remains visible in portrait crops. The original PNGs remain unchanged for future re-encoding.

Re-encode with ImageMagick:

```sh
magick art/source/interface-backgrounds/selection-night.png -quality 82 src/assets/backgrounds/selection-night.webp
magick art/source/interface-backgrounds/selection-beach.png -quality 82 src/assets/backgrounds/selection-beach.webp
```
