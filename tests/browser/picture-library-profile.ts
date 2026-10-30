// Historical full-document-window baseline; current gallery uses persisted PNGs.
import { PictureWindow } from '../fixtures/pictureWindow';
import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import { createAdvancedSceneFixture } from './advanced-scene-fixture';
import type { SavedPicture } from '../../src/editor/savedPicture';
import type { PictureSummary } from '../../src/editor/pictureSummary';

const name = 'studioodle-library-profile';
const repository = createIndexedPictureRepository(name);
const reads: string[] = [], references: WeakRef<SavedPicture>[] = [];
let summaries: PictureSummary[] = [], window: PictureWindow | undefined;
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
function cache() { return Reflect.get(window!, 'cache') as Map<string, SavedPicture>; }

export async function prepareLibraryProfile() {
  const { picture, metrics } = await createAdvancedSceneFixture();
  const start = performance.now();
  for (let i = 0; i < 120; i++) await repository.save({ ...picture,
    id: `library-${String(i).padStart(3, '0')}`, title: `Drawing ${i}`, updatedAt: 120 - i });
  const seedMs = performance.now() - start;
  // Catch accidental full-document scans, including paths not using our loader.
  const original = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function (...args) {
    assert(this.name !== 'pictures', 'The library scanned every full drawing');
    return original.apply(this, args);
  };
  const listStart = performance.now();
  try { summaries = await repository.list(); } finally { IDBObjectStore.prototype.getAll = original; }
  const listMs = performance.now() - listStart;
  assert(summaries.length === 120 && summaries[0]!.id === 'library-000', 'Library ordering failed');
  assert(summaries.every(summary => !('document' in summary)), 'Summary retained artwork');
  window = new PictureWindow(async (id, signal) => {
    reads.push(id);
    const loaded = await repository.get(id, signal);
    if (loaded) references.push(new WeakRef(loaded));
    return loaded;
  });
  return { drawings: summaries.length, fixture: metrics, seedMs, listMs,
    summariesJsonBytes: new Blob([JSON.stringify(summaries)]).size };
}

export async function selectLibraryPicture(index: number) {
  const start = performance.now(), firstRead = reads.length;
  let currentMs: number | undefined;
  const unsubscribe = window!.subscribe(() => {
    if (window!.getSnapshot().picture?.id === summaries[index]!.id) currentMs ??= performance.now() - start;
  });
  try {
    window!.select(summaries, index);
    for (let i = 0; i < 3000; i++) {
      if (window!.getSnapshot().error) throw Error('Selected drawing failed to load');
      if (cache().size === 5) break;
      await pause();
    }
    assert(currentMs !== undefined && cache().size === 5, 'Five-picture window did not settle');
    const expected = [0, 1, -1, 2, -2].map(offset => summaries[(index + offset + 120) % 120]!.id);
    assert([...cache().keys()].every(id => expected.includes(id)), 'Unrelated drawing retained in cache');
    const loaded = reads.slice(firstRead);
    assert(loaded.every((id, i) => expected.filter(id => loaded.includes(id))[i] === id), 'Prefetch priority changed');
    return { index, currentMs, windowMs: performance.now() - start, reads: loaded,
      cachedDrawings: cache().size, cachedJsonBytes: new Blob([JSON.stringify([...cache().values()])]).size };
  } finally { unsubscribe(); }
}

export function libraryRetained() {
  return { loadedRecords: references.length, liveLoadedRecords: references.filter(ref => !!ref.deref()).length,
    cachedDrawings: window ? cache().size : 0 };
}
export function disposeLibraryProfile() { window?.dispose(); window = undefined; summaries = []; }
export async function cleanupLibraryProfile() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}
