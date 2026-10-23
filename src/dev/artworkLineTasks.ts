import progress from '../../docs/studioodle-artwork-review-2026-10-23.progress.json';
import original from '../../docs/studioodle-artwork-review-2026-10-23.json';
import type { ArtworkReview, AssetReview } from './artworkReviewModel';

export const lineRepairTasks = progress.assets.filter(asset => asset.notes.trim() || asset.operations.some(operation => operation.status === 'deferred' && operation.kind === 'add-region'));
const archived = new Map((original.assets as AssetReview[]).map(asset => [asset.assetId, asset]));
export function lineRepairIds(review: ArtworkReview): Set<string> {
  return new Set([...lineRepairTasks.map(task => task.assetId), ...review.assets.filter(asset => asset.markers.some(marker => marker.kind === 'add-region') || asset.closures?.length).map(asset => asset.assetId)]);
}
export interface CurrentReviewRevision {
  sha256: string; viewBox: number[]; regionAt: (x: number, y: number) => number;
}
/** Explicit authoring action: reopen the line queue, including known cutout-only revisions. */
export function reopenLineRepairs(review: ArtworkReview, ids: Set<string>, revisions: Map<string, CurrentReviewRevision>): ArtworkReview {
  const entries = new Map(review.assets.map(asset => [asset.assetId, asset]));
  for (const id of ids) {
    const revision = revisions.get(id), base = entries.get(id) ?? archived.get(id);
    if (!base || !revision) throw Error(`Cannot reopen ${id}: missing review or current artwork.`);
    const task = progress.assets.find(task => task.assetId === id);
    const changed = base.sha256 !== revision.sha256;
    if (changed && !(task && base.sha256 === task.beforeSha256 && revision.sha256 === task.afterSha256)) throw Error(`Artwork revision for ${id} is not a recorded cutout-only repair. Reconcile that asset before reopening it.`);
    const completed = new Set(task?.operations.filter(operation => operation.status === 'fixed').map(operation => operation.markerId));
    entries.set(id, { ...base, sha256: revision.sha256, viewBox: [...revision.viewBox], reviewed: false,
      markers: base.markers.filter(marker => !completed.has(marker.id)).map(marker => changed ? { ...marker, regionId: revision.regionAt(marker.x, marker.y) } : marker),
    });
  }
  return { ...review, assets: [...entries.values()] };
}
