import progress from '../../docs/studioodle-artwork-review-2026-10-23.progress.json';
import lineProgress from '../../docs/studioodle-line-repairs-2026-10-24.progress.json';
import lineProgressV2 from '../../docs/studioodle-line-repairs-2026-10-24v2.progress.json';
import lineProgressV3 from '../../docs/studioodle-line-repairs-2026-10-24v3.progress.json';
import markerProgressV3 from '../../docs/studioodle-marker-repairs-2026-10-24v3.progress.json';
import type { AssetReview } from './artworkReviewModel';

export const lineRepairTasks = progress.assets.filter(asset => asset.notes.trim() || asset.operations.some(operation => operation.status === 'deferred' && operation.kind === 'add-region'));
const linePasses = [...lineProgress.assets, ...lineProgressV2.assets, ...lineProgressV3.assets];
const revisionPasses = [...linePasses, ...markerProgressV3.assets];
// Keep the full inspection set, with the most recent counts for repeated repairs.
export const rebuiltLineTasks = [...new Map(linePasses.map(task => [task.assetId, task])).values()].map(task => {
  const markers = markerProgressV3.assets.find(entry => entry.assetId === task.assetId);
  return markers ? { ...task, afterSha256: markers.afterSha256, afterRegions: markers.afterRegions } : task;
});
export function lineRepairIds(): Set<string> {
  return new Set(rebuiltLineTasks.map(task => task.assetId));
}
export interface CurrentReviewRevision {
  sha256: string; viewBox: number[]; regionAt: (x: number, y: number) => number;
}
export function hasRecordedRepair(base: AssetReview): boolean {
  return revisionPasses.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256 && (task.afterSha256 !== base.sha256 || ('appliedMarkerIds' in task && base.markers.some(marker => task.appliedMarkerIds.includes(marker.id))))) || progress.assets.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256 && !!task.afterSha256 && task.afterSha256 !== base.sha256);
}

/** Reconcile recorded revisions without replaying applied lines or losing subsequent annotations. */
export function refreshKnownRepair(base: AssetReview, revision: CurrentReviewRevision): AssetReview {
  const settled = markerProgressV3.assets.find(task => task.assetId === base.assetId && task.beforeSha256 === revision.sha256 && task.afterSha256 === revision.sha256);
  if (base.sha256 === revision.sha256) {
    if (!settled || !base.markers.some(marker => settled.appliedMarkerIds.includes(marker.id))) return base;
    return { ...base, markers: base.markers.filter(marker => !settled.appliedMarkerIds.includes(marker.id)) };
  }
  const task = progress.assets.find(task => task.assetId === base.assetId);
  let sha256 = base.sha256, lineWork = false;
  const completed = new Set<string>(), applied = new Set<string>();
  if (task?.afterSha256 && sha256 === task.beforeSha256) {
    sha256 = task.afterSha256;
    for (const operation of task.operations) if (operation.status === 'fixed') completed.add(operation.markerId);
  }
  for (const pass of revisionPasses) {
    if (sha256 === revision.sha256) break;
    if (pass.assetId !== base.assetId || pass.beforeSha256 !== sha256) continue;
    sha256 = pass.afterSha256; lineWork = true;
    for (const id of pass.appliedClosureIds) applied.add(id);
    if ('appliedMarkerIds' in pass) for (const id of pass.appliedMarkerIds) completed.add(id);
  }
  if (sha256 !== revision.sha256) return base;
  for (const id of settled?.appliedMarkerIds ?? []) completed.add(id);
  return { ...base, sha256, viewBox: [...revision.viewBox], reviewed: lineWork ? false : base.reviewed,
    markers: base.markers.filter(marker => !completed.has(marker.id)).map(marker => ({ ...marker, regionId: revision.regionAt(marker.x, marker.y) })),
    ...(lineWork && base.closures ? { closures: base.closures.filter(line => !applied.has(line.id)) } : {}),
  };
}
