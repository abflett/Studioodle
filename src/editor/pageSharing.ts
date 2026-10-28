import { makeColoringBook, maxBookBytes, parseColoringBook } from './coloringBook';
import type { ColoringBook } from './coloringBook';

const prefix = 'studioodle-page:3:';
export const maxSharingCodeBytes = prefix.length + 4 * Math.ceil(maxBookBytes / 3);

/** Portable sticker layout and ink colors; paper and unpainted regions stay white. */
export function pageSharingCode(book: ColoringBook) {
  const checked = makeColoringBook(book.title, book.pages);
  if (new TextEncoder().encode(JSON.stringify(checked)).length > maxBookBytes) throw Error('This page is too large to share.');
  const text = JSON.stringify({ title: checked.title, pages: checked.pages.map(page => ({
    id: page.id, title: page.title, format: page.format, size: page.size, browse: page.browse,
    surfaces: page.document.surfaces.map(surface => ({
      id: surface.id, kind: surface.kind, x: surface.x, y: surface.y,
      ...(surface.kind !== 'canvas' ? { inkColor: surface.color } : {}),
      scale: surface.scale, rotation: surface.rotation, flipX: surface.flipX, flipY: surface.flipY,
    })),
  })) });
  if (new TextEncoder().encode(text).length > maxBookBytes) throw Error('This page is too large to share.');
  return prefix + btoa(encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))));
}

type Layout = { title: string; pages: { id: string; title: string; format: string;
  size: { width: number; height: number }; browse?: unknown;
  surfaces: { id: string; kind: string; x: number; y: number; scale?: number; rotation?: number; flipX?: boolean; flipY?: boolean; inkColor?: number }[] }[] };

export function parsePageSharingCode(input: string) {
  const text = input.trim();
  if (text.length > maxSharingCodeBytes) throw Error('This sharing code is too large.');
  if (!text.startsWith(prefix)) throw Error('Use a Studioodle page sharing code (version 3).');
  try {
    const binary = atob(text.slice(prefix.length));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (bytes.length > maxBookBytes) throw Error('Too large.');
    const layout = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Layout;
    // Reuse document validation for sticker availability, dimensions and transforms.
    return parseColoringBook(JSON.stringify({ format: 'studioodle-coloring-book', version: 2,
      title: layout.title, pages: layout.pages.map(page => ({
        id: page.id, title: page.title, format: page.format, size: page.size, browse: page.browse,
        version: 5, updatedAt: 0, background: '#ffffff', leafColor: 0x242428,
        document: { version: 5, width: page.size.width, height: page.size.height,
          surfaces: page.surfaces.map(surface => ({
            id: surface.id, kind: surface.kind, x: surface.x, y: surface.y,
            scale: surface.scale, rotation: surface.rotation, flipX: surface.flipX, flipY: surface.flipY,
            color: surface.kind === 'canvas' ? 0xffffff : (surface.inkColor === undefined ? 0 : surface.inkColor),
          })),
        },
      })),
    }));
  } catch { throw Error('Invalid sharing code, unsupported page, or unavailable stickers.'); }
}
/** Sharing adds independent copies, never overwrites a recipient's local revision. */
export function independentPages(book: ColoringBook): ColoringBook {
  if (!book.pages.length) throw Error('This book has no pages.');
  return makeColoringBook(book.title, book.pages.map(page => ({ ...page, id: crypto.randomUUID() })));
}
