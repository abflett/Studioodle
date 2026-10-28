import { useEffect, useState } from 'react';
import type { EditorBridge } from '../editor/bridge';
import { guardDesktopClose, isDesktop } from '../platform/desktop';

/** Exit paths save pending edits first; clean sessions leave without a write. */
export function useEditorSaving(bridge: EditorBridge, onBack: () => void) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  useEffect(() => {
    if (!isDesktop) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void guardDesktopClose(
      () => new Promise(resolve => bridge.send({ type: 'save', onComplete: resolve })),
      () => setSaveStatus('error'),
    ).then(unlisten => {
      if (disposed) unlisten(); else stop = unlisten;
    }).catch(() => setSaveStatus('error'));
    return () => { disposed = true; stop?.(); };
  }, [bridge]);
  useEffect(() => {
    const timer = window.setInterval(() => bridge.send({ type: 'save', onComplete: saved => setSaveStatus(saved ? 'idle' : 'error') }), 60_000);
    return () => window.clearInterval(timer);
  }, [bridge]);
  return {
    saveStatus,
    dismissSaveStatus: () => setSaveStatus('idle'),
    save: () => bridge.send({ type: 'save', onComplete: (saved, written) => setSaveStatus(saved ? (written ? 'saved' : 'idle') : 'error') }),
    goHome: () => bridge.send({ type: 'save', onComplete: saved => {
      if (saved) onBack(); else setSaveStatus('error');
    } }),
  };
}
