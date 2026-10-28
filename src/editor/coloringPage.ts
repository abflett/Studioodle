import type { SavedPicture } from './savedPicture';

/** Copy only sticker geometry and line art; paint and paper colors never carry over. */
export function createColoringPage(source: SavedPicture, title: string): SavedPicture {
  return {
    ...source, version: 6, id: crypto.randomUUID(), title, updatedAt: Date.now(),
    background: '#ffffff', leafColor: 0x000000,
    document: {
      ...source.document, version: 6,
      surfaces: source.document.surfaces.map(surface => {
        const clean = { ...surface, color: surface.kind === 'canvas' ? 0xffffff : surface.color };
        delete clean.vectorPaint;
        return clean;
      }),
    },
  };
}
