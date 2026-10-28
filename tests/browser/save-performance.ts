import { EditorSession } from '../../src/editor/EditorSession';
import { createPictureSaveQueue } from '../../src/app/pictureSaveQueue';
import { prepareStickers } from '../../src/editor/vectorStickers';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';
import type { SavedPicture } from '../../src/editor/savedPicture';

export async function profileSavePerformance() {
  await prepareStickers(['circle']);
  const picture: SavedPicture = { id: 'save-profile', version: 6, title: 'Save profile', updatedAt: 1,
    format: 'landscape', size: { width: 400, height: 300 }, background: '#ffffff', leafColor: 0,
    document: { version: 6, width: 400, height: 300, surfaces: [
      { id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff, vectorPaint: { version: 1, regions: [
        { id: 1, base: 0xffffff, blobs: Array.from({ length: 320 }, (_, i) => ({ color: i % 2 ? 0x224488 : 0xaa5533, geometry: rectangleGeometry(i % 80 * 4, Math.floor(i / 80) * 50, i % 80 * 4 + 3, Math.floor(i / 80) * 50 + 40) })) },
      ] } },
      { id: 'sticker', kind: 'circle', x: 200, y: 150, scale: .5, color: 0 },
    ] },
  };
  let jobs = 0, regions = 0, writes = 0;
  const original = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function(message: unknown, options?: Transferable[] | StructuredSerializeOptions) {
    if (message && typeof message === 'object' && 'regions' in message && Array.isArray(message.regions)) { jobs++; regions += message.regions.length; }
    return Reflect.apply(original, this, [message, options]);
  };
  const saves = createPictureSaveQueue(async () => { writes++; });
  const session = new EditorSession(picture, { save: saves.enqueue, autoSave: true, changed() {} });
  let brush: EditorSession | undefined;
  const durations: number[] = [], start = performance.now();
  try {
    session.execute({ type: 'set-tool', tool: 'select' });
    session.begin({ x: 200, y: 150 }, 1, 0); session.release({ x: 200, y: 150 }, 1, 1);
    for (let i = 0; i < 8; i++) {
      const before = performance.now();
      session.execute({ type: 'flip-selection', axis: 'horizontal' });
      durations.push(performance.now() - before);
      if (!await saves.flush()) throw Error('Save profile did not commit.');
    }
    if (writes !== 8 || jobs !== 1) throw Error(`Eight edits should save eight times and compact unchanged paint once (writes=${writes}, jobs=${jobs}).`);
    const geometry = { edits: 8, writes, jobs, regions, totalMs: performance.now() - start, maxDispatchMs: Math.max(...durations) };
    brush = new EditorSession({ ...picture, id: 'brush-save-profile', document: { version: 6, width: 400, height: 300, surfaces: [{ id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0xffffff }] } }, { save: saves.enqueue, autoSave: true, changed() {} });
    brush.execute({ type: 'set-tool', tool: 'brush' });
    brush.begin({ x: 10, y: 10 }, 2, 0); brush.move({ x: 80, y: 80 }, 2, true, 1); brush.release({ x: 80, y: 80 }, 2, 1);
    await saves.flush(); await brush.artwork.compactPaint();
    const brushJobs = jobs - geometry.jobs;
    if (brushJobs !== 1) throw Error(`Live maintenance duplicated the save's brush job (${brushJobs} jobs).`);
    return { ...geometry, brushJobs };
  } finally { Worker.prototype.postMessage = original; session.dispose(); brush?.dispose(); await saves.flush(); }
}
