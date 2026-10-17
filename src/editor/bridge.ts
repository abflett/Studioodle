import type { Point, StickerKind } from './document';
import type { BrushOptions, FillOptions } from './toolOptions';
export type EditorTool = 'brush' | 'bucket' | 'select' | 'pan' | 'erase';
export type SelectionOrder = { forward: boolean; backward: boolean };
export type EditorCommand =
  | { type: 'set-color'; color: number }
  | { type: 'set-tool'; tool: EditorTool }
  | { type: 'set-brush'; options: BrushOptions }
  | { type: 'set-fill'; options: FillOptions }
  | { type: 'transform-selection'; scaleDelta: number; rotationDelta: number }
  | { type: 'order-selection'; direction: 'forward' | 'backward' }
  | { type: 'focus-selection'; onFocus: (bounds: { x: number; y: number; width: number; height: number }) => void }
  | { type: 'add-sticker'; sticker: StickerKind; outlineColor: number; point: Point }
  | { type: 'undo' }
  | { type: 'clear-selection' | 'duplicate-selection' | 'delete-selection' }
  | { type: 'save'; onComplete: (saved: boolean) => void };

export function createEditorBridge() {
  const listeners = new Set<(command: EditorCommand) => void>();
  const selectionListeners = new Set<(id: string | undefined, order: SelectionOrder) => void>();
  const toolListeners = new Set<(tool: EditorTool) => void>();
  return {
    toolChanged(tool: EditorTool) { for (const listener of toolListeners) listener(tool); },
    onTool(listener: (tool: EditorTool) => void) {
      toolListeners.add(listener);
      return () => { toolListeners.delete(listener); };
    },
    selectionChanged(id: string | undefined, order: SelectionOrder) { for (const listener of selectionListeners) listener(id, order); },
    onSelection(listener: (id: string | undefined, order: SelectionOrder) => void) {
      selectionListeners.add(listener);
      return () => { selectionListeners.delete(listener); };
    },
    send(command: EditorCommand) { for (const listener of listeners) listener(command); },
    subscribe(listener: (command: EditorCommand) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
export type EditorBridge = ReturnType<typeof createEditorBridge>;




