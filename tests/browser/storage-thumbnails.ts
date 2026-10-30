import { createIndexedColoringBook } from '../../src/platform/indexedColoringBook';
import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import { createAppDatabase } from '../../src/platform/appDatabase';
import { createPictureThumbnailRepository } from '../../src/platform/pictureThumbnails';
import { makeColoringBook } from '../../src/editor/coloringBook';
import { coloringPages } from '../../src/app/coloringPages';
import { pictureSummary } from '../../src/editor/pictureSummary';
import { pictureRepository, pictureSaves } from '../../src/app/pictures';
import { pictureThumbnails } from '../../src/app/pictureThumbnails';
import type { SavedPicture } from '../../src/editor/savedPicture';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { GalleryPreview } from '../../src/ui/GalleryPreview';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const removeDatabase = (name: string) => new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
const wait = async (predicate: () => unknown) => { for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('Storage test timed out'); };
const drawing = (id: string, updatedAt = 1): SavedPicture => ({ id, updatedAt, title: id, version: 6, format: 'landscape', size: { width: 320, height: 240 }, background: '#ffffff', leafColor: 0,
  document: { version: 6, width: 320, height: 240, surfaces: [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff }] } });

export async function checkStorageThumbnails() {
  const name = `studioodle-pages-test-${crypto.randomUUID()}`, data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, key: (index: number) => [...data.keys()][index] ?? null, get length() { return data.size; } } as Storage;
  const legacy = makeColoringBook('Legacy pages', [coloringPages[0]!]);
  data.set('studioodle.workshop.v3', JSON.stringify(legacy));
  const extra = { ...coloringPages[1]!, id: 'legacy-template' };
  data.set(`studioodle.v6.coloring.${extra.id}`, JSON.stringify(extra));
  const custom = createIndexedColoringBook(name, () => storage), originalPut = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args) { if (this.name === 'pages') throw Error('Injected import failure'); return originalPut.apply(this, args); };
    let rejected = false; try { await custom.load(); } catch { rejected = true; }
    assert(rejected && data.size === 2, 'Failed import must preserve legacy sources');
    IDBObjectStore.prototype.put = originalPut;
    const imported = await custom.load();
    assert(imported.pages.length === 2 && imported.pages.some(page => page.id === extra.id), 'Retry must import both current legacy sources');
    const originalOrder = imported.pages.map(page => page.id).join(',');
    assert(originalOrder === [extra.id, ...legacy.pages.map(page => page.id)].join(','), 'Import must preserve the previous merged collection order');
    data.clear();
    const reopened = createIndexedColoringBook(name, () => { throw Error('Legacy storage must not be read after import'); });
    assert((await reopened.load()).pages.length === 2, 'Completed import must be independent of localStorage');
    assert((await reopened.load()).pages.map(page => page.id).join(',') === originalOrder, 'Reload must preserve custom-page ordering');
    await reopened.delete(extra.id);
    assert(!(await createIndexedColoringBook(name, () => storage).load()).pages.some(page => page.id === extra.id), 'Deleted imports must not reappear');
    const newer = { ...extra, title: 'Replacement' };
    await reopened.merge(makeColoringBook('New', [newer]));
    assert((await reopened.load()).pages.at(-1)?.id === newer.id, 'New pages must append after existing pages');
    await reopened.merge(makeColoringBook('New', [{ ...newer, title: 'Replacement' }]));
    assert((await reopened.load()).pages.map(page => page.id).join(',') === imported.pages.filter(page => page.id !== extra.id).map(page => page.id).concat(extra.id).join(','), 'Replacing an existing ID must not change page order');
    IDBObjectStore.prototype.put = function (...args) { if (this.name === 'pages') this.transaction.abort(); return originalPut.apply(this, args); };
    rejected = false; try { await reopened.merge(makeColoringBook('Failed', [{ ...newer, title: 'Must not replace' }])); } catch { rejected = true; }
    IDBObjectStore.prototype.put = originalPut;
    assert(rejected && (await reopened.load()).pages.find(page => page.id === extra.id)?.title === 'Replacement', 'Failed page replacement must roll back');
    const pictures = createIndexedPictureRepository(name), thumbnails = createPictureThumbnailRepository(name), picture = drawing('cache');
    await pictures.save(picture);
    const blob = new Blob(['png-test'], { type: 'image/png' });
    const thumbnail = { id: picture.id, updatedAt: 1, version: 1, blob, width: 32, height: 24 };
    assert(await thumbnails.put(thumbnail), 'Matching thumbnail must commit');
    assert((await thumbnails.get(picture))?.blob.size === blob.size, 'Thumbnail Blob roundtrip failed');
    await pictures.save({ ...picture, updatedAt: 2 });
    assert(!await thumbnails.get({ ...picture, updatedAt: 2 }), 'New revision must miss the old thumbnail');
    assert(!await thumbnails.put(thumbnail), 'Stale thumbnail completion must be rejected');
    await pictures.delete(picture.id);
    assert(!await thumbnails.get(picture) && !await thumbnails.put({ ...thumbnail, updatedAt: 2 }), 'Delete must remove previews and prevent resurrection');
  } finally { IDBObjectStore.prototype.put = originalPut; await removeDatabase(name); }

  const id = `thumbnail-test-${crypto.randomUUID()}`, picture = drawing(id), originalGet = IDBObjectStore.prototype.get;
  let sourceReads = 0;
  try {
    await pictureRepository.save(picture); await pictureSaves.flush();
    IDBObjectStore.prototype.get = function (...args) { if (this.name === 'pictures') sourceReads++; return originalGet.apply(this, args); };
    const coldStart = performance.now(), cold = await pictureThumbnails.get(picture);
    const coldMs = performance.now() - coldStart;
    assert(sourceReads === 1 && cold.thumbnail.width === 768 && cold.thumbnail.height === 576, 'Cold preview must read one source and produce a bounded raster');
    const bitmap = await createImageBitmap(cold.thumbnail.blob); assert(bitmap.width === 768, 'Generated PNG must decode'); bitmap.close();
    pictureThumbnails.clear(); sourceReads = 0;
    const warmStart = performance.now(); await pictureThumbnails.get(picture); const warmMs = performance.now() - warmStart, warmSourceReads = sourceReads;
    assert(sourceReads === 0, 'Persisted thumbnails must not load vector documents');
    const siblings: string[] = [], revoke = URL.revokeObjectURL; let revoked = 0;
    URL.revokeObjectURL = url => { revoked++; revoke.call(URL, url); };
    try {
      for (let i = 0; i < 6; i++) {
        const sibling = drawing(`${id}-cache-${i}`); siblings.push(sibling.id);
        await pictureRepository.save(sibling);
        await createPictureThumbnailRepository().put({ ...cold.thumbnail, id: sibling.id });
        await pictureThumbnails.get(sibling);
      }
      assert(pictureThumbnails.stats().cached === 5 && revoked >= 2, 'LRU must bound bitmap URLs and revoke evicted entries');
    } finally { URL.revokeObjectURL = revoke; for (const sibling of siblings) await pictureRepository.delete(sibling); pictureThumbnails.clear(); }
    const controller = new AbortController(); controller.abort();
    let cancelled = false; try { await pictureThumbnails.get(picture, controller.signal); } catch { cancelled = true; }
    assert(cancelled, 'Obsolete preview request must cancel');

    // Complete an old PNG encoding only after a newer source revision commits.
    const toBlob = HTMLCanvasElement.prototype.toBlob; let release: (() => void) | undefined;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) { toBlob.call(this, blob => { release = () => callback(blob); }, ...args); };
    pictureThumbnails.invalidate(id); await createPictureThumbnailRepository().delete(id);
    const stale = pictureThumbnails.get(picture).then(() => false, () => true);
    const warmed = drawing(`${id}-warmed`), queued = drawing(`${id}-queued`), newest = drawing(`${id}-newest`);
    try {
      await wait(() => release);
      await pictureRepository.save(warmed);
      await createPictureThumbnailRepository().put({ ...cold.thumbnail, id: warmed.id });
      let loaded = false;
      const ready = pictureThumbnails.get(warmed).then(() => { loaded = true; });
      await wait(() => loaded); await ready;
      assert(pictureThumbnails.stats().generation.active, 'A cached bitmap must load while an unrelated encoding is still held');
      await pictureRepository.save(queued); await pictureRepository.save(newest);
      const obsolete = pictureThumbnails.get(queued).then(() => false, () => true);
      await wait(() => pictureThumbnails.stats().generation.pending);
      const last = pictureThumbnails.get(newest);
      assert(await obsolete, 'A newer selection must replace obsolete queued generation');
      await pictureRepository.save({ ...picture, updatedAt: 2 }); await pictureSaves.flush();
      HTMLCanvasElement.prototype.toBlob = toBlob; release!();
      assert(await stale, 'Superseded encoding must not publish'); await last;
    }
    finally { HTMLCanvasElement.prototype.toBlob = toBlob; release?.(); }
    for (const item of [warmed, queued, newest]) await pictureRepository.delete(item.id);

    const pending = drawing(`${id}-pending`, 3);
    pending.document.paletteVersion = 1; pending.document.customColors = Array(32).fill(null); pending.document.customColors[0] = 0x123456;
    pending.document.surfaces[0]!.vectorPaint = { version: 1, regions: [{ id: 1, base: -129, blobs: [] }] };
    let finish!: () => void; const gate = new Promise<void>(resolve => { finish = resolve; });
    const saving = pictureRepository.save(pending, async () => { await gate; return pending; });
    try {
      const preview = await pictureThumbnails.get(pending); assert(preview.thumbnail.updatedAt === 3, 'Pending checkpoint must preview before its disk write');
      const bitmap = await createImageBitmap(preview.thumbnail.blob), sample = document.createElement('canvas'); sample.width = sample.height = 1;
      try {
        const ctx = sample.getContext('2d')!; ctx.drawImage(bitmap, 0, 0, 1, 1);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        assert(pixel[0] === 0x12 && pixel[1] === 0x34 && pixel[2] === 0x56, 'Pending thumbnails must resolve drawing-owned custom palette slots');
      } finally { bitmap.close(); sample.width = sample.height = 1; }
    }
    finally { finish(); await saving; await pictureRepository.delete(pending.id); }
    const corrupt = drawing(`${id}-corrupt`), host = document.createElement('div');
    host.style.cssText = 'width:100px;height:100px'; document.body.append(host);
    const root = createRoot(host);
    try {
      await pictureRepository.save(corrupt);
      await createPictureThumbnailRepository().put({ ...cold.thumbnail, id: corrupt.id, blob: new Blob(['invalid PNG'], { type: 'image/png' }) });
      root.render(createElement(GalleryPreview, { picture: corrupt }));
      await wait(() => { const image = host.querySelector('img'); return image?.complete && image.naturalWidth > 0; });
      assert(host.querySelector('.saved-preview')?.getAttribute('aria-busy') === 'false', 'Corrupt preview must regenerate from the intact source');
    } finally { root.unmount(); host.remove(); await pictureRepository.delete(corrupt.id); }
    return { migrationRetry: true, atomicPages: true, independentStorage: true, coldMs, warmMs, warmSourceReads, boundedPng: true, boundedUrls: true, corruptRecovery: true, staleRejected: true, pendingPreview: true };
  } finally { IDBObjectStore.prototype.get = originalGet; pictureThumbnails.clear(); await pictureRepository.delete(id); }
}

