import type { MultiPolygon } from 'polygon-clipping';
export type PaintBlob = { color: number; geometry: MultiPolygon };
export type VectorPaintRegion = { id: number; base: number; blobs: PaintBlob[] };
export type VectorPaintData = { version: 1; regions: VectorPaintRegion[] };
