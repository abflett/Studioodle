import type { ReactNode, Ref } from 'react';
import { ArrowLeft, X } from 'lucide-react';

/** Consistent title alignment and full-size, labelled controls for every overlay. */
export function DialogHeader({ id, title, onClose, closeLabel, back, headingRef, children }: {
  id: string;
  title: ReactNode;
  onClose: () => void;
  closeLabel: string;
  back?: { label: string; onClick: () => void };
  headingRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}) {
  return <header className={`wizard-header dialog-header${back ? ' has-back' : ''}`}>
    {back && <button type="button" className="icon-button dialog-header-button dialog-back" aria-label={back.label} title={back.label} onClick={back.onClick}><ArrowLeft aria-hidden="true" /></button>}
    <div className="dialog-heading"><h2 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h2>{children}</div>
    <button type="button" className="icon-button dialog-header-button dialog-close" aria-label={closeLabel} title={closeLabel} onClick={onClose}><X aria-hidden="true" /></button>
  </header>;
}
