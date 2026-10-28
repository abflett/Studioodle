import { useEffect, useState } from 'react';
import type { EditorBridge } from '../editor/bridge';
import { guardDesktopClose, isDesktop } from '../platform/desktop';
import { pictureSaves } from '../app/pictures';

/** Explicit save waits for persistence; Home finishes input without waiting for disk. */
export function useEditorSaving(bridge: EditorBridge, onBack: () => void) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  useEffect(() => {
    if (!isDesktop) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void guardDesktopClose(
      async () => {
        const saved = await new Promise<boolean>(resolve => bridge.send({ type: 'save', onComplete: resolve }));
        return saved && await pictureSaves.flush();
      },
      () => setSaveStatus('error'),
    ).then(unlisten => {
      if (disposed) unlisten(); else stop = unlisten;
    }).catch(() => setSaveStatus('error'));
    return () => { disposed = true; stop?.(); };
  }, [bridge]);
  return {
    saveStatus,
    dismissSaveStatus: () => setSaveStatus('idle'),
    save: () => bridge.send({ type: 'save', onComplete: (saved, written) => setSaveStatus(saved ? (written ? 'saved' : 'idle') : 'error') }),
    goHome: () => bridge.send({ type: 'leave', onComplete: onBack }),
  };
}
