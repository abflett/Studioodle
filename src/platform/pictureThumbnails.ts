import { createAppDatabase, abortTransaction } from './appDatabase';
import type { PictureSummary } from '../editor/pictureSummary';

export const thumbnailVersion = 1;
export type PictureThumbnail = { id: string; updatedAt: number; version: number; blob: Blob; width: number; height: number; pageLayout?: string; stickerCount?: number };
export function createPictureThumbnailRepository(name?: string) {
  const db = createAppDatabase(name);
  return {
    async get(summary: PictureSummary, signal?: AbortSignal): Promise<PictureThumbnail | undefined> {
      const record = await db.request(['thumbnails'], 'readonly', tx => tx.objectStore('thumbnails').get(summary.id), signal) as PictureThumbnail | undefined;
      if (record?.updatedAt === summary.updatedAt && record.version === thumbnailVersion && record.blob instanceof Blob && record.blob.type === 'image/png' && record.blob.size > 0 && record.blob.size <= 3 * 1024 * 1024 && record.width > 0 && record.width <= 768 && record.height > 0 && record.height <= 768) return record;
    },
    async put(record: PictureThumbnail): Promise<boolean> {
      return db.transaction(['thumbnails', 'summaries'], 'readwrite', tx => {
        let accepted = false;
        const request = tx.objectStore('summaries').get(record.id);
        request.onsuccess = () => {
          if (request.result?.updatedAt !== record.updatedAt) return;
          try { tx.objectStore('thumbnails').put(record); accepted = true; } catch { abortTransaction(tx); }
        };
        return () => accepted;
      });
    },
    async delete(id: string, updatedAt?: number) {
      await db.transaction(['thumbnails'], 'readwrite', tx => {
        const store = tx.objectStore('thumbnails'), record = store.get(id);
        record.onsuccess = () => { if (updatedAt === undefined || record.result?.updatedAt === updatedAt) store.delete(id); };
        return () => undefined;
      });
    },
  };
}
