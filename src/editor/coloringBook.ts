import { isSavedPicture } from './pictureValidation';
import { paperSize } from './document';
import type { EditorSetup } from './setup';
import type { SavedPicture } from './savedPicture';

export type ColoringBook = {
  format: 'studioodle-coloring-book';
  version: 1;
  title: string;
  pages: SavedPicture[];
};
export const maxBookBytes = 20 * 1024 * 1024;
const validId = (id: string) => /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(id);

/** A book carries geometry only. Explicit projection also discards editor-only metadata. */
export function coloringBookPage(source: EditorSetup, id: string, title = source.title, updatedAt = Date.now()): SavedPicture {
  if (!source.document || !validId(id) || !title.trim() || title.trim().length > 160) throw new Error('A page needs a valid ID, title, and document.');
  const size = paperSize(source.format, source.size);
  const page: SavedPicture = {
    id, title: title.trim(), version: 3, updatedAt, format: source.format, size,
    background: '#ffffff', leafColor: 0x242428,
    document: { version: 3, horizonLayout: 2, width: size.width, height: size.height,
      surfaces: source.document.surfaces.map(s => ({
        id: s.id, kind: s.kind, x: s.x, y: s.y, color: s.kind === 'canvas' ? 0xffffff : 0,
        ...(s.scale !== undefined ? { scale: s.scale } : {}),
        ...(s.rotation !== undefined ? { rotation: s.rotation } : {}),
        ...(s.flipX !== undefined ? { flipX: s.flipX } : {}),
        ...(s.flipY !== undefined ? { flipY: s.flipY } : {}), paint: [],
      })),
    },
  };
  if (page.document.surfaces.length > 1000 || !isSavedPicture(page)) throw new Error(`Invalid geometry or unavailable sticker in “${title}”.`);
  return page;
}

export function makeColoringBook(title: string, pages: EditorSetup[]): ColoringBook {
  if (!title.trim() || title.trim().length > 160 || pages.length > 1000) throw new Error('Invalid book title or page count.');
  const ids = new Set<string>();
  return { format: 'studioodle-coloring-book', version: 1, title: title.trim(), pages: pages.map(p => {
    if (!p.id || ids.has(p.id)) throw new Error('Every page must have a unique, stable ID.');
    ids.add(p.id);
    return coloringBookPage(p, p.id, p.title, 'updatedAt' in p && typeof p.updatedAt === 'number' ? p.updatedAt : 0);
  }) };
}

export function parseColoringBook(text: string): ColoringBook {
  if (new TextEncoder().encode(text).length > maxBookBytes) throw new Error('This book is too large (maximum 20 MB).');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!value || typeof value !== 'object') throw new Error('Not a Studioodle coloring book.');
  const book = value as ColoringBook;
  if (book.format !== 'studioodle-coloring-book' || book.version !== 1 || typeof book.title !== 'string' || !Array.isArray(book.pages)) throw new Error('Unsupported coloring book format or version.');
  for (const p of book.pages) {
    if (!isSavedPicture(p) || p.document.horizonLayout !== 2) throw new Error('A page is invalid or uses stickers unavailable in this app version.');
  }
  return makeColoringBook(book.title, book.pages);
}

/** Revisions replace matching IDs without moving pages; new pages append in book order. */
export function mergeColoringPages(base: SavedPicture[], revisions: SavedPicture[]): SavedPicture[] {
  const result = new Map(base.map(p => [p.id, p]));
  for (const page of revisions) result.set(page.id, page);
  return [...result.values()];
}
