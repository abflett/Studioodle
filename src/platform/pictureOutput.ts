import { downloadFile } from './downloadFile';
import { isDesktop, printDesktopPicture, saveDesktopPicture } from './desktop';

export type PictureFormat = 'png' | 'svg' | 'pdf';
export async function savePictureFile(blob: Blob, name: string, format: PictureFormat) {
  if (isDesktop) { await saveDesktopPicture(blob, name, format); return; }
  downloadFile(blob, name);
}

export function printVectorPicture(render: () => Promise<SVGSVGElement>, title: string, onError: () => void) {
  if (isDesktop) { void render().then(svg => printDesktopPicture(svg, title)).catch(onError); return; }
  // Open synchronously from the click so browsers permit the print window.
  let preview: Window | null;
  try { preview = window.open('', '_blank'); } catch { onError(); return; }
  if (!preview) { onError(); return; }
  try {
    preview.opener = null;
    const doc = preview.document; doc.title = title;
    const style = doc.createElement('style');
    style.textContent = `body{margin:0;text-align:center;background:white}svg{display:block;width:100%;height:auto;max-height:90vh;margin:auto}button{font:18px sans-serif;padding:12px 24px;margin:12px}@media print{button{display:none}svg{width:100%;height:auto;max-height:100vh;break-inside:avoid}}@page{margin:10mm}`;
    doc.head.append(style);
    const button = doc.createElement('button');
    const print = () => {
      if (preview.closed) return;
      try { preview.focus(); preview.print(); } catch { onError(); }
    };
    button.textContent = 'Print'; button.onclick = print;
    doc.body.append(button);
    void render().then(svg => {
      if (preview.closed) return;
      doc.body.append(doc.importNode(svg, true));
      const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number);
      style.textContent += `@page{size:${width! / 96}in ${height! / 96}in;margin:0}`;
      // Let the vector preview lay out before opening the browser print dialog.
      preview.requestAnimationFrame(() => preview.requestAnimationFrame(print));
    }).catch(() => { preview.close(); onError(); });
  } catch { preview.close(); onError(); }
}
