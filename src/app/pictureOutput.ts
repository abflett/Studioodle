import type { EditorSetup } from '../editor/setup';
import { renderPicture } from '../editor/renderPicture';
import { outputTitle } from '../editor/pictureTitles';
import { pngResolution } from '../editor/pngResolution';
import { defaultPaintDpi } from '../editor/document';
import { savePng, printRenderedPicture } from '../platform/pictureOutput';

export async function exportPicture(picture: EditorSetup) {
  const canvas = await renderPicture(picture);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
  const png = await pngResolution(blob, defaultPaintDpi);
  const name = `${outputTitle(picture).replace(/[^a-z0-9 _-]/gi, '').trim() || 'Studioodle picture'}.png`;
  await savePng(png, name);
}

export function printPicture(picture: EditorSetup, onError: () => void) {
  printRenderedPicture(() => renderPicture(picture), outputTitle(picture), onError);
}
