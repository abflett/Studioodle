import { makeColoringBook, maxBookBytes, parseColoringBook } from '../editor/coloringBook';
import type { ColoringBook } from '../editor/coloringBook';

const prefix = 'studioodle-page:2:';
export function pageSharingCode(book: ColoringBook) {
  const text = JSON.stringify(makeColoringBook(book.title, book.pages));
  if (new TextEncoder().encode(text).length > maxBookBytes) throw Error('This page is too large to share.');
  // encodeURIComponent keeps non-ASCII page titles portable through base64.
  return prefix + btoa(encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))));
}
export function parsePageSharingCode(input: string) {
  const text = input.trim();
  if (text.length > maxBookBytes * 1.5 + prefix.length) throw Error('This sharing code is too large.');
  if (!text.startsWith(prefix)) return parseColoringBook(text);
  try {
    const binary = atob(text.slice(prefix.length));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return parseColoringBook(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw Error('Invalid sharing code, unsupported page, or unavailable stickers.'); }
}
/** Sharing adds independent copies, never overwrites a recipient's local revision. */
export function independentPages(book: ColoringBook): ColoringBook {
  if (!book.pages.length) throw Error('This book has no pages.');
  return makeColoringBook(book.title, book.pages.map(page => ({ ...page, id: crypto.randomUUID() })));
}
