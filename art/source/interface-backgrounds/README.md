# Selection Background Paintings

Two original PNGs generated with built-in image_gen for selection, splash, and editor backgrounds, with exact prompts in `prompts.json`. These are decorative interface artwork, not sticker sources; do not feed them into the region SVG conversion pipeline.

The application uses lossless WebP copies in `src/assets/backgrounds/`. CSS adds a theme-specific tint without blur, keeps the artwork behind the controls, and anchors cover images at center. The startup splash contains its artwork, branding, progress, and credit in a rounded panel against a solid theme background. The editor carries the artwork behind the page, with a slightly darker tint in the canvas letterboxing. Ribbons reveal the same continuous editor artwork without additional brightening, keeping their drop shadows. Tool groups use opaque, flat theme colors so their controls stay clear against the painting. Only the canvas letterboxing receives the darker tint; no background blur is applied. The image uses cover/envelope scaling to fill the window without stretching; excess edges crop with the window aspect ratio. The original PNGs remain unchanged for future re-encoding.

Re-encode with ImageMagick:

```sh
magick art/source/interface-backgrounds/selection-night.png -define webp:lossless=true -quality 100 src/assets/backgrounds/selection-night.webp
magick art/source/interface-backgrounds/selection-beach.png -define webp:lossless=true -quality 100 src/assets/backgrounds/selection-beach.webp
```

## Interface palette

The light theme follows the beach painting: warm paper and sand surfaces, pale neutral control wells, deep water-slate text, muted water-blue borders, and soft lagoon-blue actions. The dark theme follows the night painting: navy/slate surfaces, blue control wells, warm ivory text, and moonlight-gold actions. Opaque control wells and fine borders separate the controls from detailed artwork; preview borders also follow the active theme. Artwork remains continuous through the ribbons, with additional darkening confined to canvas letterboxing.

The home illustrations inherit the same preview-border token as saved pictures, so their outlines follow both themes consistently.
