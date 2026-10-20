import { useEffect, useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import { closeOnBackdrop } from './dialog';
import { makeColoringBook, maxBookBytes, parseColoringBook } from '../editor/coloringBook';
import type { ColoringBook } from '../editor/coloringBook';
import { workshopPages, workshopRepository } from '../app/coloringBookWorkshop';
import { downloadColoringBook } from '../platform/coloringBookOutput';

export function ColoringBookLibrary({ open, onClose, onChange }: { open: boolean; onClose: () => void; onChange: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(() => { try { return workshopRepository.load().title; } catch { return 'Studioodle Coloring Book'; } });
  const [pending, setPending] = useState<ColoringBook>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const modal = dialog.current;
    if (open) modal?.showModal(); else modal?.close();
    return () => modal?.close();
  }, [open]);
  const importFile = async (file: File) => {
    setPending(undefined); setMessage(''); setBusy(true);
    try {
      if (file.size > maxBookBytes) throw new Error('This book is too large (maximum 20 MB).');
      const book = parseColoringBook(await file.text());
      if (!book.pages.length) throw new Error('This book has no pages.');
      setPending(book);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read this book.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="setup-dialog settings-dialog workshop-dialog" aria-labelledby="book-library-title" onCancel={onClose} onClick={e => closeOnBackdrop(e, onClose)}>
    <div className="wizard">
      <header className="wizard-header"><h2 id="book-library-title">Coloring Books</h2><button className="icon-button" aria-label="Close coloring books" onClick={onClose}><X /></button></header>
      <p>Import a JSON book to edit its pages locally. Export the collection to share it or update the bundled pages later.</p>
      <label className="workshop-field">Book title<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)} /></label>
      <div className="workshop-actions">
        <button className="go-button" disabled={busy || !title.trim()} onClick={() => {
          setBusy(true); setMessage('');
          void Promise.resolve().then(() => downloadColoringBook(makeColoringBook(title, workshopPages()))).then(saved => { if (saved) setMessage('Coloring book exported.'); }).catch(() => setMessage('Could not export. Check device storage and try again.')).finally(() => setBusy(false));
        }}><Download /><span>Export All Pages</span></button>
        <button className="go-button secondary-action" disabled={busy} onClick={() => { document.exitPointerLock?.(); input.current?.click(); }}><Upload /><span>Import Book</span></button>
      </div>
      <input ref={input} hidden type="file" accept=".json,application/json" aria-label="Coloring book JSON file" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (file) void importFile(file);
      }} />
      {pending && <section className="workshop-import" aria-label="Review import">
        <strong>{pending.title}</strong><p>{pending.pages.length} pages. Matching page IDs replace local revisions; new IDs add pages. Your pictures stay unchanged.</p>
        <div className="workshop-actions"><button className="go-button" disabled={busy} onClick={() => {
          try {
            workshopRepository.merge(pending); setTitle(pending.title); onChange(); setPending(undefined); setMessage('Book imported. Open Coloring Page to edit it.');
          } catch { setMessage('Could not import. Local storage may be full or unavailable; nothing was changed.'); }
        }}>Import Pages</button><button className="go-button secondary-action" onClick={() => setPending(undefined)}>Cancel</button></div>
      </section>}
      {message && <p role="status">{message}</p>}
    </div>
  </dialog>;
}
