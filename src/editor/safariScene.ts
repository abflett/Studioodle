import type { EditorSetup } from './setup';
import type { StickerKind, SurfaceData } from './document';

// Back to front: meadow, sky/trees, distant animals, water, then near-bank wildlife.
// Source dimensions are intentional; fullPageScene fits the composition onto A4.
const placements: [StickerKind, number, number, number, boolean?][] = [
  ['spring-meadow', 960, 1220, 1],
  ['garden-sun', 1440, 160, .5],
  ['garden-cloud', 640, 155, .8], ['spring-cloud', 1090, 240, .6],
  ['garden-tree', 245, 395, .9], ['garden-tree', 1700, 525, .8, true],
  ['garden-bush', 565, 665, .7], ['garden-bush', 1785, 880, .8],
  ['animal-giraffe', 345, 645, 1.75],
  ['animal-elephant', 810, 650, 1.3],
  ['animal-zebra', 1260, 665, 1.2, true],
  ['animal-ostrich', 1640, 655, 1.15],
  ['winter-pond', 1100, 1030, 1.2],
  ['animal-hippo', 1510, 925, 1.15],
  ['animal-crocodile', 1040, 1090, 1.1, true],
  ['animal-lion', 310, 1050, 1.2], ['animal-meerkat', 535, 1110, .75],
  ['garden-stone', 620, 970, .8], ['garden-stone', 1660, 1140, 1.1],
  ['garden-stone', 1735, 1175, .6],
  ['garden-grass', 130, 1190, 1.3], ['garden-grass', 465, 1220, 1.1],
  ['garden-grass', 690, 800, .8], ['garden-grass', 1405, 790, .8],
  ['garden-grass', 1770, 1020, 1.2], ['garden-grass', 1520, 1220, 1.2],
];

export const safariScene: EditorSetup = {
  title: 'Safari Watering Hole', format: 'landscape', size: { width: 1920, height: 1280 },
  background: '#ffffff', leafColor: 0x000000,
  document: {
    version: 3, horizonLayout: 2, width: 1920, height: 1280,
    surfaces: [
      { id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
      ...placements.map(([kind, x, y, scale, flipX = false], index): SurfaceData => ({
        id: `safari-${index}`, kind, x, y, scale, flipX, color: 0, paint: [],
      })),
    ],
  },
};
