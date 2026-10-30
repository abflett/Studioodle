import { createAppDatabase, abortTransaction } from './appDatabase';
import { createLocalTemplateRepository } from './localTemplateRepository';
import { parseColoringBook, mergeColoringPages } from '../editor/coloringBook';
import { isSavedPicture } from '../editor/pictureValidation';
import type { ColoringBook, ColoringBookPage } from '../editor/coloringBook';

/** Legacy inputs are read only until their individual pages commit with the marker. */
export function createIndexedColoringBook(name?: string, storage: () => Storage = () => localStorage) {
  const db = createAppDatabase(name), marker = 'custom-pages-import-v1';
  let migration: Promise<void> | undefined;
  const migrate = () => migration ??= (async () => {
    if (await db.request(['meta'], 'readonly', tx => tx.objectStore('meta').get(marker))) return;
    const source = storage(), text = source.getItem('studioodle.workshop.v3');
    const book = text === null ? { title: 'Studioodle Coloring Book', pages: [] } : parseColoringBook(text);
    const authoritative = text !== null && JSON.parse(text).localPages === true;
    const legacy = { title: book.title, pages: authoritative ? book.pages : mergeColoringPages(createLocalTemplateRepository(() => source).load(), book.pages) };
    await db.transaction(['meta', 'pages'], 'readwrite', tx => {
      const meta = tx.objectStore('meta'), pages = tx.objectStore('pages'), request = meta.get(marker);
      request.onsuccess = () => {
        if (request.result) return;
        try {
          for (const [order, page] of legacy.pages.entries()) {
            const existing = pages.get(page.id);
            existing.onsuccess = () => { try { if (!existing.result) pages.put({ ...page, libraryOrder: order }); } catch { abortTransaction(tx); } };
          }
          meta.put(true, marker); meta.put(legacy.title, 'custom-pages-title'); meta.put(legacy.pages.length, 'custom-page-next-order');
        } catch { abortTransaction(tx); }
      };
      return () => undefined;
    });
  })().catch(error => { migration = undefined; throw error; });
  return {
    async load(): Promise<ColoringBook> {
      await migrate();
      return db.transaction(['pages', 'meta'], 'readonly', tx => {
        const pages = tx.objectStore('pages').getAll(), title = tx.objectStore('meta').get('custom-pages-title');
        return () => ({ format: 'studioodle-coloring-book', version: 2, title: title.result ?? 'Studioodle Coloring Book', pages: (pages.result as (ColoringBookPage & { libraryOrder?: number })[])
          .filter((record): boolean => isSavedPicture(record)).sort((a, b) => (a.libraryOrder ?? 0) - (b.libraryOrder ?? 0)).map(record => { const page = { ...record }; delete page.libraryOrder; return page; }) });
      });
    },
    async merge(book: ColoringBook) {
      const checked = parseColoringBook(JSON.stringify(book)); await migrate();
      await db.transaction(['pages', 'meta'], 'readwrite', tx => {
        const pages = tx.objectStore('pages'), meta = tx.objectStore('meta'), counter = meta.get('custom-page-next-order');
        counter.onsuccess = () => {
          let next = counter.result ?? 0;
          for (const page of checked.pages) {
            const existing = pages.get(page.id);
            existing.onsuccess = () => {
              try { pages.put({ ...page, libraryOrder: existing.result?.libraryOrder ?? next++ }); meta.put(next, 'custom-page-next-order'); }
              catch { abortTransaction(tx); }
            };
          }
          try { meta.put(checked.title, 'custom-pages-title'); } catch { abortTransaction(tx); }
        };
        return () => undefined;
      });
    },
    async title(): Promise<string> { await migrate(); return (await db.request(['meta'], 'readonly', tx => tx.objectStore('meta').get('custom-pages-title'))) ?? 'Studioodle Coloring Book'; },
    async delete(id: string) { await migrate(); await db.request(['pages'], 'readwrite', tx => tx.objectStore('pages').delete(id)); },
  };
}
