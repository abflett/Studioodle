import history from '../data/repair-history.json';
import type { AssetReview } from './artworkReviewModel';

const { initial: progress, lineV1: lineProgress, lineV2: lineProgressV2, lineV3: lineProgressV3, markerV3: markerProgressV3, lineV4: lineProgressV4, markerV4: markerProgressV4, lineV5: lineProgressV5, markerV5: markerProgressV5 } = history;

export const lineRepairTasks = progress.assets.filter(asset => asset.notes.trim() || asset.operations.some(operation => operation.status === 'deferred' && operation.kind === 'add-region'));
const markerPasses: RecordedRepair[] = [...markerProgressV3.assets, ...markerProgressV4.assets, ...markerProgressV5.assets];
const revisionPasses: RecordedRepair[] = [...lineProgress.assets, ...lineProgressV2.assets, ...lineProgressV3.assets, ...markerProgressV3.assets, ...lineProgressV4.assets, ...markerProgressV4.assets, ...lineProgressV5.assets, ...markerProgressV5.assets];
interface RepairMetadata { assetId: string; beforeSha256: string; afterSha256: string; beforeRegions: number; afterRegions: number; lines: number }
interface RecordedRepair extends RepairMetadata { appliedClosureIds: string[]; appliedMarkerIds: string[] }
// Metadata includes marker-only repairs; browse histories remain bounded to one pass.
const latestMetadata = new Map<string, RepairMetadata>();
for (const pass of revisionPasses) {
  const previous = latestMetadata.get(pass.assetId), hasLines = pass.appliedClosureIds.length > 0;
  latestMetadata.set(pass.assetId, { assetId: pass.assetId, beforeSha256: hasLines ? pass.beforeSha256 : previous?.beforeSha256 ?? pass.beforeSha256, afterSha256: pass.afterSha256, beforeRegions: hasLines ? pass.beforeRegions : previous?.beforeRegions ?? pass.beforeRegions, afterRegions: pass.afterRegions, lines: hasLines ? pass.lines : previous?.lines ?? 0 });
}
export const rebuiltLineTasks = [...latestMetadata.values()];
const changedIds = (entries: { assetId: string; beforeSha256: string; afterSha256: string }[]) => [...new Set(entries.filter(entry => entry.beforeSha256 !== entry.afterSha256).map(entry => entry.assetId))];
export const repairHistory = [
  { id: 'history-1', label: 'History 1', pass: 'v5', assetIds: changedIds([...lineProgressV5.assets, ...markerProgressV5.assets]) },
  { id: 'history-2', label: 'History 2', pass: 'v4', assetIds: changedIds([...lineProgressV4.assets, ...markerProgressV4.assets]) },
];
export interface CurrentReviewRevision {
  sha256: string; viewBox: number[]; regionAt: (x: number, y: number) => number;
}
export function hasRecordedRepair(base: AssetReview): boolean {
  return revisionPasses.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256 && (task.afterSha256 !== base.sha256 || ('appliedMarkerIds' in task && base.markers.some(marker => task.appliedMarkerIds.includes(marker.id))))) || progress.assets.some(task => task.assetId === base.assetId && task.beforeSha256 === base.sha256 && !!task.afterSha256 && task.afterSha256 !== base.sha256);
}

/** Reconcile recorded revisions without replaying applied lines or losing subsequent annotations. */
export function refreshKnownRepair(base: AssetReview, revision: CurrentReviewRevision): AssetReview {
  const settled = new Set(markerPasses.filter(task => task.assetId === base.assetId && task.beforeSha256 === revision.sha256 && task.afterSha256 === revision.sha256).flatMap(task => task.appliedMarkerIds));
  if (base.sha256 === revision.sha256) {
    if (!base.markers.some(marker => settled.has(marker.id))) return base;
    return { ...base, markers: base.markers.filter(marker => !settled.has(marker.id)) };
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
  for (const id of settled) completed.add(id);
  return { ...base, sha256, viewBox: [...revision.viewBox], reviewed: lineWork ? false : base.reviewed,
    markers: base.markers.filter(marker => !completed.has(marker.id)).map(marker => ({ ...marker, regionId: revision.regionAt(marker.x, marker.y) })),
    ...(lineWork && base.closures ? { closures: base.closures.filter(line => !applied.has(line.id)) } : {}),
  };
}
