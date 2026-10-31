import type { Ref } from 'react';
import { Check, ScanSearch, Maximize2, Minimize2, RotateCw, RotateCcw, FlipHorizontal2, FlipVertical2, Copy, Trash2 } from 'lucide-react';
import type { EditorBridge, SelectionOrder } from '../editor/bridge';
import { LayerOrderIcon } from './LayerOrderIcon';

export function StickerSelectionToolbar({ bridge, focused, order, drawerRef, onFocus, onFinish }: {
  bridge: EditorBridge;
  focused: boolean;
  order: SelectionOrder;
  drawerRef: Ref<HTMLDivElement>;
  onFocus: () => void;
  onFinish: () => void;
}) {
  if (focused) return <div ref={drawerRef} className="art-ribbon sticker-ribbon is-focused" role="toolbar" aria-label="Focused sticker" onPointerDown={(event) => event.stopPropagation()}>
    <button title="Done: exit focus (F or Enter)" aria-label="Exit focus" aria-keyshortcuts="F Enter" onClick={onFinish}><Check aria-hidden="true" /></button>
  </div>;
  return <div ref={drawerRef} className="art-ribbon sticker-ribbon" role="toolbar" aria-label="Selected sticker" onPointerDown={(event) => event.stopPropagation()}>
    <div className="sticker-adjustment" role="group" aria-label="Sticker size"><div>
      <button title="Shrink sticker by 10 percentage points" aria-label="Shrink sticker by 10 percentage points" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: -.1, rotationDelta: 0 })}><Minimize2 aria-hidden="true" /></button>
      <button title="Grow sticker by 10 percentage points" aria-label="Grow sticker by 10 percentage points" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: .1, rotationDelta: 0 })}><Maximize2 aria-hidden="true" /></button>
    </div></div>
    <div className="sticker-adjustment" role="group" aria-label="Sticker rotation"><div>
      <button title="Rotate sticker left 15 degrees" aria-label="Rotate sticker left 15 degrees" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: 0, rotationDelta: -15 })}><RotateCcw aria-hidden="true" /></button>
      <button title="Rotate sticker right 15 degrees" aria-label="Rotate sticker right 15 degrees" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: 0, rotationDelta: 15 })}><RotateCw aria-hidden="true" /></button>
    </div></div>
    <div className="sticker-adjustment" role="group" aria-label="Flip sticker"><div>
      <button title="Flip horizontally" aria-label="Flip sticker horizontally" onClick={() => bridge.send({ type: 'flip-selection', axis: 'horizontal' })}><FlipVertical2 aria-hidden="true" /></button>
      <button title="Flip vertically" aria-label="Flip sticker vertically" onClick={() => bridge.send({ type: 'flip-selection', axis: 'vertical' })}><FlipHorizontal2 aria-hidden="true" /></button>
    </div></div>
    <div className="sticker-adjustment" role="group" aria-label="Sticker layer order"><div>
      <button title="Move behind the next overlapping sticker" disabled={!order.backward} aria-label="Move behind the next overlapping sticker" onClick={() => bridge.send({ type: 'order-selection', direction: 'backward' })}><LayerOrderIcon direction="backward" /></button>
      <button title="Move in front of the next overlapping sticker" disabled={!order.forward} aria-label="Move in front of the next overlapping sticker" onClick={() => bridge.send({ type: 'order-selection', direction: 'forward' })}><LayerOrderIcon direction="forward" /></button>
    </div></div>
    <button title="Focus on this sticker (F)" aria-label="Focus on this sticker (F)" onClick={onFocus}><ScanSearch aria-hidden="true" /></button>
    <button className="selection-desktop-action" title="Duplicate (Ctrl/Cmd+D)" aria-keyshortcuts="Control+D Meta+D" aria-label="Duplicate" onClick={() => bridge.send({ type: 'duplicate-selection' })}><Copy aria-hidden="true" /></button>
    <button title="Delete (Del)" aria-keyshortcuts="Delete" aria-label="Delete" onClick={() => bridge.send({ type: 'delete-selection' })}><Trash2 aria-hidden="true" /></button>
    <button className="selection-desktop-action" title="Done" onClick={onFinish} aria-label="Finish selecting"><Check aria-hidden="true" /></button>
  </div>;
}
