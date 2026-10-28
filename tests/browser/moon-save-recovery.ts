import { EditorSession } from '../../src/editor/EditorSession';
import { Artwork } from '../../src/editor/Artwork';
import { prepareStickers, vectorDefinition } from '../../src/editor/vectorStickers';
import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import polygons from '../../src/editor/polygonGeometry';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';
import type { SavedPicture } from '../../src/editor/savedPicture';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }

/** Colored complex sticker: editing never writes; save compacts once, reopening stays read-only. */
export async function checkMoonSaveRecovery() {
  await prepareStickers(['fantasy-moon-sorceress']);
  const vector = vectorDefinition('fantasy-moon-sorceress'), { width, height } = vector;
  const colors = [0x8f519d, 0x63aacc, 0xd5ad63, 0xab4567];
  const regions = vector.regions.map((region, index) => {
    const [left, top, right, bottom] = region.bounds as [number, number, number, number];
    const geometry = index % 4 === 0 && right - left > 4 && bottom - top > 4
      ? polygons.intersection(region.geometry!(), rectangleGeometry(left, top, (left + right) / 2, bottom)) : [];
    return { id: region.id, base: colors[index % 4]!, blobs: geometry.length ? [{ color: colors[(index + 1) % 4]!, geometry }] : [] };
  });
  const picture: SavedPicture = { id: 'moon-regression', version: 5, title: 'Colored Moon Sorceress', updatedAt: 1,
    format: 'portrait', size: { width, height }, background: '#ffffff', leafColor: 0x242428,
    document: { version: 5, width, height, surfaces: [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff },
      { id: 'moon', kind: 'fantasy-moon-sorceress', x: Math.floor(width / 2), y: Math.floor(height / 2), color: 0x242428, vectorPaint: { version: 1, regions } }] },
  };
  const name = 'studioodle-moon-save-'+crypto.randomUUID(), repository = createIndexedPictureRepository(name);
  let writes = 0;
  const session = new EditorSession(picture, { save: async saved => { await repository.save(saved); writes++; }, changed() {} });
  const start = performance.now();
  try {
    session.execute({ type: 'set-tool', tool: 'brush' });
    for (let action = 0; action < 16; action++) {
      session.execute({ type: 'set-color', color: colors[action % 4]! });
      const y = height * (.25 + action * .025);
      session.begin({ x: width * .44, y }, action + 1, 0);
      for (let sample = 1; sample <= 12; sample++) session.move({ x: width * (.44 + sample * .008), y: y + Math.sin(sample * .4) * 2 }, action + 1, true, 1);
      session.release({ x: width * .536, y }, action + 1, 1);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const inputMs = performance.now() - start;
    assert(writes === 0, 'Painting must not trigger per-action storage writes');
    await new Promise<void>((resolve, reject) => session.execute({ type: 'save', onComplete: ok => ok ? resolve() : reject(Error('Moon save failed')) }));
    assert(Number(writes) === 1, 'One explicit save should write once');
    await new Promise<void>(resolve => session.execute({ type: 'save', onComplete: () => resolve() }));
    assert(Number(writes) === 1, 'Unchanged drawings must not be rewritten');
    const loads: number[] = [], canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 400;
    for (let i = 0; i < 3; i++) {
      const at = performance.now(), saved = (await repository.get(picture.id))!;
      const artwork = Artwork.restore(saved.document), ctx = canvas.getContext('2d')!;
      ctx.setTransform(300 / width, 0, 0, 400 / height, 0, 0); artwork.render(ctx, true); artwork.dispose();
      loads.push(performance.now() - at);
      assert(saved.document.surfaces[1]!.vectorPaint!.regions.length === regions.length, 'Colored regions must survive save/reopen');
    }
    return { regions: regions.length, writes, inputMs, loadRenderMs: loads };
  } finally {
    session.dispose();
    await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  }
}
