import type { FillOptions } from './toolOptions';
import type { MultiPolygon, Pair } from './polygonGeometry';
export type PaintBlob = { color: number; pattern?: FillOptions; geometry: MultiPolygon };
export type VectorPaintRegion = { id: number; base: number; pattern?: FillOptions; blobs: PaintBlob[] };
export type VectorPaintData = { version: 1; regions: VectorPaintRegion[] };
export type PaintJob = {regions:VectorPaintRegion[];compacted?:number[];fill?:{color:number;point:Pair;pattern?:FillOptions;boundary?:MultiPolygon}};

export const paintStyleKey=(color:number,pattern?:FillOptions)=>`${color}:${pattern?.pattern??'solid'}:${pattern&&pattern.pattern!=='solid'?pattern.spacing:0}`;
export const normalizedPattern=(pattern?:FillOptions)=>pattern?.pattern==='solid'?undefined:pattern;

// Shallow region checkpoint: immutable geometry is shared until worker compaction.
export type PaintSnapshot = { region?: VectorPaintRegion; needsCompaction: boolean; compacted?: number };
