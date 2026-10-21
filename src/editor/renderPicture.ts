import { Artwork } from './Artwork';
import { paperSize, exportScale } from './document';
import type { EditorSetup } from './setup';
import { prepareStickers } from './vectorStickers';

export async function renderPicture(picture: EditorSetup, dpi = 150) {
  const { width, height } = paperSize(picture.format, picture.size);
  if(!Number.isFinite(dpi)||dpi<36||dpi>1200)throw Error('Invalid export DPI');
  const scale = exportScale(dpi);
  if(Math.ceil(width*scale)*Math.ceil(height*scale)>64_000_000)throw Error('Export exceeds the image size budget');
  await prepareStickers(picture.document?.surfaces.map(surface => surface.kind) ?? []);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to render picture');
  context.scale(canvas.width / width, canvas.height / height);
  const artwork = picture.document ? Artwork.restore(picture.document) : Artwork.create(width, height, picture.background);
  try { artwork.render(context); } finally { artwork.dispose(); }
  return canvas;
}
