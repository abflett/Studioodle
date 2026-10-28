import { CanvasEditor } from '../../src/canvas/CanvasEditor';
import { createEditorBridge } from '../../src/editor/bridge';
import { prepareStickers } from '../../src/editor/vectorStickers';
import type { SavedPicture } from '../../src/editor/savedPicture';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
export async function checkSelectionExit() {
  await prepareStickers(['circle']);
  const workspace = document.createElement('section'), host = document.createElement('div');
  workspace.className = 'art-canvas';
  Object.assign(workspace.style, { position: 'fixed', inset: '0', width: '500px', height: '400px' });
  Object.assign(host.style, { position: 'absolute', left: '50px', top: '50px', width: '400px', height: '300px' });
  workspace.append(host); document.body.append(workspace);
  const bridge = createEditorBridge();
  let selected: string | undefined, tool = '', writes = 0;
  bridge.onSelection(id => { selected = id; }); bridge.onTool(value => { tool = value; });
  const editor = new CanvasEditor(host, bridge, { id: 'selection-test', title: 'Selection', format: 'landscape', size: { width: 400, height: 300 }, background: '#ffffff', leafColor: 0,
    document: { version: 6, width: 400, height: 300, surfaces: [
      { id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff },
      { id: 'first', kind: 'circle', x: 100, y: 100, scale: .15, color: 0 },
      { id: 'second', kind: 'circle', x: 300, y: 100, scale: .15, color: 0 },
    ] },
  }, () => { writes++; }, true);
  const pointer = (target: HTMLElement, type: string, x: number, y: number) => {
    const box = host.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: box.left + x, clientY: box.top + y }));
  };
  const click = (target: HTMLElement, x: number, y: number) => { pointer(target, 'pointerdown', x, y); pointer(target, 'pointerup', x, y); };
  try {
    bridge.send({ type: 'set-tool', tool: 'select' });
    click(host, 100, 100); assert(selected === 'first', 'Clicking a sticker must select it');
    const bounds = Reflect.get(editor, 'session').state.bounds;
    click(host, bounds.x - 2, bounds.y + bounds.height / 2);
    assert(selected === 'first' && tool === 'select', 'Inside the selection border must retain the selected sticker');
    click(host, 300, 100); assert(String(selected) === 'second' && tool === 'select', 'Another sticker must switch selection directly');
    click(host, 200, 250); assert(!selected && String(tool) === 'bucket', 'Empty page must clear selection and return to Fill');
    bridge.send({ type: 'set-tool', tool: 'select' });
    click(host, 100, 100); assert(String(selected) === 'first', 'Select must work again after exiting');
    pointer(host, 'pointerdown', 200, 250); pointer(host, 'pointercancel', 200, 250);
    assert(String(selected) === 'first' && String(tool) === 'select', 'Canceled outside press must restore selection');
    click(workspace, -25, 100); assert(!selected && String(tool) === 'bucket', 'Surrounding workspace must also exit selection');
    const picture = await new Promise<SavedPicture>(resolve => bridge.send({ type: 'snapshot', onComplete: resolve }));
    assert(picture.document.surfaces.every(surface => !surface.vectorPaint?.regions.length), 'Exiting selection must not paint or fill');
    assert(writes === 0, 'Selection-only interactions must not autosave');
    return { switchSticker: true, emptyPage: true, workspace: true, reusablePointer: true, noPaint: true };
  } finally { editor.destroy(); workspace.remove(); }
}
