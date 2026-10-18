import type { EditorSetup } from './setup';

export const vectorCottageScene: EditorSetup = {
  title: 'Cottage studio', format: 'landscape', size: { width: 1600, height: 1200 },
  background: '#ffffff', leafColor: 0x242428,
  document: {
    version: 2, width: 1600, height: 1200,
    surfaces: [
      { id: 'canvas', kind: 'canvas', paintDpi: 150, x: 0, y: 0, color: 0xffffff, paint: [] },
      { id: 'vector-cottage', kind: 'vector-cottage-v1', paintDpi: 150, x: 800, y: 600, color: 0x242428, scale: .8, nativePixels: true, paint: [] },
    ],
  },
};
