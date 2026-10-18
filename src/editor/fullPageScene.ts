import { presetSize } from './paperPresets';
import type { EditorSetup } from './setup';

/** Templates are unpainted; saved documents keep their own paper and coordinates. */
export function fullPageScene(source: EditorSetup): EditorSetup {
  const document = source.document!;
  const size = presetSize('full', 'landscape');
  const scale = Math.min(size.width / document.width, size.height / document.height);
  const dx = (size.width - document.width * scale) / 2;
  const dy = (size.height - document.height * scale) / 2;
  return { ...source, format: 'landscape', size, document: { ...document, ...size, horizonLayout: 2,
    surfaces: document.surfaces.map(surface => surface.kind === 'canvas' ? { ...surface } : {
      ...surface, x: surface.x * scale + dx, y: surface.y * scale + dy,
      scale: (surface.scale ?? 1) * scale,
    }),
  } };
}
