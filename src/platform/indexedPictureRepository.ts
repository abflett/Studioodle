import { createAppDatabase } from './appDatabase';
import type { SavedPicture } from '../editor/savedPicture';
import { isSavedPicture, isPictureSummary } from '../editor/pictureValidation';
import { formatPictureTitle } from '../editor/pictureTitles';
import { pictureSummary } from '../editor/pictureSummary';
import type { PictureSummary } from '../editor/pictureSummary';

/** Fresh region-library revision; metadata and artwork commit in one transaction. */
export function createIndexedPictureRepository(name = 'studioodle-library-v9') {
  const database = createAppDatabase(name);
  const transact = <T>(stores: string[], mode: IDBTransactionMode, operation: (tx: IDBTransaction) => IDBRequest<T>, signal?: AbortSignal) => database.request(stores, mode, operation, signal);
  return {
    async save(picture: SavedPicture) {
      if (!isSavedPicture(picture)) throw new Error('Invalid drawing; it was not saved.');
      await transact(['pictures', 'summaries'], 'readwrite', tx => {
        tx.objectStore('summaries').put(pictureSummary(picture));
        return tx.objectStore('pictures').put(picture);
      });
    },
    async delete(id: string) {
      await transact(['pictures', 'summaries', 'thumbnails'], 'readwrite', tx => {
        tx.objectStore('summaries').delete(id);
        tx.objectStore('thumbnails').delete(id);
        return tx.objectStore('pictures').delete(id);
      });
    },
    async list(): Promise<PictureSummary[]> {
      const records = await transact(['summaries'], 'readonly', tx => tx.objectStore('summaries').index('recent').getAll());
      return records.filter(isPictureSummary).map(pictureSummary).reverse();
    },
    async getSummary(id: string, signal?: AbortSignal): Promise<PictureSummary | undefined> {
      const record = await transact(['summaries'], 'readonly', tx => tx.objectStore('summaries').get(id), signal);
      return isPictureSummary(record) ? pictureSummary(record) : undefined;
    },
    async get(id: string, signal?: AbortSignal): Promise<SavedPicture | undefined> {
      const record: unknown = await transact(['pictures'], 'readonly', tx => tx.objectStore('pictures').get(id), signal);
      if (record === undefined) return;
      if (!isSavedPicture(record)) throw new Error('This drawing is invalid or unavailable.');
      return { ...record, title: formatPictureTitle(record.title) };
    },
  };
}
