import { stickerRasterSettings } from '../../src/editor/stickerRasterSettings';
import { Artwork } from '../../src/editor/Artwork';
import { decodeSvgDefinition } from '../../src/editor/svgDefinition';
import { drawVectorInk } from '../../src/editor/vectorDefinition';
import type { ArtworkDocument } from '../../src/editor/document';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const rectangle = 'M10 10H30V30H10Z';
const fixture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" data-bounds="8 8 43 43" data-region-format="1" data-region-scale="4"><g id="regions"><path id="region-1" data-bounds="10 10 30 30" d="${rectangle}"/></g><g id="ink"><path d="${rectangle}" fill="none" stroke="black" stroke-width="4"/><path d="M38 38H42V42H38Z" fill="black" stroke="none" stroke-width="0"/></g></svg>`;

/** Browser-only regression: real Path2D, antialiasing, hit maps and bucket edits. */
export async function checkRegionCoverage() {
  const definition = decodeSvgDefinition(fixture);
  assert(definition.regionAt(8.5, 20) === 0, 'Ink hit coverage must not enlarge paint regions');
  assert(definition.contains(8.5, 20) && definition.hitRegionAt?.(8.5, 20) === 1, 'Outer stroke must resolve to its region');
  assert(!definition.contains(5, 20), 'Hit coverage must not expand outside actual ink');
  assert(definition.contains(40, 40) && definition.hitRegionAt?.(40, 40) === 0, 'Isolated ink must be owned without inventing a paint region');
  const highestId = decodeSvgDefinition(fixture.replace('region-1', 'region-65535'));
  assert(highestId.hitRegionAt?.(8.5, 20) === 65535, 'Ink marker must not overflow maximum region IDs');
  const clipped = decodeSvgDefinition(fixture.replace('<g id="ink">', '<defs><clipPath id="left"><path d="M0 0H35V50H0Z"/></clipPath></defs><g id="ink" clip-path="url(#left)">'));
  assert(!clipped.contains(40, 40), 'Invisible clipped ink must not receive hits');
  const doc: ArtworkDocument = { version: 3, width: 200, height: 200, surfaces: [
    { id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] },
    { id: 'sticker', kind: 'circle', x: 100, y: 100, scale: 4, color: 0, paint: [] },
  ] };
  const art = Artwork.restore(doc, () => definition);
  assert(art.fill({ x: 34, y: 80 }, 0x743dad), 'Bucket on outer line must color the sticker');
  assert(!art.serialize().surfaces[0]!.paint.length && art.serialize().surfaces[1]!.paint.length, 'Line click must never fill the page');
  assert(!art.fill({ x: 160, y: 160 }, 0xabcdef), 'Unfillable isolated ink must block click-through');
  assert(!art.serialize().surfaces[0]!.paint.length, 'Isolated ink must not fill the page');
  const transformed = structuredClone(doc);
  Object.assign(transformed.surfaces[1]!, { rotation: 90, flipX: true });
  const rotated = Artwork.restore(transformed, () => definition);
  assert(rotated.fill({ x: 120, y: 166 }, 0x743dad), 'Rotated/flipped outlines must resolve in local coordinates');
  assert(!rotated.serialize().surfaces[0]!.paint.length, 'Transformed line click must not fill the page');
  // Regress enlarged bucket edges, rather than checking hit coverage alone.
  const diagonalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" data-bounds="10 10 40 40" data-region-format="1" data-region-scale="4"><g id="regions"><path id="region-1" data-bounds="10 10 40 40" d="M10 10L40 40H10Z"/><path id="region-2" data-bounds="10 10 40 40" d="M10 10H40V40Z"/></g><g id="ink"><path d="M10 10L40 40" fill="none" stroke="black" stroke-width="0.1"/></g></svg>`;
  const diagonal = decodeSvgDefinition(diagonalSvg);
  const enlargedDoc = structuredClone(doc);
  enlargedDoc.width = enlargedDoc.height = 800;
  Object.assign(enlargedDoc.surfaces[1]!, { x: 400, y: 400, scale: 16 });
  const enlarged = Artwork.restore(enlargedDoc, () => diagonal);
  assert(enlarged.fill({ x: 320, y: 480 }, 0x743dad), 'Diagonal fixture must fill');
  const rendered = document.createElement('canvas'); rendered.width = rendered.height = 800;
  const renderedContext = rendered.getContext('2d')!;
  enlarged.render(renderedContext);
  const reference = document.createElement('canvas'); reference.width = reference.height = 800;
  const referenceContext = reference.getContext('2d')!;
  referenceContext.fillStyle = 'white'; referenceContext.fillRect(0, 0, 800, 800);
  referenceContext.scale(16, 16);
  for (const region of diagonal.regions!) {
    referenceContext.fillStyle = region.id === 1 ? '#743dad' : 'white';
    referenceContext.fill(region.path);
  }
  drawVectorInk(referenceContext, diagonal, 'black');
  const actual = renderedContext.getImageData(0, 0, 800, 800).data;
  const expected = referenceContext.getImageData(0, 0, 800, 800).data;
  let edgeMismatches = 0;
  // Stay inside the outer silhouette; include both sides of the diagonal.
  for(let y=180;y<620;y++)for(let x=Math.max(180,y-8);x<Math.min(620,y+8);x++){
    const i=(y*800+x)*4;
    if([0,1,2].some(channel=>Math.abs(actual[i+channel]!-expected[i+channel]!)>3))edgeMismatches++;
  }
  assert(edgeMismatches === 0, `Enlarged solid fill differs from SVG reference at ${edgeMismatches} edge pixels`);
  const rows = [];
  for (const id of ['fantasy-moon-sorceress', 'winter-reindeer', 'garden-house', 'garden-fence', 'dinosaur-striped-tyrannosaurus', 'horizons-forest-clearing']) {
    const response = await fetch(`/src/assets/vector/${id}.svg`);
    assert(response.ok, `Missing ${id}`);
    const settings = stickerRasterSettings(id);
    const vector = decodeSvgDefinition(await response.text(), { scale: settings?.lookupScale });
    vector.rasterOnly = settings?.rasterOnly;
    const scale = vector.mapSize!.scale;
    const canvas = document.createElement('canvas');
    canvas.width = vector.mapSize!.width; canvas.height = vector.mapSize!.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.scale(scale, scale); drawVectorInk(context, vector, 'black');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visibleInk = 0, missingHits = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3]! <= 128) continue;
      visibleInk++;
      if (!vector.contains((x + .5) / scale, (y + .5) / scale)) missingHits++;
    }
    assert(!missingHits, `${id}: ${missingHits} visible ink pixels click through`);
        let paintPixels = 0;
    if(settings) {
      const trialDoc = structuredClone(doc);
      trialDoc.width=800;trialDoc.height=1000;
      Object.assign(trialDoc.surfaces[1]!, {kind:id,x:400,y:500,scale:1});
      const trial = Artwork.restore(trialDoc, () => vector);
      let seed: {x:number;y:number}|undefined;
      for(let y=100;y<380&&!seed;y++)for(let x=80;x<260;x++)if(vector.regionAt(x,y)){
        seed={x:400+x-170,y:500+y-240};break;
      }
      assert(seed, 'Moon trial needs a paintable seed');
      assert(trial.fill(seed,0x743dad),'High-resolution Moon bucket must work');
      assert(trial.brush(seed,seed,0x42aadd,false,{size:3,kind:'ink',shape:'round'}),'High-resolution Moon brush must work');
      const saved=trial.serialize().surfaces[1]!;
      assert(saved.paintScale===8,'Moon must retain 8x paint density after brushing');
      const colors=new Set(saved.paint.map(run=>run[2]));
      assert(colors.has(0x743dad)&&colors.has(0x42aadd),'Both bucket and brush colors must remain raster');
      const preview=document.createElement('canvas');preview.width=800;preview.height=1000;
      trial.render(preview.getContext('2d')!);
      paintPixels=Math.ceil(vector.width*12.5)*Math.ceil(vector.height*12.5);
    }
    rows.push({ id, visibleInk, missingHits, lookupScale: scale, sharedBytes: vector.typedArrayBytes, paintPixels });
    canvas.width = canvas.height = 1;
  }
  return { enlargedFillEdges: true, lineFill: true, isolatedInkBlocksPage: true, paintSilhouetteUnchanged: true, rows };
}
