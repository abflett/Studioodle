import { Artwork } from '../editor/Artwork';
import { paperSize } from '../editor/document';
import { prepareStickers } from '../editor/vectorStickers';
import { pictureSummary } from '../editor/pictureSummary';
import type { PictureSummary } from '../editor/pictureSummary';
import type { SavedPicture } from '../editor/savedPicture';
import { createPictureThumbnailRepository, thumbnailVersion } from '../platform/pictureThumbnails';
import type { PictureThumbnail } from '../platform/pictureThumbnails';
import { pictureRepository, pictureSaves } from './pictures';
import { createThumbnailQueue } from './thumbnailQueue';

const stored = createPictureThumbnailRepository();
type Entry = { thumbnail: PictureThumbnail; url: string; persisted: boolean };
const cache = new Map<string, Entry>();
const generation = createThumbnailQueue<{ thumbnail: PictureThumbnail; persisted: boolean }>();
const jobs = new Map<string, Promise<Entry>>();
const keyFor = (picture: PictureSummary) => `${picture.id}:${picture.updatedAt}:${thumbnailVersion}`;
const check = (signal?: AbortSignal) => { if (signal?.aborted) throw signal.reason ?? new DOMException('Preview cancelled', 'AbortError'); };

export async function renderThumbnail(picture: SavedPicture, signal?: AbortSignal): Promise<PictureThumbnail> {
  check(signal);
  await prepareStickers(picture.document.surfaces.map(surface => surface.kind)); check(signal);
  const size = paperSize(picture.format, picture.size), ratio = 768 / Math.max(size.width, size.height);
  const width = Math.max(1, Math.round(size.width * ratio)), height = Math.max(1, Math.round(size.height * ratio));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  let artwork: Artwork | undefined;
  try {
    artwork = Artwork.restore(picture.document);
    const ctx = canvas.getContext('2d')!; ctx.setTransform(width / size.width, 0, 0, height / size.height, 0, 0);
    artwork.render(ctx, true); check(signal);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Preview encoding failed.')), 'image/png'));
    check(signal);
    const summary = pictureSummary(picture);
    return { id: picture.id, updatedAt: picture.updatedAt, version: thumbnailVersion, width, height, blob, pageLayout: summary.pageLayout, stickerCount: summary.stickerCount };
  } finally { artwork?.dispose(); canvas.width = canvas.height = 1; }
}

/** Only the selected preview can generate; queueing is serial and obsolete work cancels. */
export const pictureThumbnails = {
  stats() { return { cached: cache.size, blobBytes: [...cache.values()].reduce((sum, entry) => sum + entry.thumbnail.blob.size, 0), queued: jobs.size, generation: generation.stats() }; },
  peek(summary: PictureSummary) { return cache.get(keyFor(summary)); },
  async get(summary: PictureSummary, signal?: AbortSignal): Promise<Entry> {
    check(signal);
    const key = keyFor(summary), cached = cache.get(key);
    if (cached) {
      cache.delete(key); cache.set(key, cached);
      if (!cached.persisted) void stored.put(cached.thumbnail).then(ok => { cached.persisted = ok; }).catch(() => {});
      return cached;
    }
    const previous = jobs.get(key);
    if (previous) { try { const entry = await previous; check(signal); return entry; } catch { check(signal); } }
    const job = (async () => {
      check(signal);
      let thumbnail: PictureThumbnail | undefined;
      try { thumbnail = await stored.get(summary, signal); } catch { check(signal); }
      let persisted = !!thumbnail;
      if (!thumbnail) {
        const generated = await generation.run(async () => {
          check(signal);
          const picture = await pictureRepository.get(summary.id, signal); check(signal);
          if (!picture || picture.updatedAt !== summary.updatedAt) throw Error('Drawing changed while loading its preview.');
          const thumbnail = await renderThumbnail(picture, signal); check(signal);
          const latest = pictureSaves.latest(summary.id);
          if (latest && latest.updatedAt !== summary.updatedAt) throw Error('Preview superseded by a newer edit.');
          let persisted = false;
          try { persisted = await stored.put(thumbnail); } catch { /* Cache failure must not hide artwork. */ }
          return { thumbnail, persisted };
        }, signal);
        thumbnail = generated.thumbnail; persisted = generated.persisted;
      }
      check(signal);
      const current = await pictureRepository.getSummary(summary.id, signal); check(signal);
      if (!current || current.updatedAt !== summary.updatedAt) throw Error('Preview was superseded or deleted.');
      const entry = { thumbnail, url: URL.createObjectURL(thumbnail.blob), persisted };
      cache.set(key, entry);
      while (cache.size > 5) { const oldest = cache.keys().next().value!; URL.revokeObjectURL(cache.get(oldest)!.url); cache.delete(oldest); }
      return entry;
    })();
    jobs.set(key, job);
    try { return await job; } finally { if (jobs.get(key) === job) jobs.delete(key); }
  },
  invalidate(id: string, updatedAt?: number) {
    for (const [key, entry] of cache) if (entry.thumbnail.id === id && (updatedAt === undefined || entry.thumbnail.updatedAt === updatedAt)) { URL.revokeObjectURL(entry.url); cache.delete(key); }
  },
  clear() { for (const entry of cache.values()) URL.revokeObjectURL(entry.url); cache.clear(); },
};
