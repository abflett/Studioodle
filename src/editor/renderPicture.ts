import { Artwork } from './Artwork';
import { paperSize } from './document';
import { exportDimensions } from './exportResolution';
import type { EditorSetup } from './setup';
import { prepareStickers } from './vectorStickers';

export async function renderPicture(picture: EditorSetup, dpi = 150) {
  const { width, height } = picture.document ?? paperSize(picture.format, picture.size);
  const pixels = exportDimensions(picture, dpi);
  if (!pixels.fits) throw Error('Export exceeds the image size budget');
  await prepareStickers(picture.document?.surfaces.map(surface => surface.kind) ?? []);
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width; canvas.height = pixels.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to render picture');
  context.scale(canvas.width / width, canvas.height / height);
  const artwork = picture.document ? Artwork.restore(picture.document) : Artwork.create(width, height, picture.background);
  try { artwork.render(context); } finally { artwork.dispose(); }
  return canvas;
}
