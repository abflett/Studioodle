export type EditorCommand =
  | { type: 'set-color'; color: number }
  | { type: 'reset-preview' };

// Keep the UI contract independent of Phaser and native platform APIs.
export function createEditorBridge() {
  const listeners = new Set<(command: EditorCommand) => void>();
  return {
    send(command: EditorCommand) {
      for (const listener of listeners) listener(command);
    },
    subscribe(listener: (command: EditorCommand) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type EditorBridge = ReturnType<typeof createEditorBridge>;
