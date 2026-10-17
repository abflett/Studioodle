# Christmas skating village

A 1920 × 960 Christmas coloring page with Santa in his sleigh, two reindeer, a snowy cabin, decorated pine trees, presents, and two children on a skating pond. Nine reusable sticker types use large white fill regions with protected black outlines. Reindeer, trees and gifts reuse the same assets; stars reuse the counting pack.

The six character/building/tree illustrations were created individually with built-in image_gen. Source images and exact prompts live under `art/source/winter/`. The pond, snowy ground and present are simple authored SVG assets. Final previews and bit-packed masks live under `src/assets/stickers/`, and the editable scene is `src/editor/winterScene.ts`.

Rebuild with Node and ImageMagick: `node scripts/build-winter-pack.mjs`.

Conversion produces binary coverage and outline planes, with no gray or partial-alpha edges. Native-size strokes target approximately 5 pixels, with natural variation. `work/winter/scene.png` provides a composed preview for visual review. Each placed sticker keeps its own editable paint.
