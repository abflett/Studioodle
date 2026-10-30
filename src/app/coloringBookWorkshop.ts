import { coloringPages } from './coloringPages';
import { coloringBookPage, makeColoringBook, mergeColoringPages } from '../editor/coloringBook';
import { createIndexedColoringBook } from '../platform/indexedColoringBook';
import type { EditorSetup } from '../editor/setup';

export const workshopRepository = createIndexedColoringBook();

export async function workshopPages() {
  const base = coloringPages.map(p => coloringBookPage(p, p.id!, p.title, 0));
  return mergeColoringPages(base, (await workshopRepository.load()).pages);
}

export async function saveWorkshopPage(source: EditorSetup, id: string, title: string) {
  const page = coloringBookPage(source, id, title);
  await workshopRepository.merge(makeColoringBook(await workshopRepository.title(), [page]));
  return page;
}
