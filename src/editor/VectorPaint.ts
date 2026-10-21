import polygonClipping from './polygonGeometry';
import type { FillOptions } from './toolOptions';
import { paintStyleKey, normalizedPattern } from './vectorPaintTypes';
import { drawPaint, geometryBounds, rectangleGeometry } from './vectorPaintStyles';
import { polygonPath } from './vectorPaintGeometry';
import { computePaint } from './paintWorker';
import type { MultiPolygon, Pair } from './polygonGeometry';
import type { PaintBlob, VectorPaintData, VectorPaintRegion } from './vectorPaintTypes';
import type { VectorDefinition } from './vectorDefinition';

export class VectorPaint {
    private regions:Map<number,VectorPaintRegion>;
    private disposed=false;
    private revision=0;
    private dirty=new Set<number>();
    private timer?:ReturnType<typeof setTimeout>;
    private busy=false;
    private pendingMerge?:Promise<(VectorPaintRegion|undefined)[]>;
    private failed=false;
    private paths=new WeakMap<MultiPolygon,Path2D>();
    private coveragePaths=new WeakMap<VectorPaintRegion,{blobs:PaintBlob[];count:number;path:Path2D}>();
    private path(geometry:MultiPolygon){let path=this.paths.get(geometry);if(!path){path=new Path2D(polygonPath(geometry));this.paths.set(geometry,path);}return path;}
    private coveragePath(paint:VectorPaintRegion){
        let cached=this.coveragePaths.get(paint);
        if(!cached||cached.blobs!==paint.blobs){cached={blobs:paint.blobs,count:0,path:new Path2D()};this.coveragePaths.set(paint,cached);}
        for(;cached.count<paint.blobs.length;cached.count++)cached.path.addPath(this.path(paint.blobs[cached.count]!.geometry));
        return cached.path;
    }
    // Restore is read-only: previews/exports must never queue paint maintenance.
    constructor(data?:VectorPaintData,private readonly defaultColor=0xffffff){this.regions=new Map(structuredClone(data?.regions??[]).map(region=>[region.id,region]));}
    private region(id:number){let r=this.regions.get(id);if(!r){r={id,base:this.defaultColor,blobs:[]};this.regions.set(id,r);}return r;}
    fill(id:number,color:number,point?:Pair,options?:FillOptions,boundary?:()=>MultiPolygon):boolean|Promise<boolean>{
        const r=this.region(id),pattern=normalizedPattern(options),key=paintStyleKey(color,pattern);
        if(point&&r.blobs.length){
            const revision=this.revision;
            // Reuse completed maintenance instead of queuing the same raw strokes
            // twice. Read the latest accepted prefix after maintenance completes.
            const prepare=()=>this.disposed?Promise.resolve([]):computePaint({regions:[structuredClone(r)],fill:{color,point,pattern,boundary:boundary?.()}});
            return (this.pendingMerge?this.pendingMerge.then(prepare,prepare):prepare()).then(([result])=>{
                // A different edit supersedes an in-flight fill; never paint stale topology.
                if(!result||revision!==this.revision)return false;
                this.regions.set(id,result);this.revision++;this.schedule(id);return true;
            });
        }
        if(paintStyleKey(r.base,r.pattern)===key)return false;
        r.base=color;r.pattern=pattern;this.revision++;if(r.blobs.length)this.schedule(id);return true;
    }
    apply(definition:VectorDefinition,geometry:MultiPolygon,color:number){
        const bounds=geometryBounds(geometry),pieces:MultiPolygon[]=[];let changed=false;
        for(const region of definition.regions){
            const [left,top,right,bottom]=region.bounds;
            if(bounds[2]!<left!||bounds[0]!>right!||bounds[3]!<top!||bounds[1]!>bottom!)continue;
            const clip=region.geometry?.()??rectangleGeometry(left!,top!,right!,bottom!);
            const coverage=polygonClipping.intersection(geometry,clip);
            if(!coverage.length)continue;
            pieces.push(coverage);
            const existing=this.regions.get(region.id);
            if((!existing||!existing.blobs.length)&&paintStyleKey(existing?.base??this.defaultColor,existing?.pattern)===paintStyleKey(color))continue;
            this.region(region.id).blobs.push({color,geometry:coverage});this.dirty.add(region.id);changed=true;
        }
        if(changed){this.revision++;this.schedule();}
        // Regions already partition the surface. The consumer subtracts their
        // combined coverage in one operation; no second union is needed here.
        return{changed,coverage:pieces.flat()};
    }
    dispose(){this.disposed=true;this.revision++;if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
    private schedule(id?:number){if(this.disposed)return;if(id!==undefined)this.dirty.add(id);this.failed=false;if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=undefined;void this.flush();},120);}
    private async flush():Promise<void>{
        if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
        if(this.disposed||this.busy||this.failed||!this.dirty.size)return;
        this.busy=true;
        const snapshot=[...this.dirty].map(id=>this.regions.get(id)!).map(r=>({...r,blobs:[...r.blobs]}));
        this.dirty.clear();
        try {
            this.pendingMerge=computePaint({regions:snapshot});
            const merged=await this.pendingMerge;
            if(this.disposed)return;
            // Compact a completed prefix even while new strokes arrive. A fill
            // replaces that prefix, so identity/base checks reject stale work.
            for(const result of merged){
                if(!result)continue;
                const current=this.regions.get(result.id),source=snapshot.find(r=>r.id===result.id)!;
                if(current&&paintStyleKey(current.base,current.pattern)===paintStyleKey(source.base,source.pattern)&&source.blobs.every((blob,i)=>current.blobs[i]===blob)){
                    current.blobs=[...result.blobs,...current.blobs.slice(source.blobs.length)];
                }
            }
            if(this.dirty.size)this.schedule();
        } catch(error){for(const region of snapshot)this.dirty.add(region.id);this.failed=true;if(!this.disposed)console.error('Vector merging stopped; original paint is preserved.',error);}
        finally{this.busy=false;this.pendingMerge=undefined;}
    }
    async settled(){
        do { await this.flush();if(this.busy||this.timer)await new Promise(resolve=>setTimeout(resolve,10)); }
        while(this.busy||this.timer);
    }
    serialize():VectorPaintData{return {version:1,regions:structuredClone([...this.regions.values()])};}
    draw(ctx:CanvasRenderingContext2D,definition:VectorDefinition){
        ctx.fillStyle=`#${this.defaultColor.toString(16).padStart(6,'0')}`;ctx.fill(definition.silhouette);
        for(const region of definition.regions){
            const paint=this.regions.get(region.id);
            if(!paint)continue;
            if(paint.base!==this.defaultColor||paint.pattern)drawPaint(ctx,region.path,paint.base,region.bounds,paint.pattern);
            if(!paint?.blobs.length)continue;
            ctx.save();ctx.clip(region.path);
            const first=paint.blobs[0]!,style=paintStyleKey(first.color,first.pattern);
            if(paint.blobs.some(blob=>paintStyleKey(blob.color,blob.pattern)!==style)){
                // Disjoint color partitions antialias independently. Cover the
                // shared edge first, then draw the original paths over it. Clip
                // the underpaint to their combined coverage, including holes,
                // so neither brush outlines nor the silhouette grow.
                ctx.save();ctx.clip(this.coveragePath(paint));
                const m=ctx.getTransform(),scale=Math.min(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));
                ctx.lineWidth=2/Math.max(.0001,scale);ctx.lineJoin='round';ctx.lineCap='round';
                for(const blob of paint.blobs)if(!blob.pattern||blob.pattern.pattern==='solid'){
                    ctx.strokeStyle=`#${blob.color.toString(16).padStart(6,'0')}`;ctx.stroke(this.path(blob.geometry));
                }
                ctx.restore();
            }
            for(const blob of paint.blobs){
                drawPaint(ctx,this.path(blob.geometry),blob.color,region.bounds,blob.pattern);
            }
            ctx.restore();
        }
    }
}
