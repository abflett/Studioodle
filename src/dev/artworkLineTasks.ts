import progress from '../../docs/studioodle-artwork-review-2026-10-23.progress.json';
import type { ArtworkReview, AssetReview } from './artworkReviewModel';

export const lineRepairTasks = progress.assets.filter(asset => asset.notes.trim() || asset.operations.some(operation => operation.status === 'deferred' && operation.kind === 'add-region'));
export function lineRepairIds(review: ArtworkReview): Set<string> {
  return new Set([...lineRepairTasks.map(task => task.assetId), ...review.assets.filter(asset => asset.markers.some(marker => marker.kind === 'add-region') || asset.closures?.length).map(asset => asset.assetId)]);
}
export interface CurrentReviewRevision {
  sha256: string; viewBox: number[]; regionAt: (x: number, y: number) => number;
}
export function hasRecordedRepair(base: AssetReview): boolean {
  return progress.assets.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256 && !!task.afterSha256 && task.afterSha256 !== base.sha256);
}

/** Recorded first-pass repairs preserved ink and coordinates; refresh only their region references. */
export function refreshKnownRepair(base: AssetReview, revision: CurrentReviewRevision): AssetReview {
  const task = progress.assets.find(task => task.assetId === base.assetId);
  if (!task || base.sha256 === revision.sha256 || base.sha256 !== task.beforeSha256 || revision.sha256 !== task.afterSha256) return base;
  const completed = new Set(task.operations.filter(operation => operation.status === 'fixed').map(operation => operation.markerId));
  return { ...base, sha256: revision.sha256, viewBox: [...revision.viewBox], markers: base.markers.filter(marker => !completed.has(marker.id)).map(marker => ({ ...marker, regionId: revision.regionAt(marker.x, marker.y) })) };
}
