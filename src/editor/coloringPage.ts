import type { SavedPicture } from './storage';

/** Copy only sticker geometry and line art; paint and paper colors never carry over. */
export function createColoringPage(source: SavedPicture, title: string): SavedPicture {
  return {
    ...source, id: crypto.randomUUID(), title, updatedAt: Date.now(),
    background: '#ffffff', leafColor: 0x242428,
    document: {
      ...source.document,
      surfaces: source.document.surfaces.map(surface => ({
        ...surface, paint: [], color: surface.kind === 'canvas' ? 0xffffff : 0x000000,
      })),
    },
  };
}
