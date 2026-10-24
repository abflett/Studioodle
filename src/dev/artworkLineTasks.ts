import progress from '../../docs/studioodle-artwork-review-2026-10-23.progress.json';
import lineProgress from '../../docs/studioodle-line-repairs-2026-10-24.progress.json';
import type { AssetReview } from './artworkReviewModel';

export const lineRepairTasks = progress.assets.filter(asset => asset.notes.trim() || asset.operations.some(operation => operation.status === 'deferred' && operation.kind === 'add-region'));
export const rebuiltLineTasks = lineProgress.assets;
export function lineRepairIds(): Set<string> {
  return new Set(rebuiltLineTasks.map(task => task.assetId));
}
export interface CurrentReviewRevision {
  sha256: string; viewBox: number[]; regionAt: (x: number, y: number) => number;
}
export function hasRecordedRepair(base: AssetReview): boolean {
  return rebuiltLineTasks.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256) || progress.assets.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256 && !!task.afterSha256 && task.afterSha256 !== base.sha256);
}

/** Reconcile recorded revisions without replaying applied lines or losing subsequent annotations. */
export function refreshKnownRepair(base: AssetReview, revision: CurrentReviewRevision): AssetReview {
  if (base.sha256 === revision.sha256) return base;
  const task = progress.assets.find(task => task.assetId === base.assetId);
  const rebuilt = rebuiltLineTasks.find(task => task.assetId === base.assetId && task.afterSha256 === revision.sha256);
  if (rebuilt && (base.sha256 === rebuilt.beforeSha256 || (base.sha256 === task?.beforeSha256 && task.afterSha256 === rebuilt.beforeSha256))) {
    const completed = new Set(task?.operations.filter(operation => operation.status === 'fixed').map(operation => operation.markerId));
    const applied = new Set(rebuilt.appliedClosureIds);
    return { ...base, sha256: revision.sha256, viewBox: [...revision.viewBox], reviewed: false,
      markers: base.markers.filter(marker => !completed.has(marker.id)).map(marker => ({ ...marker, regionId: revision.regionAt(marker.x, marker.y) })),
      closures: base.closures?.filter(line => !applied.has(line.id)),
    };
  }
  if (!task || base.sha256 !== task.beforeSha256 || revision.sha256 !== task.afterSha256) return base;
  const completed = new Set(task.operations.filter(operation => operation.status === 'fixed').map(operation => operation.markerId));
  return { ...base, sha256: revision.sha256, viewBox: [...revision.viewBox], markers: base.markers.filter(marker => !completed.has(marker.id)).map(marker => ({ ...marker, regionId: revision.regionAt(marker.x, marker.y) })) };
}
