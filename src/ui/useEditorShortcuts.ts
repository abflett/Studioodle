import { useEffect, useRef } from 'react';

export function useEditorShortcuts(actions: Record<string, () => void>) {
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || document.querySelector('dialog[open]')) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]')) return;
      if (event.key === 'Enter' && target instanceof Element && target.closest('button, a, summary, [role="button"]')) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = `${modifier ? 'mod+' : ''}${modifier && event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`;
      const action = latest.current[key];
      if (!action) return;
      event.preventDefault();
      if (!event.repeat || key === 'mod+z' || ['+', '=', '-'].includes(key)) action();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
}
