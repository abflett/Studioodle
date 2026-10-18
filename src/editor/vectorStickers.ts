import cottageSource from '../assets/vector/cottage-v1.json?raw';

export type VectorStickerKind = 'vector-cottage-v1';
type Source = { width: number; height: number; regionCount: number; regionRuns: string; coverage: string; hitScale: number; hitCoverage: string; inkPaths: string[]; silhouettePaths: string[] };
const cottage = JSON.parse(cottageSource) as Source;
export function isVectorSticker(kind: string): kind is VectorStickerKind { return kind === 'vector-cottage-v1'; }
export function vectorStickerSize(_kind: VectorStickerKind) { return { width: cottage.width, height: cottage.height }; }
export type VectorDefinition = { width: number; height: number; regions: Uint16Array; coverage: Uint8Array; ink: Path2D; silhouette: Path2D };
let definition: VectorDefinition | undefined;
const hitMasks = new Map<VectorStickerKind, { width: number; height: number; scale: number; bits: Uint8Array }>();
/** Shared, immutable offline boundary samples, decoded once per used definition.
 * No paint is stored here, and no runtime vector sampling is needed for fills.
 */
export function vectorHitMask(kind: VectorStickerKind) {
  const cached = hitMasks.get(kind);
  if (cached) return cached;
  const scale = cottage.hitScale, width = cottage.width * scale, height = cottage.height * scale;
  const bits = Uint8Array.from(atob(cottage.hitCoverage), char => char.charCodeAt(0));
  const mask = { width, height, scale, bits };
  hitMasks.set(kind, mask);
  return mask;
}
export function vectorDefinition(_kind: VectorStickerKind): VectorDefinition {
  if (definition) return definition;
  const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
  const packed = decode(cottage.regionRuns), view = new DataView(packed.buffer);
  const regions = new Uint16Array(cottage.width * cottage.height);
  let cursor = 0;
  for (let i = 0; i < packed.length; i += 8) {
    const length = view.getUint32(i, true), id = view.getUint32(i + 4, true);
    regions.fill(id, cursor, cursor + length); cursor += length;
  }
  if (cursor !== regions.length) throw new Error('Invalid vector cottage region map');
  const matrix = new DOMMatrix([.1, 0, 0, -.1, 0, cottage.height]);
  const path = (items: string[]) => {
    const result = new Path2D();
    for (const item of items) result.addPath(new Path2D(item), matrix);
    return result;
  };
  definition = { width: cottage.width, height: cottage.height, regions, coverage: decode(cottage.coverage), ink: path(cottage.inkPaths), silhouette: path(cottage.silhouettePaths) };
  return definition;
}
