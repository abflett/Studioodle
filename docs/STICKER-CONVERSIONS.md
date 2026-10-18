# Sticker conversion checklist

All **71 / 71** source stickers have been converted and integrated into the hybrid engine.
The binary renderer, legacy saves/imports, old masks and conversion experiments are removed.
Version-3 pictures use the new definitions. See [engine notes](HYBRID-ENGINE.md).

## Resume / review

- Current conversion: **none - complete**.
- Generated assets: `src/assets/vector/`; source inventory: `art/stickers.json`.
- Rebuild: `node scripts/build-stickers.mjs` (or one asset ID).
- Region counts and tiny-region flags: `art/conversion-report.json`.
- All five generated contact sheets visually reviewed; no app tests or builds run.
- User interaction review remains open below. A checked asset means conversion/runtime wiring complete, not that every interaction has been play-tested.

## Inventory

### Shapes and simple stickers

- [x] `circle` - authored vector; 1 regions; source `art/source/shapes/circle.svg`.
- [x] `square` - authored vector; 1 regions; source `art/source/shapes/square.svg`.
- [x] `triangle` - authored vector; 1 regions; source `art/source/shapes/triangle.svg`.
- [x] `tree` - authored vector; 2 regions; source `art/source/shapes/tree.svg`.
- [x] `flower` - authored vector; 7 regions; source `art/source/shapes/flower.svg`.

### Cottage garden

- [x] `garden-house` - Light Potrace; 90 regions; source `art/source/generated/house.png`.
- [x] `garden-tree` - Light Potrace; 6 regions; source `art/source/generated/tree.png`.
- [x] `garden-bush` - Light Potrace; 1 regions; source `art/source/generated/bush.png`.
- [x] `garden-flower` - Light Potrace; 9 regions; source `art/source/generated/flower.png`.
- [x] `garden-mushroom` - Light Potrace; 6 regions; source `art/source/generated/mushroom.png`.
- [x] `garden-blossom` - authored vector; 7 regions; source `art/source/generated/blossom.svg` (crop 1024x925+0+0).
- [x] `garden-rainbow` - authored vector; 3 regions; source `art/source/generated/rainbow.svg`.
- [x] `garden-fence` - authored vector; 20 regions; source `art/source/generated/fence.svg`.
- [x] `garden-path` - authored vector; 1 regions; source `art/source/generated/path.svg`.
- [x] `garden-stone` - authored vector; 1 regions; source `art/source/generated/stone.svg`.
- [x] `garden-grass` - authored vector; 1 regions; source `art/source/generated/grass.svg`.
- [x] `garden-sun` - Light Potrace; 12 regions; source `art/source/cottage-garden-PAINT-READY.bmp` (crop 353x313+30+18).
- [x] `garden-cloud` - Light Potrace; 1 regions; source `art/source/cottage-garden-PAINT-READY.bmp` (crop 306x169+1205+32).
- [x] `garden-butterfly` - Light Potrace; 12 regions; source `art/source/cottage-garden-PAINT-READY.bmp` (crop 215x193+1308+232).
- [x] `garden-apple` - authored vector; 3 regions; source `art/source/generated/apple.svg` (crop 77x92+463+260).
- [x] `garden-window` - Light Potrace; 6 regions; source `art/source/cottage-garden-PAINT-READY.bmp` (crop 106x113+890+357).

### Costume numbers

- [x] `counting-01` - Light Potrace; 38 regions; source `art/source/counting/01.png`.
- [x] `counting-02` - Light Potrace; 37 regions; source `art/source/counting/02.png`.
- [x] `counting-03` - Light Potrace; 27 regions; source `art/source/counting/03.png`.
- [x] `counting-04` - Light Potrace; 44 regions; source `art/source/counting/04.png`.
- [x] `counting-05` - Light Potrace; 68 regions; source `art/source/counting/05.png`.
- [x] `counting-06` - Light Potrace; 41 regions; source `art/source/counting/06.png`.
- [x] `counting-07` - Light Potrace; 59 regions; source `art/source/counting/07.png`.
- [x] `counting-08` - Light Potrace; 55 regions; source `art/source/counting/08.png`.
- [x] `counting-09` - Light Potrace; 40 regions; source `art/source/counting/09.png`.
- [x] `counting-10` - Light Potrace; 63 regions; source `art/source/counting/10.png`.
- [x] `counting-bunting` - authored vector; 18 regions; source `art/source/counting/bunting.svg`.
- [x] `counting-star` - authored vector; 1 regions; source `art/source/counting/star.svg`.

### Spring garden

- [x] `spring-bunny` - Light Potrace; 7 regions; source `art/source/spring/bunny.png`.
- [x] `spring-butterfly` - Light Potrace; 10 regions; source `art/source/spring/butterfly.png`.
- [x] `spring-tulip` - Light Potrace; 4 regions; source `art/source/spring/tulip.png`.
- [x] `spring-bird` - Light Potrace; 5 regions; source `art/source/spring/bird.png`.
- [x] `spring-watering-can` - Light Potrace; 6 regions; source `art/source/spring/watering-can.png`.
- [x] `spring-sun` - authored vector; 1 regions; source `art/source/spring/sun.svg`.
- [x] `spring-cloud` - authored vector; 1 regions; source `art/source/spring/cloud.svg`.
- [x] `spring-meadow` - authored vector; 1 regions; source `art/source/spring/meadow.svg`.

