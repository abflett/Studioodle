import type { EditorSetup } from '../editor/setup';
import { renderPicture } from '../editor/renderPicture';
import { pictureSvg } from '../editor/pictureSvg';
import { outputTitle } from '../editor/pictureTitles';
import { pngResolution } from '../editor/pngResolution';
import { defaultPaintDpi } from '../editor/document';
import { savePictureFile, printVectorPicture } from '../platform/pictureOutput';
import type { PictureFormat } from '../platform/pictureOutput';
export type { PictureFormat } from '../platform/pictureOutput';

export async function pictureFile(picture: EditorSetup, format: PictureFormat): Promise<Blob> {
  if (format === 'svg') return new Blob([new XMLSerializer().serializeToString(await pictureSvg(picture))], { type: 'image/svg+xml' });
  if (format === 'pdf') {
    const { picturePdf } = await import('./picturePdf');
    return picturePdf(await pictureSvg(picture), outputTitle(picture));
  }
  const canvas = await renderPicture(picture);
  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
    return await pngResolution(blob, defaultPaintDpi);
  } finally { canvas.width = canvas.height = 1; }
}

export async function exportPicture(picture: EditorSetup, format: PictureFormat) {
  const blob = await pictureFile(picture, format);
  const name = `${outputTitle(picture).replace(/[^a-z0-9 _-]/gi, '').trim() || 'Studioodle picture'}.${format}`;
  await savePictureFile(blob, name, format);
}
export function printPicture(picture: EditorSetup, onError: () => void) {
  printVectorPicture(() => pictureSvg(picture), outputTitle(picture), onError);
}
