import { createIndexedPictureRepository } from '../platform/indexedPictureRepository';
import { createPictureSaveQueue } from './pictureSaveQueue';
import { pictureSummary } from '../editor/pictureSummary';

// Fresh vector-only development format; old drawing data is intentionally unsupported.
export const storedPictures = createIndexedPictureRepository();
export const pictureSaves = createPictureSaveQueue(picture => storedPictures.save(picture));
export const pictureRepository = {
  save: pictureSaves.enqueue,
  async list() {
    const pending = pictureSaves.pending();
    const records = new Map((await storedPictures.list()).map(record => [record.id, record]));
    // A pending write can finish while summaries load. Keep its latest metadata
    // without making the library rebuild a preview on every commit.
    for (const picture of [...pending, ...pictureSaves.pending()]) {
      if ((records.get(picture.id)?.updatedAt ?? -Infinity) <= picture.updatedAt) records.set(picture.id, pictureSummary(picture));
    }
    return [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
  },
  async get(id: string, signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason;
    const pending = pictureSaves.latest(id);
    if (pending) return pending;
    const picture = await storedPictures.get(id, signal);
    return pictureSaves.latest(id) ?? picture;
  },
  async getSummary(id: string, signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason;
    const pending = pictureSaves.latest(id);
    if (pending) return pictureSummary(pending);
    const summary = await storedPictures.getSummary(id, signal);
    const latest = pictureSaves.latest(id);
    return latest ? pictureSummary(latest) : summary;
  },
  async delete(id: string) { await pictureSaves.discard(id); await storedPictures.delete(id); },
};
