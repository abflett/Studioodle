import { Surface } from './Surface';
import { sprayDabs } from './rasterSpray';
import type { SprayTile } from './rasterSpray';
import type { CustomColors } from './colorPalettes';
import { emptyCustomColors, resolveColor, validRgb, validCustomColors } from './colorPalettes';
import { ArtworkChange } from './artworkChange';
import polygonClipping from './polygonGeometry';
import { vectorStickerSize } from './vectorCatalog';
import { vectorDefinition } from './vectorStickers';
import { drawVectorInk } from './vectorDefinition';
import type { VectorDefinition } from './vectorDefinition';
import { defaultBrush, defaultFill } from './toolOptions';
import type { BrushOptions, FillOptions } from './toolOptions';
import type { ArtworkDocument, Point, StickerKind, SurfaceData } from './document';
import { PaintDisplayCache } from './paintDisplayCache';
import { geometryBounds, mapGeometry, rectangleGeometry, styledStroke, paintPath } from './vectorPaintStyles';
const hex = (color: number) => '#' + color.toString(16).padStart(6, '0');

export class Artwork {
    private surfaces: Surface[];
    private custom = emptyCustomColors();
    get customColors(): CustomColors { return this.custom; }
    private resolve = (color: number) => resolveColor(color, this.custom);
    setCustomColor(index: number, color: number) {
        if (!Number.isInteger(index) || index < 0 || index >= 32 || !validRgb(color)) throw Error('Invalid custom color');
        if (this.custom[index] === color) return false;
        if (this.change && !this.change.colors.has(index)) this.change.colors.set(index, this.custom[index]!);
        this.custom = this.custom.map((value, i) => i === index ? color : value);
        for (const surface of this.surfaces) surface.vectorPaint.invalidateColors();
        return true;
    }
    private focusedId?: string;
    private change?: ArtworkChange;
    private overlapCache = new Map<string, boolean>();
    constructor(private readonly width: number, private readonly height: number, data: SurfaceData[], private readonly definitionFor: (kind: StickerKind) => VectorDefinition = vectorDefinition) {
        this.surfaces = data.map(surface => this.createSurface(surface));
    }
    private createSurface(data: SurfaceData, definition?: VectorDefinition) {
        const surfaceId=data.id;
        return new Surface({...data}, this.width, this.height, data.kind === 'canvas' ? undefined : definition ?? this.definitionFor(data.kind), {
            paintChanged: id => this.capturePaint(surfaceId, id),
            sprayChanged: (key, before) => this.captureSpray(surfaceId, key, before),
            resolveColor: this.resolve,
        });
    }
    static create(width: number, height: number, background: string) {
        return new Artwork(width, height, [{ id: 'canvas', kind: 'canvas', x: 0, y: 0, color: parseInt(background.slice(1), 16) }]);
    }
    static restore(doc:ArtworkDocument,definitionFor:(kind:StickerKind)=>VectorDefinition=vectorDefinition){
        if(doc.version!==6)throw Error('Unsupported drawing format; start a new picture.');
        if (doc.paletteVersion !== undefined && doc.paletteVersion !== 1 || doc.customColors !== undefined && !validCustomColors(doc.customColors)) throw Error('Invalid drawing palette');
        const art = new Artwork(doc.width,doc.height,doc.surfaces,definitionFor);
        art.custom = [...(doc.customColors ?? emptyCustomColors())];
        return art;
    }
    get size() { return { width: this.width, height: this.height }; }
    dispose() { this.change=undefined; for (const surface of this.surfaces) { surface.dispose(); } }
    async compactPaint(){await Promise.all(this.surfaces.map(surface=>surface.vectorPaint.settled()));}
    serialize():ArtworkDocument{return{version:6,paletteVersion:1,customColors:[...this.custom],width:this.width,height:this.height,surfaces:this.surfaces.map(surface=>surface.serialize())};}
    /** Detached containers share immutable geometry; saving never waits on live input. */
    checkpoint() {
        const paint = this.surfaces.map(surface => surface.vectorPaint.checkpoint());
        const document: ArtworkDocument = { version: 6, paletteVersion: 1, customColors: [...this.custom], width: this.width, height: this.height,
            surfaces: this.surfaces.map((surface, index) => {
                return { ...surface.data, vectorPaint: paint[index]!.data, rasterSpray: surface.spray.serialize() };
            }),
        };
        return { document, compact: async () => {
            const prepared = await Promise.all(paint.map(checkpoint => checkpoint.compact()));
            const surfaces = document.surfaces.map((surface, index) => ({ ...surface, vectorPaint: prepared[index]! }));
            return { ...document, surfaces };
        } };
    }
    beginChange() {
        if (this.change) throw Error('An artwork change is already active');
        this.change = new ArtworkChange();
    }
    endChange() {
        const change = this.change ?? new ArtworkChange();
        this.change = undefined;
        for (const [id, before] of change.surfaces) {
            const index = this.surfaces.findIndex(surface => surface.data.id === id), surface = this.surfaces[index];
            const unchanged = before && !before.paint && surface && before.index === index && JSON.stringify(before.data) === JSON.stringify(surface.data);
            if ((!before && !surface) || unchanged) change.surfaces.delete(id);
        }
        return change;
    }
    private captureSpray(surfaceId: string, key: string, before: () => SprayTile | undefined) {
        const id = JSON.stringify([surfaceId, key]);
        if (this.change && !this.change.spray.has(id)) this.change.spray.set(id, { surfaceId, key, tile: before() });
    }
    private capturePaint(surfaceId: string, id: number) {
        const key = JSON.stringify([surfaceId, id]);
        if (!this.change || this.change.regions.has(key)) return;
        const surface = this.surfaces.find(surface => surface.data.id === surfaceId)!;
        this.change.regions.set(key, { surfaceId, id, paint: surface.vectorPaint.snapshotRegion(id) });
    }
    private captureSurface(id: string, deleted = false) {
        if (!this.change) return;
        const index = this.surfaces.findIndex(surface => surface.data.id === id), surface = this.surfaces[index];
        if (surface?.data.kind === 'canvas') return;
        if (this.change.surfaces.has(id)) {
            const before = this.change.surfaces.get(id);
            if (deleted && before && !before.paint) { before.paint = surface!.vectorPaint.snapshotRegions(); before.data.rasterSpray = surface!.spray.serialize(); }
            return;
        }
        this.change.surfaces.set(id, surface ? {
            data: { ...surface.data, ...(deleted ? { rasterSpray: surface.spray.serialize() } : {}) }, index,
            ...(deleted ? { paint: surface.vectorPaint.snapshotRegions() } : {}),
        } : undefined);
    }
    undoChange(change: ArtworkChange) {
        if (change.colors.size) {
            this.custom = this.custom.map((color, index) => change.colors.has(index) ? change.colors.get(index)! : color);
            for (const surface of this.surfaces) surface.vectorPaint.invalidateColors();
        }
        for (const [id, before] of [...change.surfaces].reverse()) {
            const index = this.surfaces.findIndex(surface => surface.data.id === id);
            let surface = this.surfaces[index];
            if (!before) {
                if (surface) { surface.dispose(); this.surfaces.splice(index, 1); }
                continue;
            }
            if (!surface) {
                surface = this.createSurface(before.data);
            } else {
                this.surfaces.splice(index, 1);
                for (const key of Object.keys(surface.data)) Reflect.deleteProperty(surface.data, key);
                Object.assign(surface.data, before.data);
                delete surface.data.rasterSpray;
            }
            this.surfaces.splice(Math.min(before.index, this.surfaces.length), 0, surface);
            for (const paint of before.paint ?? []) if (paint.region) surface.vectorPaint.restoreRegion(paint.region.id, paint);
        }
        for (const { surfaceId, id, paint } of change.regions.values())
            this.surfaces.find(surface => surface.data.id === surfaceId)?.vectorPaint.restoreRegion(id, paint);
        for (const { surfaceId, key, tile } of change.spray.values()) this.surfaces.find(surface => surface.data.id === surfaceId)?.spray.restore(key, tile);
        this.overlapCache.clear();
    }
    add(kind: StickerKind, color: number, point: Point) {
        const id=crypto.randomUUID();this.captureSurface(id);
        const surface = this.createSurface({ id, kind, color, x: Math.round(point.x), y: Math.round(point.y) });
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
        this.captureSurface(id);
        surface.data.scale = scale;
        surface.data.rotation = rotation;
        this.move(id, surface.data);
        return true;
    }
    flip(id: string, axis: 'horizontal' | 'vertical') {
        const surface = this.surfaces.find(s => s.data.id === id && s.data.kind !== 'canvas');
        if (!surface) return false;
        this.captureSurface(id);
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
        this.captureSurface(data.id);
        const copy = this.createSurface(data, original.vector);
        this.surfaces.push(copy);
        this.move(data.id, { x: data.x + 24, y: data.y + 24 });
        return data.id;
    }
    setFocus(id?: string) {
        this.focusedId = id && this.surfaces.some(s => s.data.id === id && s.data.kind !== 'canvas') ? id : undefined;
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
        this.captureSurface(id);
        const [surface] = this.surfaces.splice(index, 1);
        this.surfaces.splice(target, 0, surface!);
        this.overlapCache.clear();
        return true;
    }
    remove(id: string) {
        this.captureSurface(id,true);
        this.surfaces = this.surfaces.filter(surface => {
            if (surface.data.kind === 'canvas' || surface.data.id !== id) return true;
            surface.dispose();
            return false;
        });
        this.overlapCache.clear();
    }
    private index(point:Point){const x=Math.floor(point.x),y=Math.floor(point.y);return x<0||y<0||x>=this.width||y>=this.height?-1:y*this.width+x;}
    private ownerAt(point:Point){
        if(this.index(point)<0)return -1;
        for(let i=this.surfaces.length-1;i>=0;i--){const surface=this.surfaces[i]!;
            if(this.focusedId&&surface.data.id!==this.focusedId)continue;
            if(surface.containsPoint(point))return i;
        }
        return -1;
    }
    pick(point: Point) {
        const index = this.index(point);
        if (index < 0)
            return undefined;
        const owner = this.ownerAt(point);
        return owner > 0 ? this.surfaces[owner]!.data.id : undefined;
    }
    position(id: string) { const s = this.surfaces.find((surface) => surface.data.id === id); return s ? { x: s.data.x, y: s.data.y } : undefined; }
    move(id: string, point: Point) {
        const surface = this.surfaces.find((s) => s.data.id === id);
        if (!surface || surface.data.kind === 'canvas')
            return;
        this.captureSurface(id);
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
        this.overlapCache.clear();
    }
    private surfaceMatrix(surface: Surface) {
        const origin = surface.worldPoint(0, 0), x = surface.worldPoint(1, 0), y = surface.worldPoint(0, 1);
        return new DOMMatrix([x.x-origin.x, x.y-origin.y, y.x-origin.x, y.y-origin.y, origin.x, origin.y]);
    }
    private sprayStroke(from: Point, to: Point, color: number, size: number) {
        const radius = size / 2;
        let changed = false;
        const clipKey = JSON.stringify([this.focusedId,this.surfaces.map(s=>s.data)]);
        const margin=radius+Math.max(.8,radius*.14);
        if(Math.max(from.x,to.x)+margin<0||Math.max(from.y,to.y)+margin<0||Math.min(from.x,to.x)-margin>this.width||Math.min(from.y,to.y)-margin>this.height)return false;
        const dots=sprayDabs(from,to,size);
        for (let i = this.surfaces.length-1; i >= 0; i--) {
            const surface = this.surfaces[i]!;
            if (this.focusedId && surface.data.id !== this.focusedId) continue;
            surface.spray.setClipKey(clipKey);
            const inverse = this.surfaceMatrix(surface).inverse();
            const page = new Path2D(); page.rect(0,0,this.width,this.height);
            const localPage = new Path2D(); localPage.addPath(page,inverse);
            const excluded: Path2D[] = [];
            if (!this.focusedId) for (const upper of this.surfaces.slice(i+1)) {
                const path = new Path2D(); path.rect(-16384,-16384,32768,32768);
                path.addPath(upper.vector.silhouette, inverse.multiply(this.surfaceMatrix(upper))); excluded.push(path);
            }
            const clip = (ctx:CanvasRenderingContext2D) => {
                ctx.clip(surface.vector.silhouette); ctx.clip(localPage);
                for (const path of excluded) ctx.clip(path,'evenodd');
            };
            const scale = surface.data.kind === 'canvas' ? 1 : surface.data.scale ?? 1;
            for (const dot of dots) {
                const p = surface.localPoint(dot.point), r = dot.radius / scale;
                if (p.x+r<0 || p.y+r<0 || p.x-r>surface.logicalWidth || p.y-r>surface.logicalHeight) continue;
                // Reject dabs outside the page before allocating sections. Edge dabs use exact clipping.
                if (dot.point.x+dot.radius<0 || dot.point.y+dot.radius<0 || dot.point.x-dot.radius>this.width || dot.point.y-dot.radius>this.height) continue;
                changed = surface.spray.dab(p,r,this.resolve(color),clip) || changed;
            }
        }
        return changed;
    }
    brush(from:Point,to:Point,color:number,erase=false,options:BrushOptions=defaultBrush){
        if (!erase && options.tip === 'scatter') return this.sprayStroke(from,to,color,options.size);
        const shape=erase?{...options,tip:'round' as const}:options;
        let remaining=styledStroke([from.x,from.y],[to.x,to.y],erase?20/3:options.size/2,shape);
        if(!remaining.length)return false;
        const strokeBounds=geometryBounds(remaining);
        if(strokeBounds[0]!<0||strokeBounds[1]!<0||strokeBounds[2]!>this.width||strokeBounds[3]!>this.height)
            remaining=polygonClipping.intersection(remaining,rectangleGeometry(0,0,this.width,this.height));
        let changed=false;
        for(let i=this.surfaces.length-1;i>=0&&remaining.length;i--){
            const surface=this.surfaces[i]!;
            if(this.focusedId&&surface.data.id!==this.focusedId)continue;
            const box=surface.bounds(),bounds=geometryBounds(remaining);
            if(bounds[2]!<box.x||bounds[0]!>box.x+box.width||bounds[3]!<box.y||bounds[1]!>box.y+box.height)continue;
            const local=mapGeometry(remaining,([x,y])=>{const p=surface.localPoint({x,y});return[p.x,p.y];});
            const result=surface.vectorPaint.apply(surface.vector,local,erase?(surface.data.kind==='canvas'?surface.data.color:0xffffff):color);
            if(!result.coverage.length)continue;
            changed=result.changed||changed;
            if (erase) changed = surface.spray.erase(paintPath(result.coverage),geometryBounds(result.coverage),ctx=>ctx.clip(surface.vector.silhouette)) || changed;
            if(i===0||this.focusedId)break;
            const world=mapGeometry(result.coverage,([x,y])=>{const p=surface.worldPoint(x,y);return[p.x,p.y];});
            remaining=polygonClipping.difference(remaining,world);
        }
        return changed;
    }
    fill(point:Point,color:number,options:FillOptions=defaultFill){
        const owner=this.ownerAt(point);if(owner<0)return false;
        const surface=this.surfaces[owner]!,p=surface.localPoint(point);
        const id=surface.vector.hitRegionAt?.(p.x,p.y)??surface.vector.regionAt(p.x,p.y);
        if(!id)return false;
        const region=surface.vector.regions.find(region=>region.id===id);
        return surface.vectorPaint.fill(id,color,[p.x,p.y],options,region?.geometry);
    }
    private transformSurface(ctx:CanvasRenderingContext2D,surface:Surface){
        if(surface.data.kind==='canvas')return;
        ctx.translate(surface.data.x,surface.data.y);ctx.rotate((surface.data.rotation??0)*Math.PI/180);
        ctx.scale((surface.data.scale??1)*(surface.data.flipX?-1:1),(surface.data.scale??1)*(surface.data.flipY?-1:1));
        ctx.translate(-Math.floor(surface.logicalWidth/2),-Math.floor(surface.logicalHeight/2));
    }
    render(ctx:CanvasRenderingContext2D,thumbnail=false,cacheDisplay:boolean|(()=>void)=false){
        ctx.clearRect(0,0,this.width,this.height);ctx.save();ctx.beginPath();ctx.rect(0,0,this.width,this.height);ctx.clip();
        const surfaces=this.focusedId?this.surfaces.filter(s=>s.data.id===this.focusedId):this.surfaces;
        if(cacheDisplay){
            const requests=surfaces.flatMap(surface=>{
                ctx.save();this.transformSurface(ctx,surface);
                const request=surface.vectorPaint.prepareDisplay(ctx,surface.vector,typeof cacheDisplay==='function'?cacheDisplay:undefined);
                ctx.restore();return request?[request]:[];
            });
            PaintDisplayCache.prepareFrame(requests);
        }
        for(const surface of surfaces){
            ctx.save();this.transformSurface(ctx,surface);
            surface.vectorPaint.draw(ctx,surface.vector,cacheDisplay);surface.spray.draw(ctx);drawVectorInk(ctx,surface.vector,hex(this.resolve(surface.data.color)),thumbnail);ctx.restore();
        }
        ctx.restore();
    }
}
