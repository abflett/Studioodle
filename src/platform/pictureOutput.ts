import { isDesktop, printDesktopPicture, saveDesktopPng } from './desktop';

export async function savePng(blob: Blob, name: string) {
  if (isDesktop) { await saveDesktopPng(blob, name); return; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function printRenderedPicture(render: () => Promise<HTMLCanvasElement>, title: string, onError: () => void) {
  if (isDesktop) {
    void render().then(canvas => printDesktopPicture(canvas.toDataURL('image/png'), title)).catch(onError);
    return;
  }
  // Open synchronously from the click so browsers permit the print window.
  const preview = window.open('', '_blank');
  if (!preview) { onError(); return; }
  try {
    preview.opener = null;
    const doc = preview.document;
    doc.title = title;
    const style = doc.createElement('style');
    style.textContent = `body{margin:0;text-align:center;background:white}img{display:block;max-width:100%;max-height:90vh;object-fit:contain;margin:auto}button{font:18px sans-serif;padding:12px 24px;margin:12px}@media print{button{display:none}img{max-width:100%;max-height:95vh;break-inside:avoid}}@page{margin:10mm}`;
    doc.head.append(style);
    const button = doc.createElement('button');
    button.textContent = 'Print'; button.onclick = () => preview.print();
    const image = doc.createElement('img'); image.alt = title;
    image.onload = () => { preview.focus(); preview.print(); };
    image.onerror = onError;
    doc.body.append(button, image);
    void render().then(canvas => { image.src = canvas.toDataURL('image/png'); }).catch(() => { preview.close(); onError(); });
  } catch { preview.close(); onError(); }
}
