import type { VectorPaintData } from './vectorPaintTypes';
import type { StickerKind } from './stickerKinds';
export type { StickerKind } from './stickerKinds';
export type Point = {
    x: number;
    y: number;
};
export type PaintRun = [
    start: number,
    length: number,
    color: number
];
export type SurfaceData = {
    id: string;
    kind: StickerKind | 'canvas';
    x: number;
    y: number;
    color: number;
    scale?: number;
    rotation?: number;
    flipX?: boolean;
    flipY?: boolean;
    /** Optional local raster density multiplier; page-aligned stickers use their placed scale. */
    paintScale?: number;
    vectorPaint?: VectorPaintData;
    paint: PaintRun[];
};
export const defaultPaintDpi = 150;
export const paintScale = () => defaultPaintDpi / 96;
export type ArtworkDocument = {
    version: 3 | 4;
    horizonLayout?: 2;
    width: number;
    height: number;
    surfaces: SurfaceData[];
};
export function paperSize(format: 'square' | 'landscape' | 'portrait', size?: {
    width: number;
    height: number;
}) {
    if (size)
        return size;
    return format === 'square' ? { width: 800, height: 800 } : format === 'portrait' ? { width: 700, height: 1000 } : { width: 1000, height: 700 };
}
