import { vectorStickerSize } from './vectorCatalog';
import { vectorDefinition } from './vectorStickers';
import { drawVectorInk } from './vectorDefinition';
import type { VectorDefinition } from './vectorDefinition';
import { defaultBrush, defaultFill, patternPixel } from './toolOptions';
import type { BrushOptions, FillOptions } from './toolOptions';
import type { ArtworkDocument, Point, StickerKind, SurfaceData, PaintRun } from './document';
import { paintScale } from './document';
import { resizeStickerPaint, stickerPaintScale } from './paintRaster';
const hex = (color: number) => '#' + color.toString(16).padStart(6, '0');
class Surface {
    readonly vector?: VectorDefinition;
    resolution: number;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    width: number;
    height: number;
    readonly context: CanvasRenderingContext2D;
    paint: Uint32Array;
    private hasPaint: boolean;
    readonly solidRegions = new Map<number, number>();
    opaqueBounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
    dirty = true;
    constructor(readonly data: SurfaceData, width: number, height: number, definition?: VectorDefinition) {
        this.resolution = paintScale() * (data.paintScale ?? 1);
        this.hasPaint = data.paint.length > 0;
        this.vector = data.kind === 'canvas' ? undefined : definition ?? vectorDefinition(data.kind);
        this.logicalWidth = this.vector?.width ?? width;
        this.logicalHeight = this.vector?.height ?? height;
        this.width = Math.ceil(this.logicalWidth * this.resolution);
        this.height = Math.ceil(this.logicalHeight * this.resolution);
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context)
            throw new Error('Unable to create paint surface');
        this.context = context;
        const b = this.vector?.bounds;
        this.opaqueBounds = b ? { left: Math.floor(b.left * this.resolution), top: Math.floor(b.top * this.resolution), right: Math.ceil(b.right * this.resolution), bottom: Math.ceil(b.bottom * this.resolution) } : { left: 0, top: 0, right: this.width, bottom: this.height };
        this.paint = new Uint32Array(this.width * this.height);
        for (const [start, length, color] of data.paint)
            this.paint.fill(color + 1, start, start + length);
    }
    ensurePaintResolution() {
        if (!this.vector) return;
        // Allocate only when painting needs it. Density only grows, so shrinking
        // and enlarging repeatedly never throws existing brush detail away.
        const factor = stickerPaintScale(this.logicalWidth, this.logicalHeight, this.data.scale ?? 1, this.data.paintScale ?? 1);
        if (factor === (this.data.paintScale ?? 1)) return;
        const oldPaint = this.paint, oldWidth = this.width, oldHeight = this.height, oldResolution = this.resolution;
        this.resolution = paintScale() * factor;
        this.width = Math.ceil(this.logicalWidth * this.resolution);
        this.height = Math.ceil(this.logicalHeight * this.resolution);
        this.context.canvas.width = this.width; this.context.canvas.height = this.height;
        this.paint = this.hasPaint
            ? resizeStickerPaint(oldPaint, oldWidth, oldHeight, oldResolution, this.width, this.height, this.resolution, this.vector.regionAt)
            : new Uint32Array(this.width * this.height);
        const b = this.vector.bounds;
        this.opaqueBounds = { left: Math.floor(b.left * this.resolution), top: Math.floor(b.top * this.resolution), right: Math.ceil(b.right * this.resolution), bottom: Math.ceil(b.bottom * this.resolution) };
        this.data.paintScale = factor;
        this.dirty = true;
    }
    worldPoint(x: number, y: number) {
        x /= this.resolution;
        y /= this.resolution;
        if (this.data.kind === 'canvas')
            return { x, y };
        const a = (this.data.rotation ?? 0) * Math.PI / 180, s = this.data.scale ?? 1;
        const dx = (x - Math.floor(this.logicalWidth / 2)) * s * (this.data.flipX ? -1 : 1), dy = (y - Math.floor(this.logicalHeight / 2)) * s * (this.data.flipY ? -1 : 1);
        return { x: this.data.x + dx * Math.cos(a) - dy * Math.sin(a), y: this.data.y + dx * Math.sin(a) + dy * Math.cos(a) };
    }
    localPoint(point: Point) {
        if (this.data.kind === 'canvas')
            return { x: point.x * this.resolution, y: point.y * this.resolution };
        const a = (this.data.rotation ?? 0) * Math.PI / 180, s = this.data.scale ?? 1, dx = point.x - this.data.x, dy = point.y - this.data.y;
        return { x: ((dx * Math.cos(a) + dy * Math.sin(a)) / s * (this.data.flipX ? -1 : 1) + Math.floor(this.logicalWidth / 2)) * this.resolution, y: ((-dx * Math.sin(a) + dy * Math.cos(a)) / s * (this.data.flipY ? -1 : 1) + Math.floor(this.logicalHeight / 2)) * this.resolution };
    }
    localIndex(x: number, y: number) { const p = this.localPoint({ x: x + .5, y: y + .5 }), lx = Math.floor(p.x), ly = Math.floor(p.y); return lx < 0 || ly < 0 || lx >= this.width || ly >= this.height ? -1 : ly * this.width + lx; }
    region(index: number) { return this.vector ? this.vector.regionAt((index % this.width) / this.resolution, Math.floor(index / this.width) / this.resolution) : 1; }
    inRegion(index: number, id: number) { return this.vector ? this.vector.inRegion((index % this.width) / this.resolution, Math.floor(index / this.width) / this.resolution, id) : id === 1; }
    containsLocal(x: number, y: number) { return x >= 0 && y >= 0 && x < this.width && y < this.height && (!this.vector || this.vector.contains(x / this.resolution, y / this.resolution)); }
    containsPoint(point: Point) { const p = this.localPoint(point); return this.containsLocal(p.x, p.y); }
    bounds() {
        const b = this.opaqueBounds, points = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => this.worldPoint(x!, y!));
        const x = Math.floor(Math.min(...points.map(p => p.x))), y = Math.floor(Math.min(...points.map(p => p.y)));
        return { x, y, width: Math.ceil(Math.max(...points.map(p => p.x))) - x, height: Math.ceil(Math.max(...points.map(p => p.y))) - y };
    }
    editable(index: number) { return index >= 0 && index < this.paint.length && this.region(index) > 0; }
    fillIndex(index: number) {
        if (this.editable(index)) return index;
        if (index < 0 || !this.vector?.hitRegionAt) return -1;
        const x = index % this.width, y = Math.floor(index / this.width);
        const region = this.vector.hitRegionAt(x / this.resolution, y / this.resolution);
        if (!region) return -1;
        // A line click belongs to its adjacent region, never to the page behind
        // it. Find an actual paint pixel without changing the paint silhouette.
        const reach = Math.ceil(32 * this.resolution);
        for (let radius = 1; radius <= reach; radius++) {
            let best = -1, distance = Infinity;
            const visit = (dx: number, dy: number) => {
                const px = x + dx, py = y + dy, d = dx * dx + dy * dy;
                if (d >= distance || px < 0 || py < 0 || px >= this.width || py >= this.height) return;
                const candidate = py * this.width + px;
                if (this.region(candidate) === region) { best = candidate; distance = d; }
            };
            for (let offset = -radius; offset <= radius; offset++) {
                visit(offset, -radius); visit(offset, radius);
                if (Math.abs(offset) !== radius) { visit(-radius, offset); visit(radius, offset); }
            }
            if (best >= 0) return best;
        }
        return -1;
    }
    color(index: number) { const value = this.paint[index]!; return value ? value - 1 : this.data.kind === 'canvas' ? this.data.color : 0xffffff; }
    write(index: number, color: number, erase: boolean, regionChecked = false) { if (!regionChecked && !this.editable(index))
        return false; const value = erase ? 0 : color + 1; if (this.paint[index] === value)
        return false; this.paint[index] = value; this.hasPaint = true; this.dirty = true; return true; }
    render() {
        if (this.hasPaint) this.ensurePaintResolution();
        if (!this.dirty)
            return;
        this.solidRegions.clear();
        const image = this.context.createImageData(this.width, this.height), base = this.data.kind === 'canvas' ? this.data.color : 0xffffff;
        for (let i = 0; i < this.paint.length; i++) {
            let value = this.paint[i]!;
            if (this.vector?.regions) {
                const id = this.region(i);
                if (id) {
                    const previous = this.solidRegions.get(id);
                    this.solidRegions.set(id, previous === undefined || previous === value ? value : -1);
                }
            }
            if (!value && this.hasPaint && this.vector && !this.region(i)) {
                // Bleed color underneath the ink/outside the exact clip, rather
                // than letting white backing pixels blur into a colored edge.
                const x = i % this.width, y = Math.floor(i / this.width);
                let nearest = Infinity;
                for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                    const nx = x + dx, ny = y + dy, distance = dx * dx + dy * dy;
                    if (distance >= nearest || nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
                    const candidate = this.paint[ny * this.width + nx]!;
                    if (candidate) { value = candidate; nearest = distance; }
                }
            }
            const color = value ? value - 1 : base, p = i * 4;
            image.data[p] = color >> 16 & 255;
            image.data[p + 1] = color >> 8 & 255;
            image.data[p + 2] = color & 255;
            image.data[p + 3] = 255;
        }
        this.context.putImageData(image, 0, 0);
        this.dirty = false;
    }
    serialize(): SurfaceData { const runs: PaintRun[] = []; for (let i = 0; i < this.paint.length;) {
        const value = this.paint[i]!;
        if (!value) {
            i++;
            continue;
        }
        const start = i++;
        while (i < this.paint.length && this.paint[i] === value)
            i++;
        runs.push([start, i - start, value - 1]);
    } return { ...this.data, paint: runs }; }
}
export class Artwork {
    private surfaces: Surface[];
    private focusedId?: string;
    private owners?: Int32Array;
    private overlapCache = new Map<string, boolean>();
    private fillScratch?: {
        seen: Uint8Array;
        queue: Int32Array;
    };
    constructor(private readonly width: number, private readonly height: number, data: SurfaceData[], private readonly definitionFor: (kind: StickerKind) => VectorDefinition = vectorDefinition) {
        this.surfaces = data.map(surface => new Surface(structuredClone(surface), width, height, surface.kind === 'canvas' ? undefined : this.definitionFor(surface.kind)));
    }
    static create(width: number, height: number, background: string) {
        return new Artwork(width, height, [{ id: 'canvas', kind: 'canvas', x: 0, y: 0, color: parseInt(background.slice(1), 16), paint: [] }]);
    }
    static restore(doc: ArtworkDocument, definitionFor: (kind: StickerKind) => VectorDefinition = vectorDefinition) {
        const originalHeights: Record<string, number> = { 'spring-meadow': 370, 'beach-shore': 480, 'winter-snow': 514 };
        const surfaces = doc.surfaces.map(data => {
            const height = originalHeights[data.kind];
            if (doc.horizonLayout === 2 || height === undefined) return data;
            // Preserve the top edge and existing paint when older horizon assets grow downward.
            const distance = (1440 - height) / 2 * (data.scale ?? 1);
            const angle = (data.rotation ?? 0) * Math.PI / 180;
            return { ...data, x: data.x - Math.sin(angle) * distance, y: data.y + Math.cos(angle) * distance };
        });
        return new Artwork(doc.width, doc.height, surfaces, definitionFor);
    }
    serialize(): ArtworkDocument { return { version: 3, horizonLayout: 2, width: this.width, height: this.height, surfaces: this.surfaces.map((surface) => surface.serialize()) }; }
    add(kind: StickerKind, color: number, point: Point) {
        const surface = new Surface({ id: crypto.randomUUID(), kind, color, x: Math.round(point.x), y: Math.round(point.y), paint: [] }, this.width, this.height, this.definitionFor(kind));
        {
            const bounds = surface.bounds();
            surface.data.scale = Math.min(1, this.width * .6 / Math.max(1, bounds.width), this.height * .6 / Math.max(1, bounds.height));
            // Keep the entire initial silhouette on the page, even when the current
            // viewport center is close to an edge after panning or zooming.
            const fitted = surface.bounds();
            surface.data.x += Math.max(0, -fitted.x) - Math.max(0, fitted.x + fitted.width - this.width);
            surface.data.y += Math.max(0, -fitted.y) - Math.max(0, fitted.y + fitted.height - this.height);
        }
        const placement = vectorStickerSize(kind);
        if (placement.interior) {
            surface.data.scale = Math.max(this.width / surface.logicalWidth, this.height / surface.logicalHeight) * 1.05;
            surface.data.x = this.width / 2;
            surface.data.y = this.height / 2;
            this.surfaces.splice(1, 0, surface);
        } else if (placement.horizon) {
            surface.data.scale = this.width * (placement.horizonOverscan ?? 1) / surface.logicalWidth;
            surface.data.x = this.width / 2;
            const depth = surface.logicalHeight * surface.data.scale;
            const top = Math.max(this.height * (placement.horizonStart ?? .58), this.height - depth + 2);
            surface.data.y = top + depth / 2;
            this.surfaces.splice(1, 0, surface);
        } else this.surfaces.push(surface);
        this.owners = undefined;
        this.overlapCache.clear();
        return surface.data.id;
    }
    get stickerCount() { return this.surfaces.length - 1; }
    bounds(id: string) {
        const surface = this.surfaces.find((s) => s.data.id === id);
        return surface?.bounds();
    }
    transform(id: string, scaleDelta: number, rotationDelta: number) {
        const surface = this.surfaces.find(s => s.data.id === id && s.data.kind !== 'canvas');
        if (!surface)
            return false;
        const scale = Math.max(.1, Math.min(4, Math.round(((surface.data.scale ?? 1) + scaleDelta) * 10) / 10));
        const rotation = ((surface.data.rotation ?? 0) + rotationDelta + 360) % 360;
        if (scale === (surface.data.scale ?? 1) && rotation === (surface.data.rotation ?? 0))
            return false;
        surface.data.scale = scale;
        surface.data.rotation = rotation;
        this.move(id, surface.data);
        return true;
    }
    flip(id: string, axis: 'horizontal' | 'vertical') {
        const surface = this.surfaces.find(s => s.data.id === id && s.data.kind !== 'canvas');
        if (!surface) return false;
        if (axis === 'horizontal') surface.data.flipX = !surface.data.flipX;
        else surface.data.flipY = !surface.data.flipY;
        this.move(id, surface.data);
        return true;
    }
    duplicate(id: string) {
        const original = this.surfaces.find((s) => s.data.id === id && s.data.kind !== 'canvas');
        if (!original)
            return undefined;
        const data = original.serialize();
        data.id = crypto.randomUUID();
        const copy = new Surface(data, this.width, this.height, original.vector);
        this.surfaces.push(copy);
        this.move(data.id, { x: data.x + 24, y: data.y + 24 });
        return data.id;
    }
    setFocus(id?: string) {
        this.focusedId = id && this.surfaces.some(s => s.data.id === id && s.data.kind !== 'canvas') ? id : undefined;
        this.owners = undefined;
    }
    private overlaps(a: Surface, b: Surface) {
        const key = JSON.stringify([a.data.id, b.data.id].sort());
        const cached = this.overlapCache.get(key);
        if (cached !== undefined) return cached;
        const first = a.bounds(), second = b.bounds();
        const left = Math.max(0, first.x, second.x), top = Math.max(0, first.y, second.y);
        const right = Math.min(this.width, first.x + first.width, second.x + second.width);
        const bottom = Math.min(this.height, first.y + first.height, second.y + second.height);
        // Match the scene-pixel coverage used for paint ownership, not selection boxes.
        for (let y = top; y < bottom; y++) {
            for (let x = left; x < right; x++) {
                const point = { x: x + .5, y: y + .5 };
                if (a.containsPoint(point) && b.containsPoint(point)) {
                    this.overlapCache.set(key, true);
                    return true;
                }
            }
        }
        this.overlapCache.set(key, false);
        return false;
    }
    private orderTarget(index: number, direction: 'forward' | 'backward') {
        if (index < 1) return -1;
        const step = direction === 'forward' ? 1 : -1;
        for (let target = index + step; target > 0 && target < this.surfaces.length; target += step) {
            if (this.overlaps(this.surfaces[index]!, this.surfaces[target]!)) return target;
        }
        return -1;
    }
    selectionOrder(id?: string) {
        const index = this.surfaces.findIndex(s => s.data.id === id);
        return { forward: this.orderTarget(index, 'forward') > 0, backward: this.orderTarget(index, 'backward') > 0 };
    }
    reorder(id: string, direction: 'forward' | 'backward') {
        const index = this.surfaces.findIndex(s => s.data.id === id);
        const target = this.orderTarget(index, direction);
        // Cross only the nearest overlapping sticker; preserve every other relative order.
        // Index zero remains the paper and can never be crossed.
        if (target < 1) return false;
        const [surface] = this.surfaces.splice(index, 1);
        this.surfaces.splice(target, 0, surface!);
        this.owners = undefined;
        this.overlapCache.clear();
        return true;
    }
    remove(id: string) {
        this.surfaces = this.surfaces.filter((s) => s.data.kind === 'canvas' || s.data.id !== id);
        this.owners = undefined;
        this.overlapCache.clear();
    }
    private ownership() {
        if (this.owners)
            return this.owners;
        const owners = new Int32Array(this.width * this.height);
        if (this.focusedId) owners.fill(-1);
        this.surfaces.forEach((surface, order) => {
            if (this.focusedId && surface.data.id !== this.focusedId) return;
            if (!order)
                return;
            const bounds = surface.bounds();
            for (let y = Math.max(0, bounds.y); y < Math.min(this.height, bounds.y + bounds.height); y++) {
                for (let x = Math.max(0, bounds.x); x < Math.min(this.width, bounds.x + bounds.width); x++) {
                    const local = surface.localIndex(x, y);
                    if (local >= 0 && surface.containsPoint({ x: x + .5, y: y + .5 }))
                        owners[y * this.width + x] = order;
                }
            }
        });
        this.owners = owners;
        return owners;
    }
    private index(point: Point) {
        const x = Math.floor(point.x), y = Math.floor(point.y);
        return x < 0 || y < 0 || x >= this.width || y >= this.height ? -1 : y * this.width + x;
    }
    private ownerAt(point: Point, owners: Int32Array) {
        if (this.focusedId) {
            if (this.index(point) < 0) return -1;
            const index = this.surfaces.findIndex(s => s.data.id === this.focusedId);
            return index > 0 && this.surfaces[index]!.containsPoint(point) ? index : -1;
        }
        const index = this.index(point);
        if (index < 0)
            return -1;
        const owner = owners[index]!, x = index % this.width, y = Math.floor(index / this.width);
        // Only refine the boundary band against shared high-resolution hit masks.
        // Paint edits do not invalidate these immutable definition samples.
        if ((!x || owners[index - 1] === owner) && (x + 1 === this.width || owners[index + 1] === owner) &&
            (!y || owners[index - this.width] === owner) && (y + 1 === this.height || owners[index + this.width] === owner))
            return owner;
        for (let order = this.surfaces.length - 1; order > 0; order--)
            if (this.surfaces[order]!.containsPoint(point))
                return order;
        return 0;
    }
    pick(point: Point) {
        const index = this.index(point);
        if (index < 0)
            return undefined;
        const owner = this.ownership()[index]!;
        return owner > 0 ? this.surfaces[owner]!.data.id : undefined;
    }
    position(id: string) { const s = this.surfaces.find((surface) => surface.data.id === id); return s ? { x: s.data.x, y: s.data.y } : undefined; }
    move(id: string, point: Point) {
        const surface = this.surfaces.find((s) => s.data.id === id);
        if (!surface || surface.data.kind === 'canvas')
            return;
        const box = surface.bounds(), bounds = surface.opaqueBounds;
        const visibleX = Math.min(this.width, Math.max(8, Math.ceil(box.width * .1)));
        const visibleY = Math.min(this.height, Math.max(8, Math.ceil(box.height * .1)));
        const offsetX = box.x - surface.data.x, offsetY = box.y - surface.data.y;
        surface.data.x = Math.round(Math.max(-offsetX - box.width + visibleX, Math.min(this.width - offsetX - visibleX, point.x)));
        surface.data.y = Math.round(Math.max(-offsetY - box.height + visibleY, Math.min(this.height - offsetY - visibleY, point.y)));
        // A rounded or irregular silhouette can have a transparent corner. Keep an
        // actual opaque pixel inside the paper, rather than just its bounding box.
        let nearest: Point | undefined, distance = Infinity;
        for (let y = bounds.top; y < bounds.bottom && distance > 0; y++) {
            for (let x = bounds.left; x < bounds.right; x++) {
                if (!surface.containsLocal(x + .5, y + .5))
                    continue;
                const { x: px, y: py } = surface.worldPoint(x + .5, y + .5);
                const dx = Math.max(0, Math.min(this.width - 1, px)) - px;
                const dy = Math.max(0, Math.min(this.height - 1, py)) - py;
                const d = dx * dx + dy * dy;
                if (d < distance) {
                    distance = d;
                    nearest = { x: dx, y: dy };
                }
                if (!d)
                    break;
            }
        }
        if (distance > 0 && nearest) {
            surface.data.x = Math.round(surface.data.x + nearest.x + Math.sign(nearest.x) * Math.min(7, this.width - 1));
            surface.data.y = Math.round(surface.data.y + nearest.y + Math.sign(nearest.y) * Math.min(7, this.height - 1));
        }
        this.owners = undefined;
        this.overlapCache.clear();
    }
    brush(from: Point, to: Point, color: number, erase = false, options: BrushOptions = defaultBrush) {
        const radius = erase ? 20 : options.size / 2, owners = this.ownership();
        const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
        let changed = false;
        this.surfaces.forEach((surface, order) => {
            if (this.focusedId && surface.data.id !== this.focusedId) return;
            const bounds = surface.bounds();
            if (Math.max(from.x, to.x) + radius < bounds.x || Math.min(from.x, to.x) - radius > bounds.x + bounds.width ||
                Math.max(from.y, to.y) + radius < bounds.y || Math.min(from.y, to.y) - radius > bounds.y + bounds.height) return;
            surface.ensurePaintResolution();
            const a = surface.localPoint(from), b = surface.localPoint(to);
            const reach = radius * Math.SQRT2 * surface.resolution / (surface.data.scale ?? 1);
            for (let y = Math.max(0, Math.floor(Math.min(a.y, b.y) - reach)); y < Math.min(surface.height, Math.ceil(Math.max(a.y, b.y) + reach)); y++) {
                for (let x = Math.max(0, Math.floor(Math.min(a.x, b.x) - reach)); x < Math.min(surface.width, Math.ceil(Math.max(a.x, b.x) + reach)); x++) {
                    const world = surface.worldPoint(x + .5, y + .5);
                    if (this.ownerAt(world, owners) !== order)
                        continue;
                    const t = length2 ? Math.max(0, Math.min(1, ((world.x - from.x) * dx + (world.y - from.y) * dy) / length2)) : 0;
                    const px = world.x - from.x - t * dx, py = world.y - from.y - t * dy;
                    const distance = !erase && options.shape === 'square' ? Math.max(Math.abs(px), Math.abs(py)) / radius : Math.hypot(px, py) / radius;
                    if (distance > 1)
                        continue;
                    if (!erase) {
                        if (options.kind === 'spray' && Math.random() > .22 * (1 - distance * .7))
                            continue;
                        if (options.kind === 'pencil' && ((x * 17 + y * 31) % 13) === 0)
                            continue;
                        if (options.kind === 'brush' && distance > .6 && x % 4 === 0)
                            continue;
                    }
                    changed = surface.write(y * surface.width + x, color, erase) || changed;
                }
            }
        });
        return changed;
    }
    private fillNative(surface: Surface, local: number, color: number, options: FillOptions) {
        const region = surface.region(local), target = surface.color(local);
        if (!region || (target === color && options.pattern === 'solid' && !this.surfaces.some(s => !!s.vector)))
            return false;
        if (!this.fillScratch || this.fillScratch.seen.length !== surface.paint.length) {
            this.fillScratch = { seen: new Uint8Array(surface.paint.length), queue: new Int32Array(surface.paint.length) };
        }
        else
            this.fillScratch.seen.fill(0);
        const { seen, queue } = this.fillScratch;
        let head = 0, tail = 1, changed = false;
        queue[0] = local;
        seen[local] = 1;
        const enqueue = (i: number) => { if (!seen[i]) {
            seen[i] = 1;
            queue[tail++] = i;
        } };
        while (head < tail) {
            const i = queue[head++]!, x = i % surface.width, y = Math.floor(i / surface.width);
            if (!surface.inRegion(i, region) || surface.color(i) !== target)
                continue;
            // Occluding stickers do not cut holes in this surface's own paint.
            // Its region IDs and paint colors remain the flood-fill boundaries.
            if (this.index(surface.worldPoint(x + .5, y + .5)) < 0) continue;
            changed = surface.write(i, patternPixel(x / surface.resolution, y / surface.resolution, options) ? color : 0xffffff, false, true) || changed;
            if (x)
                enqueue(i - 1);
            if (x + 1 < surface.width)
                enqueue(i + 1);
            if (y)
                enqueue(i - surface.width);
            if (y + 1 < surface.height)
                enqueue(i + surface.width);
        }
        return changed;
    }
    fill(point: Point, color: number, options: FillOptions = defaultFill) {
        const start = this.index(point);
        if (start < 0)
            return false;
        const owners = this.ownership(), owner = owners[start]!;
        if (owner < 0) return false;
        const surface = this.surfaces[owner]!;
        surface.ensurePaintResolution();
        const local = surface.fillIndex(surface.localIndex(start % this.width, Math.floor(start / this.width)));
        if (!surface.editable(local))
            return false;
        return this.fillNative(surface, local, color, options);
    }
    render(ctx: CanvasRenderingContext2D, thumbnail = false) {
        ctx.clearRect(0, 0, this.width, this.height);
        {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, this.width, this.height);
            ctx.clip();
            for (const surface of this.surfaces) {
                if (this.focusedId && surface.data.id !== this.focusedId) continue;
                surface.render();
                ctx.save();
                if (surface.data.kind !== 'canvas') {
                    ctx.translate(surface.data.x, surface.data.y);
                    ctx.rotate((surface.data.rotation ?? 0) * Math.PI / 180);
                    ctx.scale((surface.data.scale ?? 1) * (surface.data.flipX ? -1 : 1), (surface.data.scale ?? 1) * (surface.data.flipY ? -1 : 1));
                    ctx.translate(-Math.floor(surface.logicalWidth / 2), -Math.floor(surface.logicalHeight / 2));
                }
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                if (surface.vector) {
                    ctx.save();
                    ctx.clip(surface.vector.silhouette);
                    ctx.drawImage(surface.context.canvas, 0, 0, surface.logicalWidth, surface.logicalHeight);
                    ctx.restore();
                    // Bucket fills and untouched regions have exact SVG edges.
                    // Enlarging the raster must not expose its staircase boundary
                    // or interpolate color into an adjacent unpainted region.
                    for (const region of surface.vector.regions ?? []) {
                        const value = surface.solidRegions.get(region.id) ?? 0;
                        if (value < 0) continue; // Mixed brush paint remains raster.
                        ctx.fillStyle = hex(value ? value - 1 : 0xffffff);
                        ctx.fill(region.path);
                    }
                    drawVectorInk(ctx, surface.vector, hex(surface.data.color), thumbnail);
                }
                else
                    ctx.drawImage(surface.context.canvas, 0, 0, surface.logicalWidth, surface.logicalHeight);
                ctx.restore();
            }
            ctx.restore();
            return;
        }
    }
}
