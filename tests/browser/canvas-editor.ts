import { CanvasEditor } from '../../src/canvas/CanvasEditor';
import { CanvasViewport } from '../../src/canvas/CanvasViewport';
import { createEditorBridge } from '../../src/editor/bridge';
import { prepareStickers } from '../../src/editor/vectorStickers';
import type { SavedPicture } from '../../src/editor/savedPicture';

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }

/** Exercise the real browser adapter as well as the engine-only regressions. */
export async function checkCanvasEditor() {
  const workspace = document.createElement('section');
  workspace.className = 'art-canvas';
  Object.assign(workspace.style, { position: 'fixed', inset: '0', width: '360px', height: '240px', zIndex: '100', display: 'block' });
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'relative', width: '360px', height: '240px' });
  workspace.append(host); document.body.append(workspace);
  const bridge = createEditorBridge();
  let renders = 0, saved: SavedPicture | undefined;
  const original = CanvasViewport.prototype.render;
  CanvasViewport.prototype.render = function(...args) { renders++; return original.apply(this, args); };
  let editor: CanvasEditor | undefined;
  const snapshot = () => new Promise<SavedPicture>(resolve => bridge.send({ type: 'snapshot', onComplete: resolve }));
  const pointer = (type: string, x: number, y: number, buttons = 1, id = 7) => {
    const box = host.getBoundingClientRect();
    host.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, button: 0, buttons, clientX: box.left + x, clientY: box.top + y }));
  };
  try {
    editor = new CanvasEditor(host, bridge, { id: 'adapter-test', title: 'Adapter test', format: 'landscape', size: { width: 180, height: 120 }, background: '#ffffff', leafColor: 0 }, picture => { saved = picture; });
    await frame(); await frame();
    await new Promise(resolve => setTimeout(resolve, 100));
    const initial = renders;
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(renders === initial, 'Idle editor must not keep rendering');
    bridge.send({ type: 'set-tool', tool: 'brush' });
    bridge.send({ type: 'set-color', color: 0xcc2222 });
    pointer('pointerdown', 40, 40);
    for (let i = 0; i < 12; i++) pointer('pointermove', 40 + i * 4, 40);
    pointer('pointerup', 90, 40, 0);
    await frame();
    assert(renders - initial === 1, 'Synchronous pointer samples should coalesce into one frame');
    const painted = await snapshot();
    assert(painted.document.surfaces[0]!.vectorPaint!.regions[0]!.blobs.length > 0, 'Pointer stroke must paint');
    const ctx = host.querySelector('canvas')!.getContext('2d')!;
    const density = devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(50 * density), Math.round(40 * density), 1, 1).data;
    assert(pixel[0]! > pixel[1]! * 2, 'Painting and display coordinates must agree at 2x zoom');
    bridge.send({ type: 'undo' });
    const undone = await snapshot();
    assert(!undone.document.surfaces[0]!.vectorPaint?.regions.length, 'Undo must restore blank paper');
    pointer('pointerdown', 80, 80); pointer('pointermove', 100, 90); pointer('pointercancel', 100, 90, 0);
    assert(!(await snapshot()).document.surfaces[0]!.vectorPaint?.regions.length, 'Cancelled input must roll back');
    pointer('pointerdown', 40, 80);pointer('pointermove', 100, 80);
    await new Promise(resolve=>setTimeout(resolve,350));
    const settledInk=renders;await new Promise(resolve=>setTimeout(resolve,80));
    assert(renders===settledInk,'Paused ink must settle and stop rendering before release');
    pointer('pointerup',100,80,0);bridge.send({type:'undo'});
    bridge.send({ type: 'set-brush', options: { kind: 'spray' , size: 24, shape: 'round' } });
    pointer('pointerdown', 70, 70);
    await new Promise(resolve => setTimeout(resolve, 110));
    pointer('pointerup', 70, 70, 0);
    assert((await snapshot()).document.surfaces[0]!.vectorPaint!.regions.length > 0, 'Stationary spray must animate');
    const afterSpray = renders; await frame(); await frame();
    const idleSpray = renders; await new Promise(resolve => setTimeout(resolve, 80));
    assert(renders === idleSpray && idleSpray >= afterSpray, 'Released spray must return to idle');
    await prepareStickers(['fantasy-moon-sorceress']);
    bridge.send({ type: 'add-sticker', sticker: 'fantasy-moon-sorceress', point: { x: 90, y: 60 }, outlineColor: 0x242428 });
    await frame();
    const added = await snapshot();
    assert(added.document.surfaces.length === 2, 'Sticker insertion must survive adapter replacement');
    await new Promise<void>((resolve,reject)=>bridge.send({ type: 'save', onComplete: ok => ok?resolve():reject(Error('Save failed')) }));
    assert(saved?.document.surfaces.length === 2, 'Save port must receive the document');
    // Extreme zoom must allocate only the visible workspace, not a page-sized backing.
    host.style.width = '3600px'; host.style.height = '2400px'; host.style.left = '-1200px';
    editor.invalidate(); await frame(); await frame();
    const canvas = host.querySelector('canvas')!;
    assert(canvas.width <= Math.ceil(360 * density) && canvas.height <= Math.ceil(240 * density), 'Zoom backing must remain viewport bounded');
    editor.destroy(); editor = undefined;
    assert(!host.querySelector('canvas'), 'Destroy must remove the display');
    const beforeDestroyed = renders;
    bridge.send({ type: 'undo' }); pointer('pointerdown', 20, 20); await frame();
    assert(renders === beforeDestroyed, 'Destroyed editor must unsubscribe from input and commands');
    return { idleRendering: false, coalescedInput: true, zoomCoordinates: true, cancelledStroke: true, stationarySpray: true, savedSticker: true, viewportBounded: true, cleanup: true };
  } finally {
    editor?.destroy(); CanvasViewport.prototype.render = original; workspace.remove();
  }
}
