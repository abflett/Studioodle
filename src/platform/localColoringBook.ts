import { makeColoringBook, mergeColoringPages, parseColoringBook } from '../editor/coloringBook';
import type { SavedPicture } from '../editor/savedPicture';
import type { ColoringBook } from '../editor/coloringBook';

/** One storage write makes an import atomic, including on storage quota failure. */
export function createLocalColoringBook(storage: () => Storage = () => localStorage, currentTemplates?: () => SavedPicture[]) {
  const key = 'studioodle.workshop.v3';
  return {
    load(): ColoringBook {
      const text = storage().getItem(key);
      const book = text === null ? makeColoringBook('Studioodle Coloring Book', []) : parseColoringBook(text);
      // Consolidate the two current template sources on the next successful write.
      // Until then reads are non-mutating; quota failures preserve both sources.
      const authoritative = text !== null && JSON.parse(text).localPages === true;
      if (authoritative || !currentTemplates) return book;
      return makeColoringBook(book.title, mergeColoringPages(currentTemplates(), book.pages));
    },
    merge(book: ColoringBook) {
      const checked = parseColoringBook(JSON.stringify(book));
      const previous = this.load();
      const text = JSON.stringify({ ...makeColoringBook(checked.title, mergeColoringPages(previous.pages, checked.pages)), localPages: true });
      parseColoringBook(text);
      storage().setItem(key, text);
    },
    delete(id: string) {
      const previous = this.load();
      const text = JSON.stringify({ ...makeColoringBook(previous.title, previous.pages.filter(p => p.id !== id)), localPages: true });
      parseColoringBook(text);
      storage().setItem(key, text);
    },
  };
}
