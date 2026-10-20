import polygonClipping from './polygonGeometry';
import { vectorStickerSize } from './vectorCatalog';
import { vectorDefinition } from './vectorStickers';
import { drawVectorInk } from './vectorDefinition';
import type { VectorDefinition } from './vectorDefinition';
import { defaultBrush, defaultFill } from './toolOptions';
import type { BrushOptions, FillOptions } from './toolOptions';
import type { ArtworkDocument, Point, StickerKind, SurfaceData } from './document';
import { VectorPaint } from './VectorPaint';
import { geometryBounds, mapGeometry, rectangleGeometry, styledStroke } from './vectorPaintStyles';
const hex = (color: number) => '#' + color.toString(16).padStart(6, '0');

class Surface {
    readonly vector: VectorDefinition;
    readonly vectorPaint: VectorPaint;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly opaqueBounds: {left:number;top:number;right:number;bottom:number};
    constructor(readonly data:SurfaceData,width:number,height:number,definition?:VectorDefinition){
        if(data.kind==='canvas'){
            const path=new Path2D();path.rect(0,0,width,height);
            const inside=(x:number,y:number)=>x>=0&&y>=0&&x<width&&y<height;
            this.vector={width,height,bounds:{left:0,top:0,right:width,bottom:height},regions:[{id:1,path,bounds:[0,0,width,height],geometry:()=>rectangleGeometry(0,0,width,height)}],regionCount:1,
                silhouette:path,ink:[],format:'svg',lookup:'paths',typedArrayBytes:0,
                regionAt:(x,y)=>inside(x,y)?1:0,hitRegionAt:(x,y)=>inside(x,y)?1:0,contains:inside,inRegion:(x,y,id)=>id===1&&inside(x,y)};
        }else this.vector=definition??vectorDefinition(data.kind);
        this.logicalWidth=this.vector.width;this.logicalHeight=this.vector.height;
        this.opaqueBounds=this.vector.bounds;
        this.vectorPaint=new VectorPaint(data.vectorPaint,data.kind==='canvas'?data.color:0xffffff);
        delete data.vectorPaint;
    }
    worldPoint(x:number,y:number):Point{
        if(this.data.kind==='canvas')return{x,y};
        const a=(this.data.rotation??0)*Math.PI/180,s=this.data.scale??1;
        const dx=(x-Math.floor(this.logicalWidth/2))*s*(this.data.flipX?-1:1),dy=(y-Math.floor(this.logicalHeight/2))*s*(this.data.flipY?-1:1);
        return{x:this.data.x+dx*Math.cos(a)-dy*Math.sin(a),y:this.data.y+dx*Math.sin(a)+dy*Math.cos(a)};
    }
    localPoint(point:Point):Point{
        if(this.data.kind==='canvas')return point;
        const a=(this.data.rotation??0)*Math.PI/180,s=this.data.scale??1,dx=point.x-this.data.x,dy=point.y-this.data.y;
        return{x:(dx*Math.cos(a)+dy*Math.sin(a))/s*(this.data.flipX?-1:1)+Math.floor(this.logicalWidth/2),y:(-dx*Math.sin(a)+dy*Math.cos(a))/s*(this.data.flipY?-1:1)+Math.floor(this.logicalHeight/2)};
    }
    containsLocal(x:number,y:number){return this.vector.contains(x,y);}
    containsPoint(point:Point){const p=this.localPoint(point);return this.containsLocal(p.x,p.y);}
    bounds(){
        const b=this.opaqueBounds,points=[[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom]].map(([x,y])=>this.worldPoint(x!,y!));
        const x=Math.floor(Math.min(...points.map(p=>p.x))),y=Math.floor(Math.min(...points.map(p=>p.y)));
        return{x,y,width:Math.ceil(Math.max(...points.map(p=>p.x)))-x,height:Math.ceil(Math.max(...points.map(p=>p.y)))-y};
    }
    serialize():SurfaceData{return{...this.data,vectorPaint:this.vectorPaint.serialize()};}
}
export class Artwork {
    private surfaces: Surface[];
    private focusedId?: string;
    private overlapCache = new Map<string, boolean>();
    constructor(private readonly width: number, private readonly height: number, data: SurfaceData[], private readonly definitionFor: (kind: StickerKind) => VectorDefinition = vectorDefinition) {
        this.surfaces = data.map(surface => new Surface(structuredClone(surface), width, height, surface.kind === 'canvas' ? undefined : this.definitionFor(surface.kind)));
    }
    static create(width: number, height: number, background: string) {
        return new Artwork(width, height, [{ id: 'canvas', kind: 'canvas', x: 0, y: 0, color: parseInt(background.slice(1), 16) }]);
    }
    static restore(doc:ArtworkDocument,definitionFor:(kind:StickerKind)=>VectorDefinition=vectorDefinition){
        if(doc.version!==5)throw Error('Unsupported drawing format; start a new picture.');
        return new Artwork(doc.width,doc.height,doc.surfaces,definitionFor);
    }
    async compactPaint(){await Promise.all(this.surfaces.map(surface=>surface.vectorPaint.settled()));}
    serialize():ArtworkDocument{return{version:5,width:this.width,height:this.height,surfaces:this.surfaces.map(surface=>surface.serialize())};}
    add(kind: StickerKind, color: number, point: Point) {
        const surface = new Surface({ id: crypto.randomUUID(), kind, color, x: Math.round(point.x), y: Math.round(point.y) }, this.width, this.height, this.definitionFor(kind));
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
        this.overlapCache.clear();
        return true;
    }
    remove(id: string) {
        this.surfaces = this.surfaces.filter((s) => s.data.kind === 'canvas' || s.data.id !== id);
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
    brush(from:Point,to:Point,color:number,erase=false,options:BrushOptions=defaultBrush){
        const shape=erase?{...options,kind:'ink' as const,shape:'round' as const}:options;
        let remaining=styledStroke([from.x,from.y],[to.x,to.y],erase?20:options.size/2,shape);
        if(!remaining.length)return false;
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
    render(ctx:CanvasRenderingContext2D,thumbnail=false){
        ctx.clearRect(0,0,this.width,this.height);ctx.save();ctx.beginPath();ctx.rect(0,0,this.width,this.height);ctx.clip();
        for(const surface of this.surfaces){
            if(this.focusedId&&surface.data.id!==this.focusedId)continue;
            ctx.save();
            if(surface.data.kind!=='canvas'){
                ctx.translate(surface.data.x,surface.data.y);ctx.rotate((surface.data.rotation??0)*Math.PI/180);
                ctx.scale((surface.data.scale??1)*(surface.data.flipX?-1:1),(surface.data.scale??1)*(surface.data.flipY?-1:1));
                ctx.translate(-Math.floor(surface.logicalWidth/2),-Math.floor(surface.logicalHeight/2));
            }
            surface.vectorPaint.draw(ctx,surface.vector);drawVectorInk(ctx,surface.vector,hex(surface.data.color),thumbnail);ctx.restore();
        }
        ctx.restore();
    }
}
