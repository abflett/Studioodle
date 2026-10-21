import { exportScale, paperSize } from './document';
import type { EditorSetup } from './setup';

export const maxExportPixels = 64_000_000;
export const defaultExportDpi = 300;
export function exportDimensions(picture: EditorSetup, dpi: number) {
  if (!Number.isFinite(dpi) || dpi < 36 || dpi > 1200) throw Error('Invalid export DPI');
  const size = picture.document ?? paperSize(picture.format, picture.size);
  const scale = exportScale(dpi);
  const width = Math.ceil(size.width * scale), height = Math.ceil(size.height * scale);
  return { width, height, fits: width * height <= maxExportPixels };
}
