import type { EditorSetup } from './setup';
import type { StickerKind, SurfaceData } from './document';

const placements: [StickerKind, number, number][] = [
  ['beach-shore', 960, 1201.5], ['spring-sun', 960, 170],
  ['spring-cloud', 1490, 160], ['beach-palm', 360, 490],
  ['beach-towel', 1310, 820], ['beach-umbrella', 1390, 540],
  ['beach-ball', 850, 760], ['beach-shell', 640, 880], ['beach-shell', 1720, 850],
];
export const beachScene: EditorSetup = {
  title: 'Sunny beach day', format: 'landscape', size: { width: 1920, height: 960 },
  background: '#ffffff', leafColor: 0x242428,
  document: {
    version: 3, width: 1920, height: 960,
    surfaces: [
      { id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
      ...placements.map(([kind, x, y], index): SurfaceData => ({
        id: `beach-instance-${index}`, kind, x, y, color: 0, paint: [],
      })),
    ],
  },
};
