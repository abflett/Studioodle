import { Artwork } from './Artwork';
import { paperSize } from './document';
import type { EditorSetup } from './setup';

function renderPicture(picture: EditorSetup) {
  const { width, height } = paperSize(picture.format, picture.size);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to render picture');
  const artwork = picture.document ? Artwork.restore(picture.document) : Artwork.create(width, height, picture.background);
  if (!picture.document && picture.marks) artwork.importMarks(picture.marks);
  artwork.render(context);
  return canvas;
}

export async function exportPicture(picture: EditorSetup) {
  const canvas = renderPicture(picture);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${picture.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'Studioodle picture'}.png`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function printPicture(picture: EditorSetup, onError: () => void) {
  // Open synchronously from the click so browsers permit the print window.
  const preview = window.open('', '_blank');
  if (!preview) { onError(); return; }
  try {
    preview.opener = null;
    const doc = preview.document;
    doc.title = picture.title;
    const style = doc.createElement('style');
    style.textContent = `body{margin:0;text-align:center;background:white}img{display:block;max-width:100%;max-height:90vh;object-fit:contain;margin:auto}button{font:18px sans-serif;padding:12px 24px;margin:12px}@media print{button{display:none}img{max-width:100%;max-height:95vh;break-inside:avoid}}@page{margin:10mm}`;
    doc.head.append(style);
    const button = doc.createElement('button');
    button.textContent = 'Print'; button.onclick = () => preview.print();
    const image = doc.createElement('img'); image.alt = picture.title;
    image.onload = () => { preview.focus(); preview.print(); };
    image.onerror = onError;
    doc.body.append(button, image);
    image.src = renderPicture(picture).toDataURL('image/png');
  } catch { preview.close(); onError(); }
}
