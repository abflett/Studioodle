import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { ColorPicker } from './ColorPicker';
import { DialogHeader } from './DialogHeader';
import { closeOnBackdrop } from './dialog';

export function StickerInkPicker({ color, onChoose, onClose, returnFocus }: { returnFocus: RefObject<HTMLElement | null>; color: number; onChoose: (color: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal(); heading.current?.focus();
    return () => { element.close(); returnFocus.current?.focus({ preventScroll: true }); };
  }, [returnFocus]);
  return <dialog ref={dialog} className="setup-dialog art-dialog sticker-ink-dialog" aria-labelledby="sticker-ink-title" onCancel={onClose} onClick={event => closeOnBackdrop(event, onClose)}>
    <div className="wizard"><DialogHeader id="sticker-ink-title" title="Sticker ink" headingRef={heading} onClose={onClose} closeLabel="Close sticker ink colors" />
      <div className="wizard-body"><ColorPicker color={color} onChoose={onChoose} label="Sticker ink colors" /></div>
    </div>
  </dialog>;
}
