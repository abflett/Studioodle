import type { ReviewAsset } from './artworkReviewModel';

const artworkUrls = import.meta.glob('../../../src/assets/vector/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export async function loadReviewArtwork(asset: ReviewAsset, signal: AbortSignal) {
  const response = await fetch(artworkUrls[`../../../src/assets/vector/${asset.id}.svg`]!, { signal });
  if (!response.ok) throw Error(`Unable to load artwork (${response.status}).`);
  const bytes = await response.arrayBuffer();
  const text = new TextDecoder().decode(bytes);
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw Error('Artwork SVG is invalid.');
  const viewBox = document.documentElement.getAttribute('viewBox')!.split(/[ ,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0 || !viewBox.every(Number.isFinite) || viewBox[2]! <= 0 || viewBox[3]! <= 0) throw Error('Unsupported artwork viewBox.');
  const regions = [...document.querySelectorAll('#regions > path')].map(element => {
    const d = element.getAttribute('d')!, transform = element.getAttribute('transform') ?? '';
    const path = new Path2D();
    path.addPath(new Path2D(d), transform ? new DOMMatrix(transform.replace(/^matrix\(|\)$/g, '').trim().split(/[ ,]+/).map(Number)) : undefined);
    return { id: Number(element.id.replace('region-', '')), d, transform, path };
  });
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  document.documentElement.setAttribute('width', String(viewBox[2]));
  document.documentElement.setAttribute('height', String(viewBox[3]));
  return { text, previewText: new XMLSerializer().serializeToString(document), viewBox, regions, sha256, width: viewBox[2]!, height: viewBox[3]! };
}
export type ReviewArtwork = Awaited<ReturnType<typeof loadReviewArtwork>>;
