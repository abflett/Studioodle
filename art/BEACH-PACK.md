# Sunny beach day

A 1920 × 960 coloring page with a medium-simple level of detail: broad palm fronds, segmented trunk, umbrella panels and curved beach-ball panels. A towel, shells and rolling shoreline complete the scene. Sun and cloud reuse the spring pack. Every object is an independently editable sticker.

Palm, umbrella and ball were generated individually using built-in image_gen. Originals and exact prompts are saved in `art/source/beach/`. The simple shoreline, towel and shell are authored SVGs. Final native-size assets and packed binary coverage/outline masks live in `src/assets/stickers/`; scene placement lives in `src/editor/beachScene.ts`.

Rebuild with `node scripts/build-beach-pack.mjs` (Node and ImageMagick). The converter thresholds coverage and ink, preserves white fill regions, and produces `work/beach/scene.png` for visual review. No partial-alpha fringe is retained. Strokes target roughly 5 pixels at native scene size, with natural variation.

Future content can span simple through detailed pages; this pack deliberately sits between the broad spring shapes and the busier costume-number characters.
