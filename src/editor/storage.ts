import type { EditorSetup } from './setup';
import type { Mark } from './document';

export type SavedPicture = EditorSetup & { id: string; version: 1; updatedAt: number; marks: Mark[] };
const prefix = 'studioodle.picture.';

export function savePicture(picture: SavedPicture) {
  // A separate key for each document avoids replacing the rest of the library.
  localStorage.setItem(prefix + picture.id, JSON.stringify(picture));
}

function isMark(value: unknown): value is Mark {
  if (!value || typeof value !== 'object') return false;
  const mark = value as Record<string, unknown>;
  if (typeof mark.color !== 'number' || !Number.isFinite(mark.color)) return false;
  if (mark.kind === 'stroke') return Array.isArray(mark.points) && mark.points.every((point: unknown) => {
    if (!point || typeof point !== 'object') return false;
    const p = point as Record<string, unknown>;
    return typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y);
  });
  return (['tree', 'flower', 'circle', 'square', 'triangle'].includes(String(mark.kind))) && typeof mark.x === 'number' && Number.isFinite(mark.x) && typeof mark.y === 'number' && Number.isFinite(mark.y);
}

export function loadPictures(): SavedPicture[] {
  const pictures: SavedPicture[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const picture = JSON.parse(localStorage.getItem(key) ?? 'null') as SavedPicture | null;
      if (picture?.version === 1 && typeof picture.id === 'string' && key === prefix + picture.id &&
        typeof picture.title === 'string' && typeof picture.background === 'string' && /^#[0-9a-f]{6}$/i.test(picture.background) &&
        ['square', 'landscape', 'portrait'].includes(picture.format) && Number.isFinite(picture.leafColor) && Number.isFinite(picture.updatedAt) &&
        Array.isArray(picture.marks) && picture.marks.every(isMark)) pictures.push(picture);
    } catch { /* One unreadable document must not hide the remaining pictures. */ }
  }
  return pictures.sort((a, b) => b.updatedAt - a.updatedAt);
}

