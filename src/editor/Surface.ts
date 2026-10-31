import { RasterSpray } from './rasterSpray';
import type { SprayTile } from './rasterSpray';
import { VectorPaint } from './VectorPaint';
import { rectangleGeometry } from './vectorPaintStyles';
import type { Point, SurfaceData } from './document';
import type { VectorDefinition } from './vectorDefinition';

type SurfaceHooks = {
    paintChanged?: (region: number) => void;
    sprayChanged?: (key: string, before: () => SprayTile | undefined) => void;
    resolveColor?: (color: number) => number;
};

/** One paper/sticker's local coordinates, paint storage and resource lifetime. */
export class Surface {
    readonly vector: VectorDefinition;
    readonly vectorPaint: VectorPaint;
    readonly spray: RasterSpray;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly opaqueBounds: VectorDefinition['bounds'];

    constructor(readonly data: SurfaceData, width: number, height: number, definition: VectorDefinition | undefined, hooks: SurfaceHooks = {}) {
        if (data.kind === 'canvas') {
            const path = new Path2D();
            path.rect(0, 0, width, height);
            const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
            this.vector = {
                width, height, bounds: { left: 0, top: 0, right: width, bottom: height },
                regions: [{ id: 1, path, bounds: [0, 0, width, height], rectangular: true, geometry: () => rectangleGeometry(0, 0, width, height) }],
                regionCount: 1, silhouette: path, ink: [], typedArrayBytes: 0,
                regionAt: (x, y) => inside(x, y) ? 1 : 0,
                hitRegionAt: (x, y) => inside(x, y) ? 1 : 0,
                contains: inside,
                inRegion: (x, y, id) => id === 1 && inside(x, y),
            };
        } else {
            if (!definition) throw Error('Missing sticker definition');
            this.vector = definition;
        }
        this.logicalWidth = this.vector.width;
        this.logicalHeight = this.vector.height;
        this.opaqueBounds = this.vector.bounds;
        this.vectorPaint = new VectorPaint(data.vectorPaint, data.kind === 'canvas' ? data.color : 0xffffff, hooks.paintChanged, hooks.resolveColor);
        this.spray = new RasterSpray(this.logicalWidth, this.logicalHeight, data.rasterSpray, hooks.sprayChanged);
        delete data.vectorPaint;
        delete data.rasterSpray;
    }

    worldPoint(x: number, y: number): Point {
        if (this.data.kind === 'canvas') return { x, y };
        const angle = (this.data.rotation ?? 0) * Math.PI / 180, scale = this.data.scale ?? 1;
        const dx = (x - Math.floor(this.logicalWidth / 2)) * scale * (this.data.flipX ? -1 : 1);
        const dy = (y - Math.floor(this.logicalHeight / 2)) * scale * (this.data.flipY ? -1 : 1);
        return { x: this.data.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: this.data.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
    }

    localPoint(point: Point): Point {
        if (this.data.kind === 'canvas') return point;
        const angle = (this.data.rotation ?? 0) * Math.PI / 180, scale = this.data.scale ?? 1;
        const dx = point.x - this.data.x, dy = point.y - this.data.y;
        return {
            x: (dx * Math.cos(angle) + dy * Math.sin(angle)) / scale * (this.data.flipX ? -1 : 1) + Math.floor(this.logicalWidth / 2),
            y: (-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale * (this.data.flipY ? -1 : 1) + Math.floor(this.logicalHeight / 2),
        };
    }

    containsLocal(x: number, y: number) { return this.vector.contains(x, y); }
    containsPoint(point: Point) { const local = this.localPoint(point); return this.containsLocal(local.x, local.y); }

    bounds() {
        const b = this.opaqueBounds;
        const points = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => this.worldPoint(x!, y!));
        const x = Math.floor(Math.min(...points.map(p => p.x))), y = Math.floor(Math.min(...points.map(p => p.y)));
        return { x, y, width: Math.ceil(Math.max(...points.map(p => p.x))) - x, height: Math.ceil(Math.max(...points.map(p => p.y))) - y };
    }

    dispose() { this.vectorPaint.dispose(); this.spray.dispose(); }
    serialize(): SurfaceData { return { ...this.data, vectorPaint: this.vectorPaint.serialize(), rasterSpray: this.spray.serialize() }; }
}
