import type { EditorSetup } from './setup';
import type { StickerKind, SurfaceData } from './document';

// Back-to-front layout: continuous ground, fence, cottage/tree, then foreground.
// Repeated fence sections have the same spacing, baseline, and scale.
const objects: [StickerKind, number, number, number?, boolean?][] = [
  ['spring-meadow', 768, 1030, .8],
  ['garden-rainbow', 840, 220, .85],
  ['garden-sun', 206, 175, .9],
  ['garden-cloud', 510, 115, .85], ['garden-cloud', 1360, 115, .85],
  ['garden-bush', 145, 595], ['garden-bush', 1380, 580],
  ['garden-fence', 180, 640], ['garden-fence', 540, 640],
  ['garden-fence', 900, 640], ['garden-fence', 1260, 640], ['garden-fence', 1620, 640],
  ['garden-path', 958, 860],
  ['garden-house', 1045, 475],
  ['garden-blossom', 1085, 630], ['garden-blossom', 1150, 630], ['garden-blossom', 1215, 630],
  ['garden-tree', 495, 485],
  ['garden-apple', 385, 385], ['garden-apple', 500, 315],
  ['garden-apple', 605, 370], ['garden-apple', 405, 500],
  ['garden-apple', 525, 465], ['garden-apple', 630, 510],
  ['garden-bush', 175, 745, .8], ['garden-bush', 1360, 760, .8],
  ['garden-stone', 950, 785, .45], ['garden-stone', 930, 830, .65],
  ['garden-stone', 935, 880, .8], ['garden-stone', 970, 930], ['garden-stone', 1005, 985, 1.15],
  ['garden-flower', 140, 860, .75], ['garden-flower', 350, 900, .7],
  ['garden-flower', 590, 925, .65], ['garden-flower', 1390, 860, .75],
  ['garden-flower', 1235, 925, .65],
  ['garden-mushroom', 760, 905, .7], ['garden-mushroom', 775, 970, .55],
  ['garden-grass', 550, 785], ['garden-grass', 640, 1000],
  ['garden-grass', 1110, 990], ['garden-grass', 1460, 990],
  ['garden-butterfly', 140, 425, .87, true], ['garden-butterfly', 1415, 330, .8],
];

export const gardenScene: EditorSetup = {
  title: 'Cottage Garden', format: 'landscape', size: { width: 1536, height: 1024 },
  background: '#ffffff', leafColor: 0x000000,
  document: {
    version: 5, width: 1536, height: 1024,
    surfaces: [
      { id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff },
      ...objects.map(([kind, x, y, scale = 1, flipX = false], index): SurfaceData => ({
        id: `garden-${index}`, kind, x, y, scale, flipX, color: 0,
      })),
    ],
  },
};
