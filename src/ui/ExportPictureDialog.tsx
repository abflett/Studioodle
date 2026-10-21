import { useEffect, useRef, useState } from 'react';
import { Download, Image, Shapes, FileText } from 'lucide-react';
import { defaultExportDpi, exportDimensions } from '../editor/exportResolution';
import type { EditorSetup } from '../editor/setup';
import { exportPicture } from '../app/pictureOutput';
import type { PictureFormat } from '../app/pictureOutput';
import { DialogHeader } from './DialogHeader';
import { closeOnBackdrop } from './dialog';

const formats: { id: PictureFormat; title: string; detail: string }[] = [
  { id: 'png', title: 'PNG image', detail: 'A picture for sharing and printing' },
  { id: 'svg', title: 'SVG artwork', detail: 'Scalable artwork, sharp at any size' },
  { id: 'pdf', title: 'PDF document', detail: 'A print-ready page, sharp at any size' },
];
export function ExportPictureDialog({ picture, onClose }: { picture: EditorSetup; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dpi, setDpi] = useState(() => exportDimensions(picture, defaultExportDpi).fits ? defaultExportDpi : 150);
  const dimensions = exportDimensions(picture, dpi);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { const modal = dialog.current!; modal.showModal(); return () => modal.close(); }, []);
  const close = () => { if (!busy) onClose(); };
  const download = async (format: PictureFormat) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await exportPicture(picture, format, dpi); onClose(); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <dialog className="setup-dialog export-dialog" ref={dialog} aria-labelledby="export-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClick={event => closeOnBackdrop(event, close)}>
    <div className="wizard export-layout" aria-busy={busy}>
      <DialogHeader id="export-title" title="Export your picture" onClose={close} closeLabel="Close export" />
      <div className="export-formats">
        {formats.map(format => {
          const Icon = format.id === 'png' ? Image : format.id === 'svg' ? Shapes : FileText;
          return <section className="export-option" key={format.id}>
            <button className="export-format-button" disabled={busy || (format.id === 'png' && !dimensions.fits)} onClick={() => void download(format.id)} aria-label={`Export as ${format.id.toUpperCase()}`}>
              <span className="export-format-icon"><Icon aria-hidden="true" /></span>
              <span className="export-format-copy"><strong>{format.title}</strong><span>{format.detail}</span></span>
              <Download className="export-download-icon" aria-hidden="true" />
            </button>
            {format.id === 'png' && <div className="export-resolution">
              <label htmlFor="export-dpi">Resolution</label>
              <select id="export-dpi" value={dpi} disabled={busy} onChange={event => setDpi(Number(event.target.value))}>
                {[150, 300, 600].map(value => <option key={value} value={value} disabled={!exportDimensions(picture, value).fits}>{value} DPI</option>)}
              </select>
              <span className="export-pixel-size" aria-live="polite">{dimensions.width.toLocaleString()} &times; {dimensions.height.toLocaleString()} px</span>
              {!dimensions.fits && <span role="alert">Choose a lower resolution or a vector format.</span>}
            </div>}
          </section>;
        })}
        {busy && <p role="status">Preparing your picture...</p>}
        {error && <p role="alert">Could not export this picture. Please try again.</p>}
      </div>
    </div>
  </dialog>;
}
