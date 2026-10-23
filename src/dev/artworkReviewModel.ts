export type MarkerKind = 'remove-region' | 'add-region' | 'note';
export interface ReviewAsset { id: string; title: string; category: string; source: string; width: number; height: number }
export interface ReviewMarker {
  id: string; kind: MarkerKind; x: number; y: number; regionId: number; note: string; createdAt: string;
}
export interface AssetReview {
  assetId: string; source: string; vectorPath: string; viewBox: number[]; sha256: string;
  notes: string; reviewed: boolean; markers: ReviewMarker[];
}
export interface ArtworkReview {
  kind: 'studioodle-artwork-review'; version: 1; coordinateSpace: 'svg-viewBox';
  assets: AssetReview[];
}
export const reviewStorageKey = 'studioodle-artwork-review-v1';
export const emptyReview = (): ArtworkReview => ({ kind: 'studioodle-artwork-review', version: 1, coordinateSpace: 'svg-viewBox', assets: [] });
export const markerLabels: Record<MarkerKind, string> = { 'remove-region': 'Make transparent', 'add-region': 'Add fill region', note: 'Note' };

/** Reject malformed imports before they can replace any locally saved annotations. */
export function parseReview(text: string, assets: ReviewAsset[]): ArtworkReview {
  const input = JSON.parse(text) as ArtworkReview;
  if (!input || input.kind !== 'studioodle-artwork-review' || input.version !== 1 || input.coordinateSpace !== 'svg-viewBox' || !Array.isArray(input.assets)) throw Error('Not a supported Studioodle artwork review.');
  const catalog = new Map(assets.map(asset => [asset.id, asset]));
  const seen = new Set<string>();
  for (const entry of input.assets) {
    const asset = catalog.get(entry?.assetId);
    if (!asset || seen.has(entry.assetId)) throw Error('Review contains unknown or duplicate artwork.');
    seen.add(entry.assetId);
    if (entry.source !== asset.source || entry.vectorPath !== `src/assets/vector/${asset.id}.svg` || !Array.isArray(entry.viewBox) || entry.viewBox.length !== 4 || !entry.viewBox.every(Number.isFinite) || entry.viewBox[0] !== 0 || entry.viewBox[1] !== 0 || entry.viewBox[2]! <= 0 || entry.viewBox[3]! <= 0 || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.notes !== 'string' || typeof entry.reviewed !== 'boolean' || !Array.isArray(entry.markers)) throw Error(`Invalid artwork metadata: ${asset.id}`);
    const ids = new Set<string>();
    for (const marker of entry.markers) {
      if (!marker || typeof marker.id !== 'string' || !marker.id || ids.has(marker.id) || !Object.hasOwn(markerLabels, marker.kind) || !Number.isFinite(marker.x) || !Number.isFinite(marker.y) || marker.x < 0 || marker.y < 0 || marker.x > entry.viewBox[2]! || marker.y > entry.viewBox[3]! || !Number.isInteger(marker.regionId) || marker.regionId < 0 || marker.regionId > 65535 || typeof marker.note !== 'string' || typeof marker.createdAt !== 'string' || !Number.isFinite(Date.parse(marker.createdAt))) throw Error(`Invalid marker: ${asset.id}`);
      ids.add(marker.id);
    }
  }
  // Pick known fields; imported JSON is data, never markup or application settings.
  return { ...emptyReview(), assets: input.assets.map(entry => ({ assetId: entry.assetId, source: entry.source, vectorPath: entry.vectorPath, viewBox: [...entry.viewBox], sha256: entry.sha256, notes: entry.notes, reviewed: entry.reviewed, markers: entry.markers.map(marker => ({ id: marker.id, kind: marker.kind, x: marker.x, y: marker.y, regionId: marker.regionId, note: marker.note, createdAt: marker.createdAt })) })) };
}

export function mergeReviews(current: ArtworkReview, imported: ArtworkReview): ArtworkReview {
  const entries = new Map(current.assets.map(entry => [entry.assetId, entry]));
  for (const incoming of imported.assets) {
    const previous = entries.get(incoming.assetId);
    if (previous && previous.sha256 !== incoming.sha256) throw Error(`Different artwork revisions for ${incoming.assetId}. Export your local review before combining revisions.`);
    entries.set(incoming.assetId, previous ? { ...incoming,
      notes: [...new Set([previous.notes, incoming.notes].filter(Boolean))].join('\n\n'),
      reviewed: previous.reviewed || incoming.reviewed,
      markers: [...new Map([...previous.markers, ...incoming.markers].map(marker => [marker.id, marker])).values()],
    } : incoming);
  }
  return { ...emptyReview(), assets: [...entries.values()] };
}

export function artworkPoint(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, clientX: number, clientY: number, width: number, height: number) {
  return { x: Math.max(0, Math.min(width, (clientX - rect.left) / rect.width * width)), y: Math.max(0, Math.min(height, (clientY - rect.top) / rect.height * height)) };
}
