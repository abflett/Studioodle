import type { SavedPicture } from '../editor/savedPicture';
import { isSavedPicture, isPictureSummary } from '../editor/pictureValidation';
import { formatPictureTitle } from '../editor/pictureTitles';
import { pictureSummary } from '../editor/pictureSummary';
import type { PictureSummary } from '../editor/pictureSummary';

/** Fresh region-library revision; metadata and artwork commit in one transaction. */
export function createIndexedPictureRepository(name = 'studioodle-library-v2') {
  const transact = <T>(mode: IDBTransactionMode, operation: (tx: IDBTransaction) => IDBRequest<T>, signal?: AbortSignal) => new Promise<T>((resolve, reject) => {
    let db: IDBDatabase | undefined, tx: IDBTransaction | undefined, done = false;
    const finish = (error?: unknown, result?: T) => {
      signal?.removeEventListener('abort', abort);
      db?.close();
      if (done) return;
      done = true;
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => {
      try { tx?.abort(); } catch { /* The transaction may already have completed. */ }
      finish(signal?.reason ?? new DOMException('Picture loading cancelled', 'AbortError'));
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    const opening = indexedDB.open(name, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore('pictures', { keyPath: 'id' });
      opening.result.createObjectStore('summaries', { keyPath: 'id' }).createIndex('recent', ['updatedAt', 'id']);
    };
    opening.onerror = () => finish(opening.error);
    opening.onblocked = () => finish(new Error('Picture database upgrade is blocked by another window.'));
    opening.onsuccess = () => {
      db = opening.result;
      if (done) { db.close(); return; }
      db.onversionchange = () => db?.close();
      try {
        tx = db.transaction(['pictures', 'summaries'], mode);
        const request = operation(tx);
        tx.oncomplete = () => finish(undefined, request.result);
        tx.onabort = () => finish(tx?.error ?? request.error ?? new Error('Picture storage transaction failed.'));
        tx.onerror = () => {}; // Abort reports a failed transaction once.
      } catch (error) { try { tx?.abort(); } catch { /* Already inactive. */ } finish(error); }
    };
  });
  return {
    async save(picture: SavedPicture) {
      if (!isSavedPicture(picture)) throw new Error('Invalid drawing; it was not saved.');
      await transact('readwrite', tx => {
        tx.objectStore('summaries').put(pictureSummary(picture));
        return tx.objectStore('pictures').put(picture);
      });
    },
    async delete(id: string) {
      await transact('readwrite', tx => {
        tx.objectStore('summaries').delete(id);
        return tx.objectStore('pictures').delete(id);
      });
    },
    async list(): Promise<PictureSummary[]> {
      const records = await transact('readonly', tx => tx.objectStore('summaries').index('recent').getAll());
      return records.filter(isPictureSummary).map(pictureSummary).reverse();
    },
    async get(id: string, signal?: AbortSignal): Promise<SavedPicture | undefined> {
      const record: unknown = await transact('readonly', tx => tx.objectStore('pictures').get(id), signal);
      if (record === undefined) return;
      if (!isSavedPicture(record)) throw new Error('This drawing is invalid or unavailable.');
      return { ...record, title: formatPictureTitle(record.title) };
    },
  };
}
