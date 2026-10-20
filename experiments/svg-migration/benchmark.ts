import baseline from './baseline.json';
import { decodeRasterDefinition } from '../garden-house/rasterDefinition';
import { decodeSvgDefinition } from '../../src/editor/svgDefinition';
import { drawVectorInk } from '../../src/editor/vectorDefinition';
import type { VectorDefinition } from '../../src/editor/vectorDefinition';
import { prepareStickers, vectorDefinition, releaseStickerDefinitions } from '../../src/editor/vectorStickers';
import { Artwork } from '../../src/editor/Artwork';
import type { StickerKind, ArtworkDocument } from '../../src/editor/document';

const status = document.querySelector<HTMLElement>('#status')!;
const gallery = document.querySelector<HTMLElement>('#gallery')!;
function image(definition: VectorDefinition, backing: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 180;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const scale = Math.min(232 / definition.width, 172 / definition.height);
  ctx.fillStyle = '#dce8e6'; ctx.fillRect(0, 0, 240, 180);
  ctx.translate((240 - definition.width * scale) / 2, (180 - definition.height * scale) / 2); ctx.scale(scale, scale);
  if (backing) { ctx.fillStyle = 'white'; ctx.fill(definition.silhouette); }
  drawVectorInk(ctx, definition, '#000000');
  return canvas;
}
function pixelDifference(first: HTMLCanvasElement, second: HTMLCanvasElement) {
  const a = first.getContext('2d')!.getImageData(0, 0, first.width, first.height).data;
  const b = second.getContext('2d')!.getImageData(0, 0, second.width, second.height).data;
  let different = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) different++;
  return different;
}
function mapComparison(before: VectorDefinition, after: VectorDefinition) {
  const { width, height, scale } = before.mapSize!;
  const seen = new Uint8Array(before.regionCount + 1); let different = 0, interior = 0;
  let seed: { x: number; y: number } | undefined;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + .5) / scale, py = (y + .5) / scale;
    const a = before.regionAt(px, py), b = after.regionAt(px, py);
    if (b) { seen[b] = 1; seed ??= { x: px, y: py }; }
    if (a !== b) {
      different++;
      if ([[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].every(([dx,dy]) => before.regionAt(px + dx! / scale, py + dy! / scale) === a)) interior++;
    }
  }
  return { samples: width * height, differentSamples: different, interiorDifferences: interior, missingIds: Array.from({ length: before.regionCount }, (_, i) => i + 1).filter(id => !seen[id]), seed };
}
const exercise = new Set(['circle', 'flower', 'garden-house', 'garden-fence', 'winter-reindeer', 'animal-lion', 'space-alien', 'space-spaceship', 'space-crater', 'spring-meadow', 'beach-shore', 'winter-snow']);
function behavior(id: string, definition: VectorDefinition, seed: { x: number; y: number }) {
  const scale = Math.min(1, 600 / definition.width, 500 / definition.height);
  const doc: ArtworkDocument = { version: 3, horizonLayout: 2, width: 640, height: 540, surfaces: [
    { id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
    { id: 'sticker', kind: id as StickerKind, x: 320, y: 270, scale, color: 0, paint: [] },
  ] };
  const artwork = Artwork.restore(doc, () => definition);
  const point = { x: 320 + (seed.x - Math.floor(definition.width / 2)) * scale, y: 270 + (seed.y - Math.floor(definition.height / 2)) * scale };
  // A tiny topmost region can be smaller than a scene pixel; find a visible paint sample.
  let target = point;
  if (!artwork.fill(target, 0x8844ee)) {
    outer: for (let y = 30; y < 510; y += 4) for (let x = 20; x < 620; x += 4)
      if (definition.regionAt((x - 320) / scale + Math.floor(definition.width / 2), (y - 270) / scale + Math.floor(definition.height / 2)) > 0) { target = {x,y}; break outer; }
  }
  const filled = artwork.fill(target, 0x44aa88);
  const saved = artwork.serialize(); const restored = Artwork.restore(saved, () => definition);
  const stable = JSON.stringify(saved) === JSON.stringify(restored.serialize());
  const flip = restored.flip('sticker', 'horizontal'); const transform = restored.transform('sticker', .05, 30);
  const copy = restored.duplicate('sticker'); const duplicated = !!copy && restored.serialize().surfaces.length === 3;
  if (copy) restored.remove(copy);
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 540;
  restored.render(canvas.getContext('2d')!);
  return { filled, saveRestore: stable, flip, transform, duplicated, png: canvas.toDataURL().length > 100 };
}
async function run() {
  gallery.replaceChildren(); const rows = [];
  for (const entry of baseline.assets) {
    status.textContent = `Checking ${entry.id} (${rows.length + 1}/${baseline.assets.length})`;
    const oldText = await (await fetch(`/work/svg-migration/baseline/${entry.id}.json`)).text();
    const text = await (await fetch(`/src/assets/vector/${entry.id}.svg`)).text();
    let start = performance.now(); const before = decodeRasterDefinition(oldText); const beforeDecodeMs = performance.now() - start;
    start = performance.now(); decodeSvgDefinition(text); const afterDecodeMs = performance.now() - start;
    await prepareStickers([entry.id as StickerKind]);
    const after = vectorDefinition(entry.id as StickerKind);
    if (after.format !== 'svg' || after.lookup !== 'raster') throw new Error(`Wrong runtime format: ${entry.id}`);
    await prepareStickers([entry.id as StickerKind]);
    if (after !== vectorDefinition(entry.id as StickerKind)) throw new Error(`Definition not shared: ${entry.id}`);
    const compare = mapComparison(before, after);
    const oldInk = image(before, false), newInk = image(after, false);
    const oldImage = image(before, true), newImage = image(after, true);
    const article = document.createElement('article'); const title = document.createElement('h3'); title.textContent = `${entry.id}: ${after.regionCount} regions`;
    article.append(title, oldImage, newImage); gallery.append(article);
    const checks = exercise.has(entry.id) && compare.seed ? behavior(entry.id, after, compare.seed) : undefined;
    rows.push({ id: entry.id, regionCount: after.regionCount, beforeDecodeMs, afterDecodeMs, beforeMapBytes: before.typedArrayBytes, afterMapBytes: after.typedArrayBytes,
      inkPixelDifferences: pixelDifference(oldInk, newInk), previewPixelDifferences: pixelDifference(oldImage, newImage), comparison: compare, checks });
    releaseStickerDefinitions();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  const failures = rows.filter(row => row.inkPixelDifferences !== 0 || row.comparison.missingIds.length || row.regionCount !== baseline.assets.find(a => a.id === row.id)!.regionCount || row.checks && Object.values(row.checks).some(passed => !passed));
  const result = { environment: navigator.userAgent, totalAssets: rows.length, totalRegions: rows.reduce((n,r) => n+r.regionCount,0), failures: failures.map(r => r.id), rows };
  document.querySelector('#result')!.textContent = JSON.stringify(result, null, 2); status.textContent = failures.length ? `Failed: ${failures.map(r=>r.id).join(', ')}` : 'All assets retain their regions and pass behavior checks.';
  return result;
}
Object.assign(window, { runLibraryBenchmark: run });
document.querySelector<HTMLButtonElement>('#run')!.onclick = () => { void run().catch(error => { status.textContent = String(error); }); };
