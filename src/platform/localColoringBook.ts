import { makeColoringBook, mergeColoringPages, parseColoringBook } from '../editor/coloringBook';
import type { ColoringBook } from '../editor/coloringBook';

/** One storage write makes an import atomic, including on storage quota failure. */
export function createLocalColoringBook(storage: () => Storage = () => localStorage) {
  const key = 'studioodle.workshop.v2';
  return {
    load(): ColoringBook {
      const text = storage().getItem(key);
      return text === null ? makeColoringBook('Studioodle Coloring Book', []) : parseColoringBook(text);
    },
    merge(book: ColoringBook) {
      const checked = parseColoringBook(JSON.stringify(book));
      const previous = this.load();
      const text = JSON.stringify(makeColoringBook(checked.title, mergeColoringPages(previous.pages, checked.pages)));
      parseColoringBook(text);
      storage().setItem(key, text);
    },
    delete(id: string) {
      const previous = this.load();
      storage().setItem(key, JSON.stringify(makeColoringBook(previous.title, previous.pages.filter(p => p.id !== id))));
    },
  };
}
