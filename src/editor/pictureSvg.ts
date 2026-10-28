import { resolveColor } from './colorPalettes';
import { geometryBounds } from './vectorPaintStyles';
import { paperSize } from './document';
import type { SurfaceData, StickerKind } from './document';
import type { EditorSetup } from './setup';
import type { FillOptions } from './toolOptions';
import type { MultiPolygon } from './polygonGeometry';
import { vectorStickerUrl } from './stickerUrls';

const namespace = 'http://www.w3.org/2000/svg';
const pathData = (geometry: MultiPolygon) => geometry.flatMap(polygon => polygon.map(ring =>
  ring.length ? `M${ring.map(point => point.join(',')).join('L')}Z` : '',
)).join('');
function element<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number> = {}) {
  const node = document.createElementNS(namespace, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

/** Exact source curves plus numeric paint; no display caches or hit-map allocations. */
export async function pictureSvg(picture: EditorSetup): Promise<SVGSVGElement> {
  const hex = (color: number) => `#${resolveColor(color, picture.document?.customColors).toString(16).padStart(6, '0')}`;
  const { width, height } = picture.document ?? paperSize(picture.format, picture.size);
  const svg = element('svg', { viewBox: `0 0 ${width} ${height}`, width: `${width / 96}in`, height: `${height / 96}in` });
  const title = element('title'); title.textContent = picture.title; svg.append(title);
  const defs = element('defs'); svg.append(defs);
  const pageClip = element('clipPath', { id: 'page-clip', clipPathUnits: 'userSpaceOnUse' });
  pageClip.append(element('rect', { width, height })); defs.append(pageClip);
  const page = element('g', { 'clip-path': 'url(#page-clip)' }); svg.append(page);
  const surfaces: SurfaceData[] = picture.document?.surfaces ?? [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: parseInt(picture.background.slice(1), 16) }];
  // Export owns these documents only for this operation, sharing repeated kinds.
  const sources = new Map<StickerKind, Element>();
  await Promise.all([...new Set(surfaces.map(surface => surface.kind))].map(async kind => {
    if (kind === 'canvas') return;
    const url = vectorStickerUrl(kind);
    if (!url) throw Error(`Unknown sticker: ${kind}`);
    const response = await fetch(url);
    if (!response.ok) throw Error(`Unable to load sticker: ${kind}`);
    const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.getAttribute('data-region-format') !== '1') throw Error('Invalid region SVG');
    sources.set(kind, doc.documentElement);
  }));
  let serial = 0;
  const paintShape = (shape: Element, color: number, bounds: number[], pattern?: FillOptions): Element => {
    if (!pattern || pattern.pattern === 'solid') { shape.setAttribute('fill', hex(color)); return shape; }
    shape.setAttribute('fill', 'white');
    const group = element('g'); group.append(shape);
    const clipId = `pattern-clip-${serial++}`;
    const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    clip.append(shape.cloneNode(true)); defs.append(clip);
    const [left, top, right, bottom] = bounds as [number, number, number, number], s = pattern.spacing;
    const commands: string[] = [];
    // Explicit vector marks avoid browser print engines rasterizing SVG patterns.
    // Their coordinates match drawPaint, including phase across neighboring blobs.
    if (pattern.pattern === 'stripes') {
      for (let sum = Math.floor((left+top)/s)*s; sum < right+bottom+s; sum += s)
        commands.push(`M${sum-top} ${top}L${sum+s/2-top} ${top}L${sum+s/2-bottom} ${bottom}L${sum-bottom} ${bottom}Z`);
    } else for (let y=Math.floor(top/s); y<=Math.ceil(bottom/s); y++) for (let x=Math.floor(left/s); x<=Math.ceil(right/s); x++) {
      if (pattern.pattern === 'checker') {
        if ((x+y)%2 === 0) commands.push(`M${x*s} ${y*s}h${s}v${s}h${-s}Z`);
      } else {
        const cx=(x+.5)*s, cy=(y+.5)*s, r=s/4;
        commands.push(`M${cx+r} ${cy}a${r} ${r} 0 1 0 ${-2*r} 0a${r} ${r} 0 1 0 ${2*r} 0Z`);
      }
    }
    group.append(element('path', { d: commands.join(''), fill: hex(color), 'clip-path': `url(#${clipId})` }));
    return group;
  };
  surfaces.forEach((surface, index) => {
    const group = element('g'); page.append(group);
    let regions: Element[], ink: Element | null = null;
    if (surface.kind === 'canvas') {
      regions = [element('path', { id: 'region-1', d: `M0 0H${width}V${height}H0Z` })];
    } else {
      const source = sources.get(surface.kind)!.cloneNode(true) as Element;
      // Every instance gets its own IDs, including authored ink clips.
      const ids = new Map<string, string>();
      for (const node of source.querySelectorAll('[id]')) ids.set(node.id, `s${index}-${node.id}`);
      for (const node of source.querySelectorAll('*')) {
        for (const attr of [...node.attributes]) {
          let value = attr.value.replace(/url\(#([^)]*)\)/g, (_, id: string) => `url(#${ids.get(id) ?? id})`);
          if (attr.name === 'id') value = ids.get(value)!;
          node.setAttribute(attr.name, value);
        }
      }
      for (const sourceDefs of source.querySelectorAll('defs')) defs.append(...[...sourceDefs.children]);
      const viewBox = source.getAttribute('viewBox')!.split(/[ ,]+/).map(Number);
      group.setAttribute('transform', `translate(${surface.x} ${surface.y}) rotate(${surface.rotation ?? 0}) scale(${(surface.scale ?? 1)*(surface.flipX ? -1 : 1)} ${(surface.scale ?? 1)*(surface.flipY ? -1 : 1)}) translate(${-Math.floor(viewBox[2]!/2)} ${-Math.floor(viewBox[3]!/2)})`);
      regions = [...source.querySelectorAll(`[id="s${index}-regions"] > path`)];
      ink = source.querySelector(`[id="s${index}-ink"]`);
    }
    const backing = element('g', { fill: surface.kind === 'canvas' ? hex(surface.color) : 'white', 'fill-rule': 'nonzero' });
    for (const region of regions) { const path = region.cloneNode(true) as Element; path.removeAttribute('id'); backing.append(path); }
    group.append(backing);
    const paints = new Map(surface.vectorPaint?.regions.map(region => [region.id, region]));
    for (const region of regions) {
      const id = Number(/region-(\d+)$/.exec(region.id)?.[1]);
      const paint = paints.get(id);
      const base = region.cloneNode(true) as Element;
      base.removeAttribute('id');
      const bounds = surface.kind === 'canvas' ? [0, 0, width, height] : region.getAttribute('data-bounds')!.trim().split(/[ ,]+/).map(Number);
      base.setAttribute('fill-rule', 'nonzero');
      group.append(paintShape(base, paint?.base ?? (surface.kind === 'canvas' ? surface.color : 0xffffff), bounds, paint?.pattern));
      if (!paint?.blobs.length) continue;
      const clipId = `region-clip-${serial++}`;
      const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
      const outline = region.cloneNode(true) as Element;
      outline.removeAttribute('id'); outline.setAttribute('clip-rule', 'nonzero'); clip.append(outline); defs.append(clip);
      const blobs = element('g', { 'clip-path': `url(#${clipId})` }); group.append(blobs);
      // Cover antialias seams between disjoint compacted colors, constrained to
      // their combined coverage so neither holes nor silhouettes grow.
      if (paint.blobs.some(blob => blob.color !== paint.blobs[0]!.color || blob.pattern)) {
        const coverageId = `coverage-${serial++}`;
        const coverage = element('clipPath', { id: coverageId, clipPathUnits: 'userSpaceOnUse' });
        coverage.append(element('path', { d: paint.blobs.map(blob => pathData(blob.geometry)).join('') })); defs.append(coverage);
        const underpaint = element('g', { 'clip-path': `url(#${coverageId})`, 'stroke-width': .1, 'stroke-linejoin': 'round' });
        for (const blob of paint.blobs) if (!blob.pattern || blob.pattern.pattern === 'solid') underpaint.append(element('path', { d: pathData(blob.geometry), fill: 'none', stroke: hex(blob.color) }));
        blobs.append(underpaint);
      }
      for (const blob of paint.blobs) {
        const b = geometryBounds(blob.geometry);
        const visible = [Math.max(bounds[0]!, b[0]!), Math.max(bounds[1]!, b[1]!), Math.min(bounds[2]!, b[2]!), Math.min(bounds[3]!, b[3]!)];
        blobs.append(paintShape(element('path', { d: pathData(blob.geometry), 'fill-rule': 'nonzero' }), blob.color, visible, blob.pattern));
      }
    }
    if (ink) {
      for (const path of ink.querySelectorAll('path')) for (const attribute of ['fill', 'stroke']) {
        if (path.getAttribute(attribute) !== 'none') path.setAttribute(attribute, hex(surface.color));
      }
      group.append(ink);
    }
  });
  return svg;
}
