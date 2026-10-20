import baseline from './baseline/garden-house.json?raw';
import svg from '../../src/assets/vector/garden-house.svg?raw';
import { decodeRasterDefinition } from './rasterDefinition';
import { rasterizeRegions } from '../../src/editor/rasterizeRegions';
import { decodeSvgDefinition } from '../../src/editor/svgDefinition';
import { drawVectorInk } from '../../src/editor/vectorDefinition';
import type { VectorDefinition } from '../../src/editor/vectorDefinition';
import { prepareStickers, vectorDefinition } from '../../src/editor/vectorStickers';
import { Artwork } from '../../src/editor/Artwork';
import type { ArtworkDocument } from '../../src/editor/document';

const status = document.querySelector<HTMLElement>('#status')!;
const output = document.querySelector<HTMLElement>('#results')!;
const decode = { before: () => decodeRasterDefinition(baseline), direct: () => decodeSvgDefinition(svg, { lookup: 'paths' }), after: () => decodeSvgDefinition(svg) };
let retained: VectorDefinition[] = [];
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function sample(run: () => void, rounds = 15) {
  for (let i = 0; i < 3; i++) run();
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) { const start = performance.now(); run(); times.push(performance.now() - start); }
  times.sort((a, b) => a - b);
  return { medianMs: times[Math.floor(times.length / 2)]!, p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * .95))]! };
}
function colored(def: VectorDefinition, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const paint = document.createElement('canvas'); paint.width = 974; paint.height = 875;
  const pctx = paint.getContext('2d')!, pixels = pctx.createImageData(paint.width, paint.height);
  for (let y = 0; y < paint.height; y++) for (let x = 0; x < paint.width; x++) {
    const id = def.regionAt(x * 96 / 150, y * 96 / 150); if (!id) continue;
    const offset = (y * paint.width + x) * 4;
    pixels.data.set([70 + id * 73 % 170, 70 + id * 103 % 170, 70 + id * 37 % 170, 255], offset);
  }
  pctx.putImageData(pixels, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.clip(def.silhouette);
  ctx.drawImage(paint, 0, 0, def.width, def.height); ctx.restore(); drawVectorInk(ctx, def, '#111111');
}
function fixture(): ArtworkDocument {
  return { version: 3, horizonLayout: 2, width: 647, height: 584, surfaces: [
    { id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
    { id: 'house', kind: 'garden-house', x: 323.5, y: 292, color: 0, scale: 1, paint: [] },
  ] };
}
function accuracy(before: VectorDefinition, after: VectorDefinition, draw = true) {
  const canvas = document.querySelector<HTMLCanvasElement>('#difference')!, ctx = canvas.getContext('2d')!, image = ctx.createImageData(canvas.width, canvas.height);
  const seen = new Set<number>(); let differences = 0, interiorDifferences = 0, paintable = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const lx = x * 96 / 150, ly = y * 96 / 150, a = before.regionAt(lx, ly), b = after.regionAt(lx, ly);
    if (b) seen.add(b); if (a) paintable++;
    if (a !== b) {
      differences++; const offset = (y * canvas.width + x) * 4; image.data.set([220, 35, 65, 255], offset);
      // A disagreement more than one analysis pixel from a region edge is material.
      if ([[-.5, -.5], [-.5, 0], [-.5, .5], [0, -.5], [0, .5], [.5, -.5], [.5, 0], [.5, .5]].every(([dx, dy]) => before.regionAt(lx + dx!, ly + dy!) === a)) interiorDifferences++;
    }
  }
  if (draw) ctx.putImageData(image, 0, 0);
  return { samples: canvas.width * canvas.height, baselinePaintableSamples: paintable, differingRegionSamples: differences, interiorDifferences, svgRegionIdsSeenAtPaintResolution: seen.size };
}
async function benchmark() {
  status.textContent = 'Running locally; please leave this tab active.'; await nextFrame();
  await prepareStickers(['garden-house']);
  const runtime = vectorDefinition('garden-house');
  if (runtime.format !== 'svg' || runtime.lookup !== 'raster' || runtime.regionCount !== 90) throw new Error('Application did not select the SVG pilot');
  const before = decode.before(), direct = decode.direct(), after = decode.after();
  colored(before, document.querySelector<HTMLCanvasElement>('#before')!);
  colored(after, document.querySelector<HTMLCanvasElement>('#after')!);
  const quality = { baselineVsRaster: accuracy(before, after), directPathsVsRaster: accuracy(direct, after, false) };
  let seed = 12345; const points = Array.from({ length: 10000 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed / 2 ** 32 * before.width;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return { x, y: seed / 2 ** 32 * before.height };
  });
  const rows: Record<string, unknown> = {};
  for (const [name, def] of Object.entries({ before, direct, after })) {
    const canvas = document.createElement('canvas'); canvas.width = 623; canvas.height = 560; const ctx = canvas.getContext('2d')!;
    const doc = fixture(); const artwork = Artwork.restore(doc, () => def);
    const regionSeed = points.find(p => def.regionAt(p.x, p.y) === 1) ?? points.find(p => def.regionAt(p.x, p.y) > 0)!;
    let color = 0;
    rows[name] = {
      format: def.format, lookup: def.lookup, mapSize: def.mapSize, regionCount: def.regionCount, decodedMapArrayBytes: def.typedArrayBytes,
      decode: sample(() => { decode[name as keyof typeof decode](); }),
      regionQueries10000: sample(() => { for (const p of points) def.regionAt(p.x, p.y); }),
      hitQueries10000: sample(() => { for (const p of points) def.contains(p.x, p.y); }),
      fullArtworkRender: sample(() => { artwork.render(ctx); ctx.getImageData(0, 0, 1, 1); }),
      // Include ownership construction on a new artwork, then one fill.
      firstBucketFill: sample(() => { const fresh = Artwork.restore(doc, () => def); fresh.fill({ x: regionSeed.x + 12, y: regionSeed.y + 12 }, 0xff7700); }, 5),
      repeatedBucketFill: sample(() => { color = color === 0x5599ee ? 0xee9955 : 0x5599ee; artwork.fill({ x: regionSeed.x + 12, y: regionSeed.y + 12 }, color); }),
      brushStroke: sample(() => { color ^= 0xffffff; artwork.brush({ x: 220, y: 260 }, { x: 340, y: 320 }, color); }),
    };
    await nextFrame();
  }
  const checks: Record<string, boolean> = {};
  await prepareStickers(['garden-house']);
  checks.sharedCachedDefinition = runtime === vectorDefinition('garden-house');
  checks.runtimeUsesArray = runtime.lookup === 'raster' && runtime.typedArrayBytes > 0;
  const rectA = new Path2D(); rectA.rect(1, 1, 5, 5);
  const rectB = new Path2D(); rectB.rect(3, 3, 6, 6);
  const ids = rasterizeRegions([{ id: 1, path: rectA, bounds: [1, 1, 6, 6] }, { id: 255, path: rectB, bounds: [3, 3, 9, 9] }], 10, 10, 2);
  checks.overlapPreservesFirstId = ids.regionAt(4, 4) === 1 && ids.regionAt(8, 8) === 255;
  checks.outsideIsZero = ids.regionAt(-1, 1) === 0 && ids.regionAt(10, 1) === 0 && !ids.contains(0, 0) && !ids.inRegion(0, 0, 0);
  checks.smallIdsUseOneByte = ids.typedArrayBytes === 400;
  const wide = rasterizeRegions([{ id: 300, path: rectA, bounds: [1, 1, 6, 6] }], 10, 10, 2);
  checks.largeIdsUseTwoBytes = wide.typedArrayBytes === 800 && wide.regionAt(2, 2) === 300;
  const hole = new Path2D(); hole.rect(1, 1, 8, 8); hole.moveTo(3, 3); hole.lineTo(3, 7); hole.lineTo(7, 7); hole.lineTo(7, 3); hole.closePath();
  const holes = rasterizeRegions([{ id: 7, path: hole, bounds: [1, 1, 9, 9] }], 10, 10, 2);
  checks.holesRemainOutside = holes.regionAt(2, 2) === 7 && holes.regionAt(4, 4) === 0;
  let validIds = true;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (![0, 1, 255].includes(ids.regionAt(x / 2, y / 2))) validIds = false;
  checks.noBlendedRegionIds = validIds;
  for (const [name, def] of Object.entries({ before, direct, after })) {
    const doc = Artwork.restore(fixture(), () => def);
    const point = points.find(p => def.regionAt(p.x, p.y) > 0)!;
    checks[`${name}:fill`] = doc.fill({ x: point.x + 12, y: point.y + 12 }, 0x3355ff);
    const snapshot = doc.serialize();
    checks[`${name}:saveRestore`] = JSON.stringify(snapshot) === JSON.stringify(Artwork.restore(snapshot, () => def).serialize());
    checks[`${name}:flip`] = doc.flip('house', 'horizontal');
    checks[`${name}:transform`] = doc.transform('house', -.1, 90);
    const copy = doc.duplicate('house');
    checks[`${name}:duplicate`] = !!copy && doc.serialize().surfaces.length === 3;
    const canvas = document.createElement('canvas'); canvas.width = 647; canvas.height = 584;
    doc.render(canvas.getContext('2d')!); checks[`${name}:pngRender`] = canvas.toDataURL().length > 100;
    doc.remove(copy!); checks[`${name}:remove`] = doc.serialize().surfaces.length === 2;
    doc.setFocus('house'); checks[`${name}:focusRejectsOutsidePaint`] = !doc.brush({ x: 0, y: 0 }, { x: 2, y: 2 }, 0xff00ff);
  }
  if (Object.values(checks).some(passed => !passed)) throw new Error(`Artwork checks failed: ${JSON.stringify(checks)}`);
  const result = { applicationFormat: runtime.format, applicationLookup: runtime.lookup, checks, environment: navigator.userAgent, quality, measurements: rows, notes: ['Timings use warm-up, median and p95; this is a local CPU benchmark, not a network test.', 'Map array bytes exclude native Path2D storage and paint/canvas memory, which remain in both methods.', 'Ownership at the outer half of ink differs: SVG selection uses the union of paint regions.'] };
  output.textContent = JSON.stringify(result, null, 2); status.textContent = 'Complete. Region colors are deterministic by ID; red marks show disagreements.';
  return result;
}
Object.assign(window, { runHouseBenchmark: benchmark, retainHouseDefinitions: (mode: 'before' | 'direct' | 'after' | 'none', count = 1) => { retained = mode === 'none' ? [] : Array.from({ length: count }, () => decode[mode]()); return retained.length; } });
document.querySelector<HTMLButtonElement>('#run')!.onclick = () => { void benchmark().catch(error => { status.textContent = String(error); }); };
