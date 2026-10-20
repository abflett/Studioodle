import { coloringPages } from './coloringPages';
import { coloringPageRepository } from './pictures';
import { coloringBookPage, makeColoringBook, mergeColoringPages } from '../editor/coloringBook';
import { createLocalColoringBook } from '../platform/localColoringBook';
import type { EditorSetup } from '../editor/setup';

export const workshopRepository = createLocalColoringBook();

export function workshopPages(custom: EditorSetup[] = coloringPageRepository.load()) {
  const base = [...coloringPages, ...custom].map(p => coloringBookPage(p, p.id!, p.title, 0));
  return mergeColoringPages(base, workshopRepository.load().pages);
}

export function saveWorkshopPage(source: EditorSetup, id: string, title: string) {
  const page = coloringBookPage(source, id, title);
  workshopRepository.merge(makeColoringBook(workshopRepository.load().title, [page]));
  return page;
}
