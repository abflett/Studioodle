import { svgPathGeometry } from './svgPathGeometry';
import { rasterizeRegions } from './rasterizeRegions';
import type { RegionPath } from './rasterizeRegions';
import type { InkCommand, VectorDefinition } from './vectorDefinition';

type Region = RegionPath;
const numbers = (value: string | null) => (value ?? '').trim().split(/[ ,]+/).map(Number);
function path(element: Element) {
  const result = new Path2D();
  const matrix = element.hasAttribute('transform') ? numbers(element.getAttribute('transform')!.replace(/^matrix\(|\)$/g, '')) : [1, 0, 0, 1, 0, 0];
  if (matrix.length !== 6 || !matrix.every(Number.isFinite)) throw new Error('Invalid SVG region transform');
  result.addPath(new Path2D(element.getAttribute('d') ?? ''), new DOMMatrix(matrix));
  return result;
}

// A separate closure scope keeps lazy geometry from retaining the parser document
// through the decoder's other callbacks (notably ink clip lookup).
function region(element:Element,id:number):Region {
  let geometry:ReturnType<typeof svgPathGeometry>|undefined;
  const data=element.getAttribute('d')??'';
  const matrix=element.hasAttribute('transform')?numbers(element.getAttribute('transform')!.replace(/^matrix\(|\)$/g,'')):[1,0,0,1,0,0];
  return {id,path:path(element),bounds:numbers(element.getAttribute('data-bounds')),
    geometry:()=>geometry??=svgPathGeometry(data,matrix)};
}

/** SVG is the transport; painting normally uses a once-built shared lookup array. */
export function decodeSvgDefinition(text: string, options: { scale?: number } = {}): VectorDefinition {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.getAttribute('data-region-format') !== '1') throw new Error('Invalid region SVG');
  const viewBox = numbers(root.getAttribute('viewBox'));
  const bounds = numbers(root.getAttribute('data-bounds'));
  if (viewBox.length !== 4 || bounds.length !== 4) throw new Error('Missing SVG dimensions');
  const regionElements = [...root.querySelectorAll('#regions > path')];
  const explicitIds = new Set(regionElements.map(element => /^region-(\d+)$/.exec(element.id)?.[1]).filter(Boolean).map(Number));
  let nextId = 1;
  const regions: Region[] = regionElements.map(element => {
    const explicit = /^region-(\d+)$/.exec(element.id);
    while (explicitIds.has(nextId)) nextId++;
    return region(element,explicit ? Number(explicit[1]) : nextId++);
  });
  if (!regions.length || regions.some(r => !Number.isInteger(r.id) || r.id <= 0 || r.id > 65535 || r.bounds.length !== 4)) throw new Error('Invalid SVG regions');
  if (new Set(regions.map(region => region.id)).size !== regions.length) throw new Error('Duplicate SVG region IDs');
  const silhouette = new Path2D();
  for (const region of regions) silhouette.addPath(region.path);
  const clipPaths = new Map<string, Path2D>();
  const inkGroup = root.querySelector('#ink');
  const ink: InkCommand[] = [...root.querySelectorAll('#ink path')].map(element => {
    const clips: Path2D[] = [];
    for (let parent: Element | null = element; parent && parent !== inkGroup?.parentElement; parent = parent.parentElement) {
      const clipId = /^url\(#([^)]*)\)$/.exec(parent.getAttribute('clip-path') ?? '')?.[1];
      if (!clipId) continue;
      let clip = clipPaths.get(clipId);
      if (!clip) {
        const clipElement = doc.getElementById(clipId)?.querySelector('path');
        if (!clipElement) throw new Error('Missing SVG ink clip');
        clip = path(clipElement); clipPaths.set(clipId, clip);
      }
      clips.push(clip);
    }
    const matrix = element.hasAttribute('transform') ? numbers(element.getAttribute('transform')!.replace(/^matrix\(|\)$/g, '')) : [1, 0, 0, 1, 0, 0];
    return { path: path(element), fill: element.getAttribute('fill') !== 'none', stroke: element.getAttribute('stroke') !== 'none',
      width: Number(element.getAttribute('stroke-width')) * (Math.abs(matrix[0]!) + Math.abs(matrix[3]!)) / 2, clips };
  });
  const scale = options.scale ?? (root.hasAttribute('data-region-scale') ? Number(root.getAttribute('data-region-scale')) : viewBox[2]! * viewBox[3]! <= 300000 ? 4 : 2);
  const lookup = rasterizeRegions(regions, viewBox[2]!, viewBox[3]!, scale, ink);
  return {
    width: viewBox[2]!, height: viewBox[3]!, bounds: { left: bounds[0]!, top: bounds[1]!, right: bounds[2]!, bottom: bounds[3]! },
    regionCount: regions.length, silhouette, regions, ink, ...lookup,
  };
}
