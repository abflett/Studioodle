import type { MultiPolygon } from 'polygon-clipping';
export type InkCommand = {
    path: Path2D;
    fill: boolean;
    stroke: boolean;
    width: number;
    clips: Path2D[];
};
export type VectorDefinition = {
    bounds: { left: number; top: number; right: number; bottom: number };
    width: number;
    height: number;
    hitRegionAt?: (x: number, y: number) => number;
    regionAt: (x: number, y: number) => number;
    inRegion: (x: number, y: number, id: number) => boolean;
    contains: (x: number, y: number) => boolean;
    regionCount: number;
    format: 'svg';
    lookup: 'raster' | 'paths';
    mapSize?: { width: number; height: number; scale: number };
    typedArrayBytes: number;
    silhouette: Path2D;
    regions: ReadonlyArray<{ id: number; path: Path2D; bounds: number[]; geometry?: () => MultiPolygon }>;
    ink: InkCommand[];
};

export function drawVectorInk(ctx: CanvasRenderingContext2D, definition: Pick<VectorDefinition, 'ink'>, color: string, thumbnail = false) {
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.lineCap = ctx.lineJoin = 'round';
    const transform = ctx.getTransform();
    const unit = Math.max(.0001, Math.hypot(transform.a, transform.b));
    const minimum = thumbnail ? window.devicePixelRatio / unit : 0;
    for (const command of definition.ink) {
        ctx.save();
        for (const clip of command.clips)
            ctx.clip(clip, 'evenodd');
        if (command.fill) {
            ctx.fill(command.path);
            if (thumbnail) { ctx.lineWidth = minimum * .35; ctx.stroke(command.path); }
        }
        if (command.stroke) {
            ctx.lineWidth = Math.max(command.width, minimum);
            ctx.stroke(command.path);
        }
        ctx.restore();
    }
}
