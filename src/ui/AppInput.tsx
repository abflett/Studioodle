import { useEffect, type ReactNode } from 'react';

// Canvas input already accepts either mouse button. Native buttons need their
// secondary click translated into the same activation as a primary click.
export function AppInput({ children }: { children: ReactNode }) {
  useEffect(() => {
    const preventSelection = (event: Event) => {
      const target = event.target;
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
      if (element?.closest('input, textarea') || (element instanceof HTMLElement && element.isContentEditable)) return;
      event.preventDefault();
    };
    document.addEventListener('selectstart', preventSelection, true);
    return () => document.removeEventListener('selectstart', preventSelection, true);
  }, []);
  return <div className="app-input"
    onContextMenu={(event) => event.preventDefault()}
    onDragStart={(event) => event.preventDefault()}
    onAuxClick={(event) => {
      if (event.button !== 2) return;
      event.preventDefault();
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button');
      if (button instanceof HTMLButtonElement && !button.disabled) button.click();
    }}>
    {children}
  </div>;
}
