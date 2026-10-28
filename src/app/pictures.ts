import { createIndexedPictureRepository } from '../platform/indexedPictureRepository';
import { createLocalTemplateRepository } from '../platform/localTemplateRepository';
import { createPictureSaveQueue } from './pictureSaveQueue';
import { pictureSummary } from '../editor/pictureSummary';

// Fresh vector-only development format; old drawing data is intentionally unsupported.
const storedPictures = createIndexedPictureRepository();
export const pictureSaves = createPictureSaveQueue(picture => storedPictures.save(picture));
export const pictureRepository = {
  save: pictureSaves.enqueue,
  async list() {
    const records = new Map((await storedPictures.list()).map(record => [record.id, record]));
    for (const picture of pictureSaves.pending()) records.set(picture.id, pictureSummary(picture));
    return [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
  },
  async get(id: string, signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason;
    const pending = pictureSaves.latest(id);
    if (pending) return pending;
    const picture = await storedPictures.get(id, signal);
    return pictureSaves.latest(id) ?? picture;
  },
  async delete(id: string) { await pictureSaves.discard(id); await storedPictures.delete(id); },
};
// Read-only input for consolidating existing current-format templates. New writes
// belong to workshopRepository, which owns atomic collection operations.
export const coloringPageRepository = createLocalTemplateRepository();
