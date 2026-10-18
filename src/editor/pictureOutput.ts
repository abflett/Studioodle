import { Artwork } from './Artwork';
import { isDesktop, printDesktopPicture, saveDesktopPng } from '../platform/desktop';
import { formatPictureTitle } from './pictureTitles';
import { paperSize, paintScale } from './document';
import type { EditorSetup } from './setup';
import { pngResolution } from './pngResolution';
import { prepareStickers } from './vectorStickers';

async function renderPicture(picture: EditorSetup) {
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

// Give untitled drawings a stable name shared by PNG downloads and print/PDF.
function outputTitle(picture: EditorSetup) {
  const title = formatPictureTitle(picture.title);
  if (title && !/^blank[ -]?page$/i.test(title)) return title;
  let hash = 2166136261;
  for (const character of picture.id ?? title) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `Picture ${String((hash >>> 0) % 1_000_000).padStart(6, '0')}`;
}

export async function exportPicture(picture: EditorSetup) {
  const canvas = await renderPicture(picture);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG export failed')), 'image/png'));
  const png = await pngResolution(blob, 150);
  const name = `${outputTitle(picture).replace(/[^a-z0-9 _-]/gi, '').trim() || 'Studioodle picture'}.png`;
  if (isDesktop) { await saveDesktopPng(png, name); return; }
  const url = URL.createObjectURL(png);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function printPicture(picture: EditorSetup, onError: () => void) {
  if (isDesktop) {
    void renderPicture(picture).then(canvas => printDesktopPicture(canvas.toDataURL('image/png'), outputTitle(picture))).catch(onError);
    return;
  }
  // Open synchronously from the click so browsers permit the print window.
  const preview = window.open('', '_blank');
  if (!preview) { onError(); return; }
  try {
    preview.opener = null;
    const doc = preview.document;
    doc.title = outputTitle(picture);
    const style = doc.createElement('style');
    style.textContent = `body{margin:0;text-align:center;background:white}img{display:block;max-width:100%;max-height:90vh;object-fit:contain;margin:auto}button{font:18px sans-serif;padding:12px 24px;margin:12px}@media print{button{display:none}img{max-width:100%;max-height:95vh;break-inside:avoid}}@page{margin:10mm}`;
    doc.head.append(style);
    const button = doc.createElement('button');
    button.textContent = 'Print'; button.onclick = () => preview.print();
    const image = doc.createElement('img'); image.alt = outputTitle(picture);
    image.onload = () => { preview.focus(); preview.print(); };
    image.onerror = onError;
    doc.body.append(button, image);
    void renderPicture(picture).then(canvas => { image.src = canvas.toDataURL('image/png'); }).catch(() => { preview.close(); onError(); });
  } catch { preview.close(); onError(); }
}
