import type { EditorSetup } from './setup';
import type { StickerKind, SurfaceData } from './document';

const placements: [StickerKind, number, number][] = [
  ['spring-meadow', 960, 775], ['spring-sun', 220, 180],
  ['spring-cloud', 590, 140], ['spring-cloud', 1600, 150],
  ['spring-butterfly', 970, 280], ['spring-bird', 1360, 780],
  ['spring-tulip', 250, 650], ['spring-tulip', 1660, 700],
  ['spring-bunny', 1020, 680], ['spring-watering-can', 560, 760],
];
export const springScene: EditorSetup = {
  title: "Chloe's spring garden", format: 'landscape', size: { width: 1920, height: 960 },
  background: '#ffffff', leafColor: 0x242428,
  document: {
    version: 2, width: 1920, height: 960,
    surfaces: [
      { id: 'canvas', kind: 'canvas', paintDpi: 150, x: 0, y: 0, color: 0xffffff, paint: [] },
      ...placements.map(([kind, x, y], index): SurfaceData => ({
        id: `spring-instance-${index}`, kind, x, y, color: 0, nativePixels: true, paint: [],
      })),
    ],
  },
};

