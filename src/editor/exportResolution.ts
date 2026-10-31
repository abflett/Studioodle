import { exportScale, paperSize } from './document';
import type { EditorSetup } from './setup';

export const maxExportPixels = 64_000_000;
export { defaultExportDpi } from './document';
export function exportDimensions(picture: EditorSetup, dpi: number) {
  if (!Number.isFinite(dpi) || dpi < 36 || dpi > 1200) throw Error('Invalid export DPI');
  const size = picture.document ?? paperSize(picture.format, picture.size);
  const scale = exportScale(dpi);
  const width = Math.ceil(picture.printSizeMm ? picture.printSizeMm.width / 25.4 * dpi : size.width * scale), height = Math.ceil(picture.printSizeMm ? picture.printSizeMm.height / 25.4 * dpi : size.height * scale);
  return { width, height, fits: width * height <= maxExportPixels };
}

/** SVG physical attributes are independent of its normalized vector viewBox. */
export function svgPrintSize(svg: SVGSVGElement) {
  const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number);
  return {width:(svg.width.baseVal.value||width!)/96,height:(svg.height.baseVal.value||height!)/96};
}
