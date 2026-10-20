import type { EditorSetup } from './setup';
import type { StickerKind, SurfaceData } from './document';

const placements: [StickerKind, number, number][] = [
  ['counting-bunting', 960, 55],
  ['counting-01', 192, 305], ['counting-02', 576, 305], ['counting-03', 960, 305],
  ['counting-04', 1344, 305], ['counting-05', 1728, 305],
  ['counting-06', 192, 735], ['counting-07', 576, 735], ['counting-08', 960, 735],
  ['counting-09', 1344, 735], ['counting-10', 1728, 735],
  ['counting-star', 380, 520], ['counting-star', 764, 520],
  ['counting-star', 1148, 520], ['counting-star', 1532, 520],
];

export const countingScene: EditorSetup = {
  title: 'Counting Costume Parade', format: 'landscape', size: { width: 1920, height: 960 },
  background: '#ffffff', leafColor: 0x242428,
  document: {
    version: 5, width: 1920, height: 960,
    surfaces: [
      { id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff },
      ...placements.map(([kind, x, y], index): SurfaceData => ({
        id: `counting-instance-${index}`, kind, x, y, color: 0,
      })),
    ],
  },
};
