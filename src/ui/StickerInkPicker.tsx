import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { PalettePicker } from './PalettePicker';
import type { CustomColors } from '../editor/colorPalettes';
import { closeOnBackdrop } from './dialog';

export function StickerInkPicker({ color, onChoose, onClose, returnFocus, custom, onEdit }: { custom: CustomColors; onEdit: (index: number, color: number) => void; returnFocus: RefObject<HTMLElement | null>; color: number; onChoose: (color: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current!, previous = returnFocus.current;
    element.showModal(); heading.current?.focus();
    return () => { element.close(); previous?.focus({ preventScroll: true }); };
  }, [returnFocus]);
  return <dialog ref={dialog} className="setup-dialog palette-dialog sticker-ink-dialog" aria-labelledby="sticker-ink-title" onCancel={onClose} onClick={event => closeOnBackdrop(event, onClose)}>
    <PalettePicker id="sticker-ink-title" label="Sticker ink" headingRef={heading} color={color} custom={custom} onEdit={onEdit} onChoose={onChoose} onClose={onClose}/>

  </dialog>;
}
