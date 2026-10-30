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

/** Compact browsing identity; paint and titles intentionally do not participate. */
export function coloringPageLayoutFingerprint(source: EditorSetup): string | undefined {
  const key = coloringPageLayoutKey(source); if (key === undefined) return;
  let a = 2166136261, b = 2246822519;
  for (let i = 0; i < key.length; i++) { a = Math.imul(a ^ key.charCodeAt(i), 16777619); b = Math.imul(b ^ key.charCodeAt(i), 3266489917); }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
