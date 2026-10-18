import type { EditorSetup } from './setup';
import type { StickerKind, SurfaceData } from './document';

const placements: [StickerKind, number, number][] = [
  ['winter-snow', 960, 735], ['winter-pond', 1130, 790],
  ['winter-pine', 1650, 520], ['winter-pine', 1760, 700], ['winter-cabin', 350, 650],
  ['winter-santa-sleigh', 300, 215], ['winter-reindeer', 760, 215], ['winter-reindeer', 1140, 215],
  ['winter-present', 610, 850], ['winter-present', 790, 865],
  ['winter-skater', 1000, 690], ['winter-skater-friend', 1280, 695],
  ['counting-star', 1500, 160], ['counting-star', 1760, 280],
];
export const winterScene: EditorSetup = {
  title: 'Christmas skating village', format: 'landscape', size: { width: 1920, height: 960 },
  background: '#ffffff', leafColor: 0x242428,
  document: {
    version: 2, width: 1920, height: 960,
    surfaces: [
      { id: 'canvas', kind: 'canvas', paintDpi: 150, x: 0, y: 0, color: 0xffffff, paint: [] },
      ...placements.map(([kind, x, y], index): SurfaceData => ({
        id: `winter-instance-${index}`, kind, x, y, color: 0, nativePixels: true, paint: [],
      })),
    ],
  },
};
