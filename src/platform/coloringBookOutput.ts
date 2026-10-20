import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from './desktop';
import { makeColoringBook, maxBookBytes } from '../editor/coloringBook';
import type { ColoringBook } from '../editor/coloringBook';

export async function downloadColoringBook(book: ColoringBook): Promise<boolean> {
  const checked = makeColoringBook(book.title, book.pages);
  const text = JSON.stringify(checked, null, 2) + '\n';
  if (new TextEncoder().encode(text).length > maxBookBytes) throw new Error('This book is too large (maximum 20 MB).');
  const name = `${book.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'Coloring Book'}.json`;
  document.exitPointerLock?.();
  if (isDesktop) return invoke<boolean>('save_coloring_book', { name, text });
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
