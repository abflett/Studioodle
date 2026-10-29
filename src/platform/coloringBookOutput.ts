import { downloadFile } from './downloadFile';
import { invoke } from '@tauri-apps/api/core';
import { isNative } from './desktop';
import { pageSharingCode } from '../editor/pageSharing';
import type { ColoringBook } from '../editor/coloringBook';

export async function downloadColoringBook(book: ColoringBook): Promise<boolean> {
  const text = pageSharingCode(book);
  const name = `${book.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'Coloring Book'}.studioodle`;
  document.exitPointerLock?.();
  if (isNative) return invoke<boolean>('save_coloring_book', { name, text });
  downloadFile(new Blob([text], { type: 'text/plain;charset=utf-8' }), name);
  return true;
}
