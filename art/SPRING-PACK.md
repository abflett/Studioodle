# Chloe's spring garden

A simpler 1920 × 960 coloring page with broad, easy-to-fill regions. New reusable stickers: bunny, butterfly, tulip, bird, watering can, sun, cloud and meadow. There are no wing spots, petal divisions, leaf veins or fine costume patterns. Small facial marks are protected black line art rather than extra fill tasks.

The five main illustrations were made individually with the built-in image_gen tool. Transparent originals and the exact generation prompts are kept under `art/source/spring/`. The sun, cloud and meadow are simple authored vector assets. Final assets are in `src/assets/stickers/`, and the editable scene is in `src/editor/springScene.ts`.

Rebuild with Node and ImageMagick:

```sh
node scripts/build-spring-pack.mjs
```

The script produces native-size binary coverage and protected-outline masks, black/white/transparent previews, and `work/spring/scene.png` for composition review. Conversion removes gray and partial-alpha pixels, and uses a small outline expansion to retain a coloring-book line weight near 5 pixels. Each scene object remains an independent sticker with its own editable paint.
