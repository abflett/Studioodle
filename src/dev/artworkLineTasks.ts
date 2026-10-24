import progress from '../../docs/studioodle-artwork-review-2026-10-23.progress.json';
import lineProgress from '../../docs/studioodle-line-repairs-2026-10-24.progress.json';
import lineProgressV2 from '../../docs/studioodle-line-repairs-2026-10-24v2.progress.json';
import type { AssetReview } from './artworkReviewModel';

export const lineRepairTasks = progress.assets.filter(asset => asset.notes.trim() || asset.operations.some(operation => operation.status === 'deferred' && operation.kind === 'add-region'));
const linePasses = [...lineProgress.assets, ...lineProgressV2.assets];
// Keep the full inspection set, with the most recent counts for repeated repairs.
export const rebuiltLineTasks = [...new Map(linePasses.map(task => [task.assetId, task])).values()];
export function lineRepairIds(): Set<string> {
  return new Set(rebuiltLineTasks.map(task => task.assetId));
}
export interface CurrentReviewRevision {
  sha256: string; viewBox: number[]; regionAt: (x: number, y: number) => number;
}
export function hasRecordedRepair(base: AssetReview): boolean {
  return linePasses.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256) || progress.assets.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256 && !!task.afterSha256 && task.afterSha256 !== base.sha256);
}

/** Reconcile recorded revisions without replaying applied lines or losing subsequent annotations. */
export function refreshKnownRepair(base: AssetReview, revision: CurrentReviewRevision): AssetReview {
  if (base.sha256 === revision.sha256) return base;
  const task = progress.assets.find(task => task.assetId === base.assetId);
  let sha256 = base.sha256, lineWork = false;
  const completed = new Set<string>(), applied = new Set<string>();
  if (task?.afterSha256 && sha256 === task.beforeSha256) {
    sha256 = task.afterSha256;
    for (const operation of task.operations) if (operation.status === 'fixed') completed.add(operation.markerId);
  }
  for (const pass of linePasses) {
    if (sha256 === revision.sha256) break;
    if (pass.assetId !== base.assetId || pass.beforeSha256 !== sha256) continue;
    sha256 = pass.afterSha256; lineWork = true;
    for (const id of pass.appliedClosureIds) applied.add(id);
  }
  if (sha256 !== revision.sha256) return base;
  return { ...base, sha256, viewBox: [...revision.viewBox], reviewed: lineWork ? false : base.reviewed,
    markers: base.markers.filter(marker => !completed.has(marker.id)).map(marker => ({ ...marker, regionId: revision.regionAt(marker.x, marker.y) })),
    ...(lineWork && base.closures ? { closures: base.closures.filter(line => !applied.has(line.id)) } : {}),
  };
}
