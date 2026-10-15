export type EditorTool = 'brush' | 'bucket' | 'inspect' | 'move' | 'pan';
export type EditorCommand =
  | { type: 'set-color'; color: number }
  | { type: 'set-tool'; tool: EditorTool }
  | { type: 'add-sticker'; sticker: 'tree' | 'flower' | 'circle' | 'square' | 'triangle' }
  | { type: 'undo' }
  | { type: 'save'; onComplete: (saved: boolean) => void };

export function createEditorBridge() {
  const listeners = new Set<(command: EditorCommand) => void>();
  return {
    send(command: EditorCommand) { for (const listener of listeners) listener(command); },
    subscribe(listener: (command: EditorCommand) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
export type EditorBridge = ReturnType<typeof createEditorBridge>;


