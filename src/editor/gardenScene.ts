import type { EditorSetup } from './setup';
import type { StickerKind, SurfaceData } from './document';

// Native-size instances in back-to-front order. Repeated objects share one asset.
const objects: [StickerKind, number, number][] = [
  ['garden-rainbow', 850, 235],
  ['garden-sun', 206, 175],
  ['garden-cloud', 510, 115], ['garden-cloud', 1360, 115],
  ['garden-bush', 145, 595], ['garden-bush', 405, 595],
  ['garden-bush', 700, 620], ['garden-bush', 1380, 560],
  ['garden-fence', 180, 640], ['garden-fence', 530, 640], ['garden-fence', 1355, 640],
  ['garden-path', 895, 860],
  ['garden-house', 1045, 475],
  ['garden-blossom', 1085, 630], ['garden-blossom', 1150, 630], ['garden-blossom', 1215, 630],
  ['garden-tree', 495, 485],
  ['garden-apple', 385, 385], ['garden-apple', 500, 315],
  ['garden-apple', 605, 370], ['garden-apple', 405, 500],
  ['garden-apple', 525, 465], ['garden-apple', 630, 510],
  ['garden-bush', 175, 745], ['garden-bush', 680, 740], ['garden-bush', 1360, 760],
  ['garden-stone', 930, 780], ['garden-stone', 855, 825],
  ['garden-stone', 790, 875], ['garden-stone', 890, 930], ['garden-stone', 870, 990],
  ['garden-flower', 135, 825], ['garden-flower', 330, 875], ['garden-flower', 480, 940],
  ['garden-flower', 1390, 835], ['garden-flower', 1235, 920],
  ['garden-mushroom', 1035, 885], ['garden-mushroom', 1135, 945], ['garden-mushroom', 940, 960],
  ['garden-grass', 550, 785], ['garden-grass', 600, 980], ['garden-grass', 890, 875],
  ['garden-grass', 1040, 1000], ['garden-grass', 1190, 1000],
  ['garden-butterfly-left', 140, 425], ['garden-butterfly-right', 1415, 330],
];

export const gardenScene: EditorSetup = {
  title: 'Cottage garden', format: 'landscape', size: { width: 1536, height: 1024 },
  background: '#ffffff', leafColor: 0x000000,
  document: {
    version: 2, width: 1536, height: 1024,
    surfaces: [
      { id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
      ...objects.map(([kind, x, y], index): SurfaceData => ({
        id: `garden-${index}`, kind, x, y, color: 0, nativePixels: true, paint: [],
      })),
    ],
  },
};
