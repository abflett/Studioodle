import type { SavedPicture } from '../../src/editor/savedPicture';
import type { PictureSummary } from '../../src/editor/pictureSummary';

type Snapshot = { id?: string; updatedAt?: number; picture?: SavedPicture; error: boolean };
type Load = (id: string, signal: AbortSignal) => Promise<SavedPicture | undefined>;

/** Pre-thumbnail baseline, retained only for the comparative library diagnostic. */
export class PictureWindow {
  private cache = new Map<string, SavedPicture>();
  private listeners = new Set<() => void>();
  private controller?: AbortController;
  private snapshot: Snapshot = { error: false };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  constructor(private readonly load: Load) {}
  private publish(snapshot: Snapshot) { this.snapshot = snapshot; for (const listener of this.listeners) listener(); }
  select(summaries: readonly PictureSummary[], index: number) {
    this.controller?.abort();
    const controller = new AbortController(); this.controller = controller;
    const ordered = [...new Set([0, 1, -1, 2, -2].map(offset => (index + offset + summaries.length) % summaries.length))]
      .map(i => summaries[i]).filter((summary): summary is PictureSummary => !!summary);
    const wanted = new Map(ordered.map(summary => [summary.id, summary.updatedAt]));
    for (const [id, picture] of this.cache) if (wanted.get(id) !== picture.updatedAt) this.cache.delete(id);
    const current = summaries[index];
    this.publish({ id: current?.id, updatedAt: current?.updatedAt, picture: current && this.cache.get(current.id), error: false });
    void (async () => {
      for (const summary of ordered) {
        if (controller.signal.aborted) return;
        if (this.cache.has(summary.id)) continue;
        try {
          const picture = await this.load(summary.id, controller.signal);
          if (controller.signal.aborted) return;
          if (!picture || picture.updatedAt !== summary.updatedAt) throw Error('Drawing changed; refresh the library.');
          this.cache.set(summary.id, picture);
          if (summary.id === current?.id) this.publish({ id: current.id, updatedAt: current.updatedAt, picture, error: false });
        } catch {
          if (controller.signal.aborted) return;
          if (summary.id === current?.id) this.publish({ id: current.id, updatedAt: current.updatedAt, error: true });
          // A failed neighbor must not prevent the remaining prefetches.
        }
      }
    })();
  }
  cached(summary: PictureSummary) {
    const picture = this.cache.get(summary.id);
    return picture?.updatedAt === summary.updatedAt ? picture : undefined;
  }
  invalidate(id: string) { this.cache.delete(id); }
  dispose() { this.controller?.abort(); this.cache.clear(); this.publish({ error: false }); }
}
