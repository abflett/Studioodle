export const appDatabaseName = 'studioodle-library-v9';
export function abortTransaction(tx: IDBTransaction) { try { tx.abort(); } catch { /* It may already be aborted/finished. */ } }

/** Shared schema; existing picture/document transactions remain atomic. */
export function createAppDatabase(name = appDatabaseName) {
  function transaction<T>(stores: string[], mode: IDBTransactionMode, operation: (tx: IDBTransaction) => () => T, signal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      let db: IDBDatabase | undefined, tx: IDBTransaction | undefined, done = false;
      const finish = (error?: unknown, result?: T) => {
        signal?.removeEventListener('abort', abort); db?.close();
        if (done) return; done = true;
        if (error) reject(error); else resolve(result!);
      };
      const abort = () => { try { tx?.abort(); } catch { /* Already finished. */ } finish(signal?.reason ?? new DOMException('Storage request cancelled', 'AbortError')); };
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      const opening = indexedDB.open(name, 2);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains('pictures')) db.createObjectStore('pictures', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('summaries')) db.createObjectStore('summaries', { keyPath: 'id' }).createIndex('recent', ['updatedAt', 'id']);
        for (const store of ['pages', 'thumbnails']) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      opening.onerror = () => finish(opening.error);
      opening.onblocked = () => finish(Error('Storage upgrade is blocked by another window. Close older Studioodle windows and retry.'));
      opening.onsuccess = () => {
        db = opening.result;
        if (done) { db.close(); return; }
        db.onversionchange = () => db?.close();
        try {
          tx = db.transaction(stores, mode);
          const result = operation(tx);
          tx.oncomplete = () => { try { finish(undefined, result()); } catch (error) { finish(error); } };
          tx.onabort = () => finish(tx?.error ?? Error('Storage transaction failed.'));
          tx.onerror = () => {};
        } catch (error) { try { tx?.abort(); } catch { /* Already finished. */ } finish(error); }
      };
    });
  }
  return { transaction, request<T>(stores: string[], mode: IDBTransactionMode, operation: (tx: IDBTransaction) => IDBRequest<T>, signal?: AbortSignal) {
    return transaction(stores, mode, tx => { const request = operation(tx); return () => request.result; }, signal);
  } };
}
