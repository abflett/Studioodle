import { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import type { SavedPicture } from '../editor/storage';
import { SavedPreview } from './SavedPreview';
import { closeOnBackdrop } from './dialog';

export function DeletePictureDialog({ picture, onCancel, onConfirm }: {
  picture?: SavedPicture; onCancel: () => void; onConfirm: (picture: SavedPicture) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const modal = dialog.current;
    if (picture && !modal?.open) { modal?.showModal(); cancel.current?.focus(); }
    if (!picture) modal?.close();
    return () => modal?.close();
  }, [picture]);
  return <dialog className="setup-dialog delete-picture-dialog" ref={dialog} aria-labelledby="delete-picture-title" onCancel={onCancel} onClick={event => closeOnBackdrop(event, onCancel)} onAuxClick={event => { if (event.button === 2) closeOnBackdrop(event, onCancel); }}>
    <div className="wizard">
      <h2 id="delete-picture-title">Delete this picture?</h2>
      <div className="delete-picture-preview">{picture && <SavedPreview picture={picture} />}</div>
      <div className="delete-picture-actions">
        <button ref={cancel} className="go-button" onClick={onCancel}><X aria-hidden="true" /><span>Keep it</span></button>
        <button className="go-button confirm-delete" onClick={() => { if (picture) onConfirm(picture); }}><Trash2 aria-hidden="true" /><span>Delete</span></button>
      </div>
    </div>
  </dialog>;
}
