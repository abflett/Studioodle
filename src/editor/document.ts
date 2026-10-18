import type { CottageStickerKind } from './stickerMasks';
import type { VectorStickerKind } from './vectorStickers';
export type Point = { x: number; y: number };
export type StickerKind = 'tree' | 'flower' | 'circle' | 'square' | 'triangle' | CottageStickerKind | VectorStickerKind;
// Legacy operation format, retained only to import earlier saved pictures.
export type Mark =
  | { kind: StickerKind; x: number; y: number; color: number; transparent?: boolean }
  | { kind: 'stroke'; erase?: boolean; flood?: boolean; color: number; points: Point[] };
export type PaintRun = [start: number, length: number, color: number];
export type SurfaceData = {
  // Scene coordinates use 96 units/inch; paint density is independent of zoom.
  // Missing on existing saves means the original 96-DPI paint grid.
  paintDpi?: 96 | 150;
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
export const defaultPaintDpi = 150;
export function paintScale(data: SurfaceData) { return (data.paintDpi ?? 96) / 96; }
export type ArtworkDocument = { version: 2; width: number; height: number; surfaces: SurfaceData[] };
export function paperSize(format: 'square' | 'landscape' | 'portrait' | 'window', size?: { width: number; height: number }) {
  if (size) return size;
  return format === 'square' ? { width: 800, height: 800 } : format === 'portrait' ? { width: 700, height: 1000 } : { width: 1000, height: 700 };
}

