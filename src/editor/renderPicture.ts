import { Artwork } from './Artwork';
import { paperSize, paintScale } from './document';
import type { EditorSetup } from './setup';
import { prepareStickers } from './vectorStickers';

export async function renderPicture(picture: EditorSetup) {
  await prepareStickers(picture.document?.surfaces.map(surface => surface.kind) ?? []);
  const { width, height } = paperSize(picture.format, picture.size);
  const canvas = document.createElement('canvas');
  const scale = paintScale();
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to render picture');
  context.scale(canvas.width / width, canvas.height / height);
  const artwork = picture.document ? Artwork.restore(picture.document) : Artwork.create(width, height, picture.background);
  artwork.render(context);
  return canvas;
}
