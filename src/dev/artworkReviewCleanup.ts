import type { ArtworkReview, AssetReview } from './artworkReviewModel';

export type CleanupTarget = 'reviewed' | 'markers' | 'notes' | 'lines' | 'refinements';
type Fields = Pick<AssetReview, 'reviewed' | 'markers' | 'notes' | 'closures'>;
export interface CleanupPatch { assetId: string; fields: Partial<Fields> }
export const cleanupOptions: { value: CleanupTarget; label: string }[] = [
  { value: 'reviewed', label: 'Reviewed status' }, { value: 'markers', label: 'Markers' },
  { value: 'notes', label: 'Notes' }, { value: 'lines', label: 'Proposed lines' },
  { value: 'refinements', label: 'Everything - fresh review' },
];
export function matchesReviewFilter(entry: AssetReview | undefined, filter: string): boolean {
  switch (filter) {
    case 'all': return true;
    case 'unreviewed': return !entry?.reviewed;
    case 'reviewed': return !!entry?.reviewed;
    case 'markers': return !!entry?.markers.length;
    case 'lines': return !!entry?.closures?.length;
    case 'notes': return !!(entry?.notes || entry?.markers.some(m => m.note) || entry?.closures?.some(l => l.note));
    case 'refinements': return !!(entry?.reviewed || matchesReviewFilter(entry, 'markers') || matchesReviewFilter(entry, 'lines') || matchesReviewFilter(entry, 'notes'));
    default: return false;
  }
}
/** Retain only changed fields for immediate undo; artwork metadata never changes. */
export function clearReview(review: ArtworkReview, target: CleanupTarget): { review: ArtworkReview; removed: CleanupPatch[] } {
  const removed: CleanupPatch[] = [];
  const assets = review.assets.map(entry => {
    const fields: Partial<Fields> = {}, next = { ...entry }, all = target === 'refinements';
    if ((all || target === 'reviewed') && entry.reviewed) { fields.reviewed = entry.reviewed; next.reviewed = false; }
    if ((all || target === 'markers') && entry.markers.length) { fields.markers = entry.markers; next.markers = []; }
    if ((all || target === 'lines') && entry.closures?.length) { fields.closures = entry.closures; next.closures = []; }
    if (all || target === 'notes') {
      if (entry.notes) { fields.notes = entry.notes; next.notes = ''; }
      if (!all && entry.markers.some(m => m.note)) { fields.markers = entry.markers; next.markers = entry.markers.map(m => ({ ...m, note: '' })); }
      if (!all && entry.closures?.some(l => l.note)) { fields.closures = entry.closures; next.closures = entry.closures.map(l => ({ ...l, note: '' })); }
    }
    if (!Object.keys(fields).length) return entry;
    removed.push({ assetId: entry.assetId, fields }); return next;
  });
  return { review: { ...review, assets }, removed };
}
export function restoreReviewCleanup(review: ArtworkReview, removed: CleanupPatch[]): ArtworkReview {
  const patches = new Map(removed.map(patch => [patch.assetId, patch.fields]));
  return { ...review, assets: review.assets.map(entry => patches.has(entry.assetId) ? { ...entry, ...patches.get(entry.assetId) } : entry) };
}
