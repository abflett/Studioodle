import source from '../assets/assetLibrary.json';
import type { EditorSetup } from '../editor/setup';
import type { ColoringPageInfo, PageCategory } from '../editor/coloringPageInfo';

const subjects = new Map(source.map(asset => [asset.id, asset.category]));
/** Lightweight defaults for user-made pages; shipped pages have curated metadata. */
export function pageInfo(page: EditorSetup): ColoringPageInfo {
  if (page.browse) return page.browse;
  const categories = new Set<PageCategory>();
  const surfaces = page.document?.surfaces.filter(s => s.kind !== 'canvas') ?? [];
  for (const surface of surfaces) {
    const subject = subjects.get(surface.kind);
    if (subject === 'characters') categories.add('characters');
    else if (subject === 'animals') categories.add('animals');
    else if (['plants', 'sky', 'landscapes', 'buildings'].includes(subject ?? '')) categories.add('nature');
    else categories.add('things');
    if (/^(alphabet|counting)-/.test(surface.kind)) categories.add('learning');
  }
  if (!categories.size) categories.add('things');
  return { categories: [...categories], detail: surfaces.length < 12 ? 'simple' : surfaces.length < 24 ? 'medium' : 'detailed' };
}
