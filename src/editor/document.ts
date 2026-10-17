import type { CottageStickerKind } from './stickerMasks';
export type Point = { x: number; y: number };
export type StickerKind = 'tree' | 'flower' | 'circle' | 'square' | 'triangle' | CottageStickerKind;
// Legacy operation format, retained only to import earlier saved pictures.
export type Mark =
  | { kind: StickerKind; x: number; y: number; color: number; transparent?: boolean }
  | { kind: 'stroke'; erase?: boolean; flood?: boolean; color: number; points: Point[] };
export type PaintRun = [start: number, length: number, color: number];
export type SurfaceData = {
  id: string;
  kind: StickerKind | 'canvas';
  x: number;
  y: number;
  color: number;
  legacyFill?: number;
  nativePixels?: boolean;
  scale?: number;
  rotation?: number;
  paint: PaintRun[];
};
export type ArtworkDocument = { version: 2; width: number; height: number; surfaces: SurfaceData[] };
export function paperSize(format: 'square' | 'landscape' | 'portrait' | 'window', size?: { width: number; height: number }) {
  if (size) return size;
  return format === 'square' ? { width: 800, height: 800 } : format === 'portrait' ? { width: 700, height: 1000 } : { width: 1000, height: 700 };
}

