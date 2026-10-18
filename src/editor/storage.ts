import { cottageMask, isCottageSticker } from './stickerMasks';
import { isVectorSticker, vectorStickerSize } from './vectorStickers';
import { paperSize, paintScale } from './document';
import type { EditorSetup } from './setup';
import type { Mark, ArtworkDocument } from './document';

export type SavedPicture = EditorSetup & { id: string; version: 1 | 2; updatedAt: number };
const prefix = 'studioodle.picture.';
export function deletePicture(id: string) { localStorage.removeItem(prefix + id); }

export function savePicture(picture: SavedPicture) {
  // A separate key for each document avoids replacing the rest of the library.
  localStorage.setItem(prefix + picture.id, JSON.stringify(picture));
}

function isMark(value: unknown): value is Mark {
  if (!value || typeof value !== 'object') return false;
  const mark = value as Record<string, unknown>;
  if (typeof mark.color !== 'number' || !Number.isFinite(mark.color)) return false;
  if (mark.kind === 'stroke') return (mark.erase === undefined || typeof mark.erase === 'boolean') && (mark.flood === undefined || typeof mark.flood === 'boolean') && Array.isArray(mark.points) && mark.points.every((point: unknown) => {
    if (!point || typeof point !== 'object') return false;
    const p = point as Record<string, unknown>;
    return typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y);
  });
  if (mark.transparent !== undefined && typeof mark.transparent !== 'boolean') return false;
  return (['tree', 'flower', 'circle', 'square', 'triangle'].includes(String(mark.kind)) || isCottageSticker(String(mark.kind))) && typeof mark.x === 'number' && Number.isFinite(mark.x) && typeof mark.y === 'number' && Number.isFinite(mark.y);
}

export function loadPictures(): SavedPicture[] {
  const pictures: SavedPicture[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const picture = JSON.parse(localStorage.getItem(key) ?? 'null') as SavedPicture | null;
      if (picture && (picture.version === 1 || picture.version === 2) && typeof picture.id === 'string' && key === prefix + picture.id &&
        typeof picture.title === 'string' && typeof picture.background === 'string' && /^#[0-9a-f]{6}$/i.test(picture.background) &&
        ['square', 'landscape', 'portrait', 'window'].includes(picture.format) &&
        (picture.size === undefined ? picture.format !== 'window' : validSize(picture.size)) && Number.isFinite(picture.leafColor) && Number.isFinite(picture.updatedAt) &&
        (picture.version === 1 ? Array.isArray(picture.marks) && picture.marks.every(isMark) : isArtworkDocument(picture.document) && picture.document.width === paperSize(picture.format, picture.size).width && picture.document.height === paperSize(picture.format, picture.size).height)) pictures.push(picture);
    } catch { /* One unreadable document must not hide the remaining pictures. */ }
  }
  return pictures.sort((a, b) => b.updatedAt - a.updatedAt);
}





function validSize(value: unknown): value is { width: number; height: number } {
  if (!value || typeof value !== 'object') return false;
  const size = value as { width: number; height: number };
  return Number.isInteger(size.width) && Number.isInteger(size.height) && size.width > 0 && size.height > 0 && size.width <= 8192 && size.height <= 8192 && size.width * size.height <= 16777216;
}
function isArtworkDocument(value: unknown): value is ArtworkDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as ArtworkDocument;
  if (doc.version !== 2 || !validSize(doc) || !Array.isArray(doc.surfaces) || !doc.surfaces.length) return false;
  const ids = new Set<string>();
  return doc.surfaces.every((surface, order) => {
    if (!surface || typeof surface !== 'object' || typeof surface.id !== 'string' || ids.has(surface.id)) return false;
    ids.add(surface.id);
    if (order === 0 ? surface.kind !== 'canvas' : !['tree', 'flower', 'circle', 'square', 'triangle'].includes(surface.kind) && !isCottageSticker(surface.kind) && !isVectorSticker(surface.kind)) return false;
    if (![surface.x, surface.y, surface.color].every(Number.isFinite) || !Number.isInteger(surface.color) || surface.color < 0 || surface.color > 0xffffff) return false;
    if (surface.legacyFill !== undefined && (!Number.isInteger(surface.legacyFill) || surface.legacyFill < 0 || surface.legacyFill > 0xffffff)) return false;
    if (!Array.isArray(surface.paint)) return false;
    if (surface.nativePixels !== undefined && typeof surface.nativePixels !== 'boolean') return false;
    if (surface.paintDpi !== undefined && surface.paintDpi !== 96 && surface.paintDpi !== 150) return false;
    if (surface.scale !== undefined && (!Number.isFinite(surface.scale) || surface.scale < .1 || surface.scale > 4)) return false;
    if (surface.rotation !== undefined && (!Number.isFinite(surface.rotation) || surface.rotation < 0 || surface.rotation >= 360)) return false;
    if (surface.kind === 'canvas' && ((surface.scale ?? 1) !== 1 || (surface.rotation ?? 0) !== 0)) return false;
    const mask = isCottageSticker(surface.kind) ? cottageMask(surface.kind, surface.nativePixels === true) : undefined;
    const vector = isVectorSticker(surface.kind) ? vectorStickerSize(surface.kind) : undefined;
    const resolution = order === 0 || vector ? paintScale(surface) : 1;
    const w = order === 0 ? doc.width : vector?.width ?? mask?.width ?? 220;
    const h = order === 0 ? doc.height : vector?.height ?? mask?.height ?? 280;
    const pixels = Math.ceil(w * resolution) * Math.ceil(h * resolution);
    let end = 0;
    return surface.paint.every((run) => {
      if (!Array.isArray(run) || run.length !== 3 || !run.every(Number.isInteger)) return false;
      const [start, length, color] = run;
      if (start < end || length < 1 || start + length > pixels || color < 0 || color > 0xffffff) return false;
      end = start + length; return true;
    });
  });
}



