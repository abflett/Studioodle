# Selection Background Paintings

Two original PNGs generated with built-in image_gen for the selection screen, with exact prompts in `prompts.json`. These are decorative interface artwork, not sticker sources; do not feed them into the region SVG conversion pipeline.

The application uses lossless WebP copies in `src/assets/backgrounds/`. CSS adds a theme-specific tint without blur, keeps the artwork behind the controls, and anchors the left-side glow so it remains visible in portrait crops. The image uses cover/envelope scaling to fill the window without stretching; excess edges crop with the window aspect ratio. The original PNGs remain unchanged for future re-encoding.

Re-encode with ImageMagick:

```sh
magick art/source/interface-backgrounds/selection-night.png -define webp:lossless=true -quality 100 src/assets/backgrounds/selection-night.webp
magick art/source/interface-backgrounds/selection-beach.png -define webp:lossless=true -quality 100 src/assets/backgrounds/selection-beach.webp
```
