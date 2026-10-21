import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import type { EditorSetup } from '../editor/setup';
import { exportPicture } from '../app/pictureOutput';
import type { PictureFormat } from '../app/pictureOutput';
import { DialogHeader } from './DialogHeader';
import { closeOnBackdrop } from './dialog';

const formats: { id: PictureFormat; title: string; detail: string }[] = [
  { id: 'png', title: 'PNG image', detail: 'Easy to share (150 DPI)' },
  { id: 'svg', title: 'SVG artwork', detail: 'Sharp at any size (vector)' },
  { id: 'pdf', title: 'PDF document', detail: 'Ready for printing (vector)' },
];
export function ExportPictureDialog({ picture, onClose }: { picture: EditorSetup; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { const modal = dialog.current!; modal.showModal(); return () => modal.close(); }, []);
  const close = () => { if (!busy) onClose(); };
  const download = async (format: PictureFormat) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await exportPicture(picture, format); onClose(); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <dialog className="setup-dialog" ref={dialog} aria-labelledby="export-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClick={event => closeOnBackdrop(event, close)}>
    <div className="wizard" aria-busy={busy}>
      <DialogHeader id="export-title" title="Export your picture" onClose={close} closeLabel="Close export" />
      <div className="wizard-body export-formats">
        {formats.map(format => <button key={format.id} className="format-button" disabled={busy} onClick={() => void download(format.id)} aria-label={`Export as ${format.id.toUpperCase()}`}><Download aria-hidden="true" /><span className="shape-label">{format.title}<small>{format.detail}</small></span></button>)}
        {busy && <p role="status">Preparing your picture...</p>}
        {error && <p role="alert">Could not export this picture. Please try again.</p>}
      </div>
    </div>
  </dialog>;
}