### Beach day

- [x] `beach-palm` - Light Potrace; 13 regions; source `art/source/beach/palm.png`.
- [x] `beach-umbrella` - Light Potrace; 5 regions; source `art/source/beach/umbrella.png`.
- [x] `beach-ball` - Light Potrace; 8 regions; source `art/source/beach/ball.png`.
- [x] `beach-shore` - authored vector; 2 regions; source `art/source/beach/shore.svg`.
- [x] `beach-towel` - authored vector; 3 regions; source `art/source/beach/towel.svg`.
- [x] `beach-shell` - authored vector; 1 regions; source `art/source/beach/shell.svg`.

### Christmas winter

- [x] `winter-santa-sleigh` - Light Potrace; 30 regions; source `art/source/winter/santa-sleigh.png`.
- [x] `winter-reindeer` - Light Potrace; 20 regions; source `art/source/winter/reindeer.png`.
- [x] `winter-cabin` - Light Potrace; 66 regions; source `art/source/winter/cabin.png`.
- [x] `winter-pine` - Light Potrace; 16 regions; source `art/source/winter/pine.png`.
- [x] `winter-skater` - Light Potrace; 68 regions; source `art/source/winter/skater.png`.
- [x] `winter-skater-friend` - Light Potrace; 51 regions; source `art/source/winter/skater-friend.png`.
- [x] `winter-snow` - authored vector; 1 regions; source `art/source/winter/snow.svg`.
- [x] `winter-pond` - authored vector; 1 regions; source `art/source/winter/pond.svg`.
- [x] `winter-present` - authored vector; 7 regions; source `art/source/winter/present.svg`.

## Integration

- [x] One definition registry and one offline builder.
- [x] All picker items and five starter scenes use hybrid assets.
- [x] Circle/square/triangle are real vector shapes.
- [x] Simple tree/flower and both apple variants are available in the picker.
- [x] Regions and packed high-resolution hit masks generated offline.
- [x] Definitions load on demand; instance paint stays separate.
- [x] Raster-only rendering, old save readers and mark imports removed.
- [x] Old binary assets, pilot definitions and experiment scripts removed.

## User review / future work

- [ ] Play-test each scene: fills, brush/erase, outlines at zoom, overlaps and order.
- [ ] Review move, size, rotation, duplicate and undo across mixed assets.
- [ ] Review save/reopen, delete/restore, PNG export and print.
- [ ] Review tiny regions listed in the report; retain fidelity unless a specific fix is requested.
- [ ] Profile phone startup, repeated fills and large scenes if a delay is reported.

## Notes

Repeated scene placements share definitions. Original PNG/BMP/SVG sources and prompts are retained for rebuilding; no compatibility copies are kept in the runtime. Garden BMP crops isolate the main outline and enclosed ink to avoid neighboring marks. Authored vector strokes preserve white-shape occlusion via inverse clipping. Region IDs are categorical and never blended. The corrected four-legged reindeer is the accepted source.

### Safari animals

- [x] `animal-giraffe` - Light Potrace; 47 regions; source `art/source/animals/safari-sheet.jpg` (crop 170x270+95+15).
- [x] `animal-elephant` - Light Potrace; 19 regions; source `art/source/animals/safari-sheet.jpg` (crop 310x227+376+40).
- [x] `animal-lion` - Light Potrace; 13 regions; source `art/source/animals/safari-sheet.jpg` (crop 199x234+790+32). Authored transparent leg gaps.
- [x] `animal-hippo` - Light Potrace; 22 regions; source `art/source/animals/safari-sheet.jpg` (crop 290x203+1080+50).
- [x] `animal-zebra` - Light Potrace; 74 regions; source `art/source/animals/safari-sheet.jpg` (crop 273x227+38+293).
- [x] `animal-rhino` - Light Potrace; 19 regions; source `art/source/animals/safari-sheet.jpg` (crop 302x194+372+312).
- [x] `animal-leopard` - Light Potrace; 89 regions; source `art/source/animals/safari-sheet.jpg` (crop 318x193+721+310).
- [x] `animal-ostrich` - Light Potrace; 18 regions; source `art/source/animals/safari-sheet.jpg` (crop 192x262+1138+277).
- [x] `animal-buffalo` - Light Potrace; 19 regions; source `art/source/animals/safari-sheet.jpg` (crop 301x207+36+545).
- [x] `animal-meerkat` - Light Potrace; 17 regions; source `art/source/animals/safari-sheet.jpg` (crop 138x214+479+537).
- [x] `animal-warthog` - Light Potrace; 18 regions; source `art/source/animals/safari-sheet.jpg` (crop 258x194+744+552).
- [x] `animal-crocodile` - Light Potrace; 44 regions; source `art/source/animals/safari-sheet.jpg` (crop 312x151+1061+580).

### Space

- [x] `space-alien` - Light Potrace; 99 regions; source `art/source/space/alien.jpg`.
- [x] `space-spaceship` - Light Potrace; 599 regions; source `art/source/space/spaceship.jpg`.
- [x] `space-crater` - authored composite SVG; 435 regions; source `art/source/space/crater-horizon.svg`.
