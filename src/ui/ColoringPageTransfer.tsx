import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Copy, Download, FilePlus2, Upload } from 'lucide-react';
import type { EditorSetup } from '../editor/setup';
import { makeColoringBook } from '../editor/coloringBook';
import type { ColoringBook } from '../editor/coloringBook';
import { independentPages, maxSharingCodeBytes, pageSharingCode, parsePageSharingCode } from '../app/coloringPageSharing';
import { workshopRepository } from '../app/coloringBookWorkshop';
import { downloadColoringBook } from '../platform/coloringBookOutput';
import { DialogHeader } from './DialogHeader';
import { ColoringPagePreview } from './ColoringPagePreview';
import { closeOnBackdrop } from './dialog';

export function ColoringPageTransfer({ page, onAdded, onClose }: { page?: EditorSetup; onAdded: (id: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLTextAreaElement>(null), file = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const cancelRead = useCallback(() => { request.current++; }, []);
  const shared = useMemo(() => page ? makeColoringBook(page.title, [page]) : undefined, [page]);
  const [text, setText] = useState(() => shared ? pageSharingCode(shared) : '');
  const [incoming, setIncoming] = useState<ColoringBook>();
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => { cancelRead(); modal?.close(); }; }, [cancelRead]);
  const validate = () => {
    try { const checked = parsePageSharingCode(text); if (!checked.pages.length) throw Error('No pages found.'); setIncoming(checked); setMessage(''); }
    catch (error) { setIncoming(undefined); setMessage(error instanceof Error ? error.message : 'Could not read these pages.'); }
  };
  return <dialog ref={dialog} className="setup-dialog page-transfer-dialog" aria-labelledby="page-transfer-title" onCancel={onClose} onClick={e => closeOnBackdrop(e, onClose)}>
    <div className="page-transfer-body">
      <DialogHeader id="page-transfer-title" title={page ? 'Share Coloring Page' : 'Add Coloring Pages'} onClose={onClose} closeLabel="Close page sharing" />
      <label>{page ? 'Sharing code' : 'Paste a sharing code'}<textarea ref={input} aria-label="Page sharing code" value={text} readOnly={!!page} maxLength={maxSharingCodeBytes} onChange={e => { request.current++; setBusy(false); setText(e.target.value); setIncoming(undefined); setMessage(''); }} /></label>
      <div className="page-transfer-actions">
        {shared ? <>
          <button className="go-button" disabled={busy} onClick={() => {
            setBusy(true); void navigator.clipboard?.writeText(text).then(() => setMessage('Sharing code copied.')).catch(() => { input.current?.focus(); input.current?.select(); setMessage('Copy the selected code manually.'); }).finally(() => setBusy(false));
            if (!navigator.clipboard) { input.current?.focus(); input.current?.select(); setMessage('Copy the selected code manually.'); setBusy(false); }
          }}><Copy /><span>Copy Code</span></button>
          <button className="go-button secondary-action" disabled={busy} onClick={() => { setBusy(true); void downloadColoringBook(shared).then(saved => { if (saved) setMessage('Page downloaded.'); }).catch(() => setMessage('Could not download this page.')).finally(() => setBusy(false)); }}><Download /><span>Download File</span></button>
        </> : <>
          <button className="go-button" disabled={!text.trim() || busy} onClick={validate}><Clipboard /><span>Preview Pages</span></button>
          <button className="go-button secondary-action" disabled={busy} onClick={() => file.current?.click()}><Upload /><span>Open File</span></button>
          <input ref={file} type="file" accept=".studioodle,text/plain" hidden onChange={e => {
            const selected = e.target.files?.[0]; e.target.value = ''; if (!selected) return;
            setIncoming(undefined); setMessage(''); if (selected.size > maxSharingCodeBytes) { setMessage('Sharing file is too large.'); return; }
            const identity = ++request.current; setBusy(true);
            void selected.text().then(value => { if (identity === request.current) { setText(value); setIncoming(undefined); } }).catch(() => { if (identity === request.current) setMessage('Could not read this file.'); }).finally(() => { if (identity === request.current) setBusy(false); });
          }} />
        </>}
      </div>
      {incoming && <div className="page-import-preview"><ColoringPagePreview page={incoming.pages[0]!} /><p>{incoming.pages.length} {incoming.pages.length === 1 ? 'page' : 'pages'}: {incoming.pages.slice(0, 3).map(p => p.title).join(', ')}{incoming.pages.length > 3 ? '...' : ''}</p><button className="go-button" onClick={() => {
        try { const added = independentPages(incoming); workshopRepository.merge(added); onAdded(added.pages[0]!.id); }
        catch { setMessage('Could not add these pages. Existing pages have not been replaced. Check device storage.'); }
      }}><FilePlus2 /><span>Add Pages</span></button></div>}
      {message && <p role="status">{message}</p>}
    </div>
  </dialog>;
}
