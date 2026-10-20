import polygonClipping from 'polygon-clipping';
import type { FillOptions } from './toolOptions';
import { paintStyleKey, normalizedPattern } from './vectorPaintTypes';
import { drawPaint, geometryBounds, rectangleGeometry } from './vectorPaintStyles';
import { brushBlob, compactRegion, polygonPath, containsGeometry } from './vectorPaintGeometry';
import type { MultiPolygon, Pair } from 'polygon-clipping';
import type { VectorPaintData, VectorPaintRegion } from './vectorPaintTypes';
import type { VectorDefinition } from './vectorDefinition';

let worker: Worker|undefined, nextJob=0;
const jobs=new Map<number,{resolve:(regions:VectorPaintRegion[])=>void;reject:(error:Error)=>void}>();
function compact(regions:VectorPaintRegion[]):Promise<VectorPaintRegion[]> {
    if(typeof Worker==='undefined')return Promise.resolve(regions.map(compactRegion));
    if(!worker){
        worker=new Worker(new URL('./vectorPaint.worker.ts',import.meta.url),{type:'module'});
        worker.onmessage=event=>{const job=jobs.get(event.data.id);jobs.delete(event.data.id);if(event.data.error)job?.reject(Error(event.data.error));else job?.resolve(event.data.regions);};
        worker.onerror=()=>{for(const job of jobs.values())job.reject(Error('Vector paint worker failed'));jobs.clear();worker?.terminate();worker=undefined;};
    }
    return new Promise((resolve,reject)=>{const id=++nextJob;jobs.set(id,{resolve,reject});worker!.postMessage({id,regions});});
}
export class VectorPaint {
    private regions:VectorPaintRegion[];
    private revision=0;
    private mergedRevision=0;
    private timer?:ReturnType<typeof setTimeout>;
    private busy=false;
    private failed=false;
    private paths=new WeakMap<MultiPolygon,Path2D>();
    constructor(data?:VectorPaintData,private readonly defaultColor=0xffffff){this.regions=structuredClone(data?.regions??[]);if(this.regions.some(r=>r.blobs.length)){this.mergedRevision=-1;this.schedule();}}
    private region(id:number){let r=this.regions.find(r=>r.id===id);if(!r){r={id,base:this.defaultColor,blobs:[]};this.regions.push(r);}return r;}
    fill(id:number,color:number,point?:Pair,options?:FillOptions,boundary?:()=>MultiPolygon){
        const r=this.region(id),pattern=normalizedPattern(options),key=paintStyleKey(color,pattern);
        if(point&&r.blobs.length){
            r.blobs=compactRegion(r).blobs;
            for(const blob of r.blobs)for(const polygon of blob.geometry)if(containsGeometry([polygon],point)){
                if(paintStyleKey(blob.color,blob.pattern)===key)return false;
                r.blobs.push({color,pattern,geometry:[polygon]});this.revision++;this.schedule();return true;
            }
            if(boundary){
                const background=polygonClipping.difference(boundary(),...r.blobs.map(blob=>blob.geometry));
                if(background.length>1){
                    const component=background.find(polygon=>containsGeometry([polygon],point));
                    if(component){
                        if(paintStyleKey(r.base,r.pattern)===key)return false;
                        r.blobs.push({color,pattern,geometry:[component]});this.revision++;this.schedule();return true;
                    }
                }
            }
        }
        if(paintStyleKey(r.base,r.pattern)===key)return false;
        r.base=color;r.pattern=pattern;this.revision++;this.schedule();return true;
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
            const existing=this.regions.find(r=>r.id===region.id);
            if((!existing||!existing.blobs.length)&&paintStyleKey(existing?.base??this.defaultColor,existing?.pattern)===paintStyleKey(color))continue;
            this.region(region.id).blobs.push({color,geometry:coverage});changed=true;
        }
        if(changed){this.revision++;this.schedule();}
        return{changed,coverage:pieces.length>1?polygonClipping.union(pieces[0]!,...pieces.slice(1)):pieces[0]??[]};
    }
    brush(definition:VectorDefinition,a:Pair,b:Pair,radius:number,color:number,square:boolean){
        const geometry=brushBlob(a,b,radius,square);return geometry.length?this.apply(definition,geometry,color).changed:false;
    }
    private schedule(){if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=undefined;void this.flush();},120);}
    async flush():Promise<void>{
        if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
        if(this.busy||this.failed||this.revision===this.mergedRevision)return;
        this.busy=true;
        const revision=this.revision,snapshot=this.regions.map(r=>({...r,blobs:[...r.blobs]}));
        try {
            const merged=await compact(snapshot);
            // Compact a completed prefix even while new strokes arrive. A fill
            // replaces that prefix, so identity/base checks reject stale work.
            for(const result of merged){
                const current=this.regions.find(r=>r.id===result.id),source=snapshot.find(r=>r.id===result.id)!;
                if(current&&paintStyleKey(current.base,current.pattern)===paintStyleKey(source.base,source.pattern)&&source.blobs.every((blob,i)=>current.blobs[i]===blob)){
                    current.blobs=[...result.blobs,...current.blobs.slice(source.blobs.length)];
                }
            }
            if(revision!==this.revision)this.schedule();else this.mergedRevision=revision;
        } catch(error){this.failed=true;console.error('Vector merging stopped; original paint is preserved.',error);}
        finally{this.busy=false;}
    }
    async settled(){
        do { await this.flush();if(this.busy||this.timer)await new Promise(resolve=>setTimeout(resolve,10)); }
        while(this.busy||this.timer);
    }
    serialize():VectorPaintData{return {version:1,regions:structuredClone(this.regions)};}
    draw(ctx:CanvasRenderingContext2D,definition:VectorDefinition){
        ctx.fillStyle=`#${this.defaultColor.toString(16).padStart(6,'0')}`;ctx.fill(definition.silhouette);
        for(const region of definition.regions){
            const paint=this.regions.find(r=>r.id===region.id);
            if(!paint)continue;
            if(paint.base!==this.defaultColor||paint.pattern)drawPaint(ctx,region.path,paint.base,region.bounds,paint.pattern);
            if(!paint?.blobs.length)continue;
            ctx.save();ctx.clip(region.path);
            for(const blob of paint.blobs){
                let path=this.paths.get(blob.geometry);if(!path){path=new Path2D(polygonPath(blob.geometry));this.paths.set(blob.geometry,path);}
                drawPaint(ctx,path,blob.color,region.bounds,blob.pattern);
            }
            ctx.restore();
        }
    }
}
