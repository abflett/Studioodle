import type { SavedPicture } from './savedPicture';

/** Copy only sticker geometry and line art; paint and paper colors never carry over. */
export function createColoringPage(source: SavedPicture, title: string): SavedPicture {
  return {
    ...source, version: 3, id: crypto.randomUUID(), title, updatedAt: Date.now(),
    background: '#ffffff', leafColor: 0x242428,
    document: {
      ...source.document, version: 3,
      surfaces: source.document.surfaces.map(surface => {
        const clean = { ...surface, paint: [], color: surface.kind === 'canvas' ? 0xffffff : 0x000000 };
        delete clean.vectorPaint;
        return clean;
      }),
    },
  };
}
