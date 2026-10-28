import type { SavedPicture } from '../editor/savedPicture';

export type PreparePicture = () => Promise<SavedPicture>;
type Request = { picture: SavedPicture; prepare?: PreparePicture; done: ((ok: boolean) => void)[] };
type Entry = { latest: Request; pending?: Request; running?: Promise<void>; failed: boolean; canceled: boolean; retry?: ReturnType<typeof setTimeout>; attempts: number };

/** One active write and one latest pending checkpoint per drawing, beyond canvas lifetime. */
export function createPictureSaveQueue(write: (picture: SavedPicture) => Promise<void>) {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  const pictureListeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const start = (id: string, entry: Entry) => {
    if (entry.running || entry.canceled || !entry.pending) return;
    if (entry.retry) clearTimeout(entry.retry);
    entry.retry = undefined;
    const request = entry.pending; entry.pending = undefined;
    // Yield the action's input/render task before snapshot preparation and IDB cloning.
    entry.running = new Promise<void>(resolve => setTimeout(resolve, 0)).then(async () => {
      if (entry.canceled) return;
      const picture = request.prepare ? await request.prepare() : request.picture;
      if (entry.canceled) return;
      await write(picture);
      entry.failed = false; entry.attempts = 0;
      for (const done of request.done) done(true);
      request.done = [];
    }).catch(() => {
      entry.failed = true;
      for (const done of request.done) done(false);
      request.done = [];
      // Newer edits supersede the failed checkpoint; never roll them back.
      entry.pending ??= { ...request, done: [] };
    }).finally(() => {
      entry.running = undefined;
      if (entry.canceled) { for (const done of request.done) done(false); return; }
      if (entry.failed) {
        entry.retry = setTimeout(() => { entry.retry = undefined; start(id, entry); }, Math.min(30_000, 1000 * 2 ** Math.min(entry.attempts++, 5)));
      } else if (entry.pending) start(id, entry);
      else if (entries.get(id) === entry) entries.delete(id);
      notify();
    });
  };
  return {
    enqueue(picture: SavedPicture, prepare?: PreparePicture): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        const request: Request = { picture, prepare, done: [ok => ok ? resolve() : reject(Error('Drawing could not be saved.'))] };
        let entry = entries.get(picture.id);
        if (!entry) { entry = { latest: request, pending: request, failed: false, canceled: false, attempts: 0 }; entries.set(picture.id, entry); }
        else {
          // Resolve superseded requests only when the newer checkpoint commits.
          request.done.unshift(...(entry.pending?.done ?? []));
          entry.latest = request; entry.pending = request;
        }
        start(picture.id, entry); notify();
        for (const listener of pictureListeners) listener();
      });
    },
    latest(id: string) { return entries.get(id)?.latest.picture; },
    pending() { return [...entries.values()].map(entry => entry.latest.picture); },
    hasErrors() { return [...entries.values()].some(entry => entry.failed); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    subscribePictures(listener: () => void) { pictureListeners.add(listener); return () => { pictureListeners.delete(listener); }; },
    retry() { for (const [id, entry] of entries) start(id, entry); },
    async flush() {
      for (const [id, entry] of entries) start(id, entry);
      while ([...entries.values()].some(entry => entry.running)) await Promise.all([...entries.values()].map(entry => entry.running));
      return !entries.size;
    },
    async discard(id: string) {
      const entry = entries.get(id);
      if (!entry) return;
      entries.delete(id); entry.canceled = true;
      if (entry.retry) clearTimeout(entry.retry);
      for (const done of entry.pending?.done ?? []) done(false);
      await entry.running;
      notify();
    },
  };
}