/** Lightweight bulk fixture verifies metadata/preview access at realistic library counts. */
export async function profileThumbnailLibrary() {
  const db = createAppDatabase(), prefix = `library-scale-${crypto.randomUUID()}-`, metrics = [];
  try {
    for (const count of [1000, 5000]) {
      const start = performance.now();
      await db.transaction(['pictures', 'summaries'], 'readwrite', tx => {
        for (let i = count === 1000 ? 0 : 1000; i < count; i++) {
          const picture = drawing(prefix + i); picture.updatedAt = i + 1;
          tx.objectStore('pictures').put(picture); tx.objectStore('summaries').put(pictureSummary(picture));
        }
        return () => undefined;
      });
      const seedMs = performance.now() - start, listStart = performance.now(), records = await pictureRepository.list();
      metrics.push({ count, seedMs, listMs: performance.now() - listStart, summaryBytes: new Blob([JSON.stringify(records)]).size });
      assert(records.filter(record => record.id.startsWith(prefix)).length === count && records.every(record => !('document' in record)), 'Large libraries must list metadata without full documents');
    }
    return metrics;
  } finally {
    await db.transaction(['pictures', 'summaries', 'thumbnails'], 'readwrite', tx => {
      for (let i = 0; i < 5000; i++) for (const name of ['pictures', 'summaries', 'thumbnails']) tx.objectStore(name).delete(prefix + i);
      return () => undefined;
    });
  }
}
