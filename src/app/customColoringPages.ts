import { coloringBookPage, makeColoringBook } from '../editor/coloringBook';
import { createIndexedColoringBook } from '../platform/indexedColoringBook';
import type { EditorSetup } from '../editor/setup';

export const customPagesRepository = createIndexedColoringBook();

export async function saveCustomPage(source: EditorSetup, id: string, title: string) {
  const page = coloringBookPage(source, id, title);
  await customPagesRepository.merge(makeColoringBook(await customPagesRepository.title(), [page]));
  return page;
}
