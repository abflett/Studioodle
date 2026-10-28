import { DialogHeader } from './DialogHeader';
import { useEffect, useRef, useState } from 'react';
import { BookPlus, Download, Save } from 'lucide-react';
import type { SavedPicture } from '../editor/savedPicture';
import { coloringBookPage, makeColoringBook } from '../editor/coloringBook';
import { saveWorkshopPage } from '../app/coloringBookWorkshop';
import { downloadColoringBook } from '../platform/coloringBookOutput';
import { closeOnBackdrop } from './dialog';

export function ColoringPageWorkshop({ picture, targetId, onSaved, onClose }: {
  picture: SavedPicture; targetId?: string; onSaved: (id: string, title: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(picture.title);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => modal?.close(); }, []);
  const save = (id: string) => {
    try { const p = saveWorkshopPage(picture, id, title); onSaved(p.id, p.title); setMessage('Coloring page saved locally. Use Export Page to download this revision.'); }
    catch { setMessage('Could not save this page. Check its title and device storage.'); }
  };
  return <dialog ref={dialog} className="setup-dialog settings-dialog workshop-dialog" aria-labelledby="page-workshop-title" onCancel={onClose} onClick={e => closeOnBackdrop(e, onClose)}>
    <div className="wizard">
      <DialogHeader id="page-workshop-title" title="Save Coloring Page" onClose={onClose} closeLabel="Close page workshop" />
      <p>Saves sticker positions, sizes, flips, and layer order. Paint is removed and outlines are black on white paper.</p>
      <label className="workshop-field">Page title<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)} /></label>
      <div className="workshop-actions">
        <button className="go-button" disabled={!targetId || !title.trim() || busy} onClick={() => { if (targetId) save(targetId); }}><Save /><span>Save Revision</span></button>
        <button className="go-button secondary-action" disabled={!title.trim() || busy} onClick={() => save(crypto.randomUUID())}><BookPlus /><span>Save New Page</span></button>
        <button className="go-button secondary-action" disabled={!title.trim() || busy} onClick={() => {
          setBusy(true); setMessage('');
          void Promise.resolve().then(() => downloadColoringBook(makeColoringBook(title, [coloringBookPage(picture, targetId ?? crypto.randomUUID(), title)]))).then(saved => { if (saved) setMessage('Page exported.'); }).catch(() => setMessage('Could not export this page.')).finally(() => setBusy(false));
        }}><Download /><span>Export Page</span></button>
      </div>
      {!targetId && <p>Save a new page first to enable revisions in this session.</p>}
      {message && <p role="status">{message}</p>}
    </div>
  </dialog>;
}
