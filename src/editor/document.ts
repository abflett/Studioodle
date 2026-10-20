import type { VectorPaintData } from './vectorPaintTypes';
import type { StickerKind } from './stickerKinds';
export type { StickerKind } from './stickerKinds';
export type Point = {
    x: number;
    y: number;
};
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
    vectorPaint?: VectorPaintData;
};
export const defaultPaintDpi = 150;
export const exportScale = (dpi = defaultPaintDpi) => dpi / 96;
export type ArtworkDocument = {
    version: 5;
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
