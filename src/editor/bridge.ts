import type { SavedPicture } from './savedPicture';
import type { Point, StickerKind } from './document';
import type { BrushOptions } from './toolOptions';
export type EditorTool = 'brush' | 'bucket' | 'select' | 'pan' | 'erase';
export type SelectionOrder = { forward: boolean; backward: boolean };
export type EditorCommand =
  | { type: 'fill-at'; point: Point }
  | { type: 'set-color'; color: number }
  | { type: 'set-tool'; tool: EditorTool }
  | { type: 'set-brush'; options: BrushOptions }
  | { type: 'flip-selection'; axis: 'horizontal' | 'vertical' }
  | { type: 'transform-selection'; scaleDelta: number; rotationDelta: number }
  | { type: 'order-selection'; direction: 'forward' | 'backward' }
  | { type: 'focus-selection'; onFocus: (bounds: { x: number; y: number; width: number; height: number }) => void }
  | { type: 'add-sticker'; sticker: StickerKind; outlineColor: number; point: Point }
  | { type: 'undo' | 'exit-focus' | 'cancel-input' }
  | { type: 'clear-selection' | 'duplicate-selection' | 'delete-selection' }
  | { type: 'snapshot'; onComplete: (picture: SavedPicture) => void }
  | { type: 'leave'; onComplete: () => void }
  | { type: 'save'; onComplete: (saved: boolean, written?: boolean) => void };

export function createEditorBridge() {
  const listeners = new Set<(command: EditorCommand) => void>();
  const selectionListeners = new Set<(id: string | undefined, order: SelectionOrder) => void>();
  const focusListeners = new Set<(id: string | undefined) => void>();
  const toolListeners = new Set<(tool: EditorTool) => void>();
  let previousFocus: string | undefined;
  let previousTool: EditorTool | undefined;
  let previousSelection: { id?: string; order: SelectionOrder } | undefined;
  let focusPublished = false;
  return {
    focusChanged(id?: string) {
      if (focusPublished && previousFocus === id) return;
      focusPublished = true; previousFocus = id;
      for (const listener of focusListeners) listener(id);
    },
    onFocus(listener: (id: string | undefined) => void) {
      focusListeners.add(listener);
      if (focusPublished) listener(previousFocus);
      return () => { focusListeners.delete(listener); };
    },
    toolChanged(tool: EditorTool) {
      if (previousTool === tool) return;
      previousTool = tool;
      for (const listener of toolListeners) listener(tool);
    },
    onTool(listener: (tool: EditorTool) => void) {
      toolListeners.add(listener);
      if (previousTool !== undefined) listener(previousTool);
      return () => { toolListeners.delete(listener); };
    },
    selectionChanged(id: string | undefined, order: SelectionOrder) {
      if (previousSelection && previousSelection.id === id && previousSelection.order.forward === order.forward && previousSelection.order.backward === order.backward) return;
      previousSelection = { id, order: { ...order } };
      for (const listener of selectionListeners) listener(id, order);
    },
    onSelection(listener: (id: string | undefined, order: SelectionOrder) => void) {
      selectionListeners.add(listener);
      if (previousSelection) listener(previousSelection.id, { ...previousSelection.order });
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
