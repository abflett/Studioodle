import { resolveColor } from './colorPalettes';
import type { EditorSetup } from './setup';
import { paperSize } from './document';

/** Coloring-page identity excludes paint, paper color, titles and storage IDs. */
export function coloringPageLayoutKey(source: EditorSetup): string | undefined {
  if (!source.document) return;
  const size = paperSize(source.format, source.size);
  return JSON.stringify([size.width, size.height, source.document.surfaces.filter(s => s.kind !== 'canvas').map(s => [
    s.kind, s.x, s.y, s.color, resolveColor(s.color, source.document!.customColors), s.scale ?? 1, s.rotation ?? 0, s.flipX ?? false, s.flipY ?? false,
  ])]);
}
