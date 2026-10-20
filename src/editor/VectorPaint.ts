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
const hex=(color:number)=>`#${color.toString(16).padStart(6,'0')}`;
export class VectorPaint {
    private regions:VectorPaintRegion[];
    private revision=0;
    private mergedRevision=0;
    private timer?:ReturnType<typeof setTimeout>;
    private busy=false;
    private failed=false;
    private paths=new WeakMap<MultiPolygon,Path2D>();
    constructor(data?:VectorPaintData){this.regions=structuredClone(data?.regions??[]);if(this.regions.some(r=>r.blobs.length)){this.mergedRevision=-1;this.schedule();}}
    private region(id:number){let r=this.regions.find(r=>r.id===id);if(!r){r={id,base:0xffffff,blobs:[]};this.regions.push(r);}return r;}
    fill(id:number,color:number,point?:Pair){
        const r=this.region(id);
        // Resolve visible brush components for bucket edits; backing fills keep brush detail.
        if(point&&r.blobs.length){
            r.blobs=compactRegion(r).blobs;
            for(const blob of r.blobs)for(const polygon of blob.geometry)if(containsGeometry([polygon],point)){
                if(blob.color===color)return false;
                r.blobs.push({color,geometry:[polygon]});this.revision++;this.schedule();return true;
            }
        }
        if(r.base===color)return false;
        r.base=color;this.revision++;this.schedule();return true;
    }
    brush(definition:VectorDefinition,a:Pair,b:Pair,radius:number,color:number,square:boolean){
        const geometry=brushBlob(a,b,radius,square);if(!geometry.length)return false;
        let changed=false;
        for(const region of definition.regions??[]){
            const [left,top,right,bottom]=region.bounds;
            if(Math.max(a[0],b[0])+radius<left!||Math.min(a[0],b[0])-radius>right!||Math.max(a[1],b[1])+radius<top!||Math.min(a[1],b[1])-radius>bottom!)continue;
            this.region(region.id).blobs.push({color,geometry});changed=true;
        }
        if(changed){this.revision++;this.schedule();}return changed;
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
                if(current&&current.base===source.base&&source.blobs.every((blob,i)=>current.blobs[i]===blob)){
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
        for(const region of definition.regions??[]){
            const paint=this.regions.find(r=>r.id===region.id);
            ctx.fillStyle=hex(paint?.base??0xffffff);ctx.fill(region.path);
            if(!paint?.blobs.length)continue;
            ctx.save();ctx.clip(region.path);
            for(const blob of paint.blobs){
                let path=this.paths.get(blob.geometry);if(!path){path=new Path2D(polygonPath(blob.geometry));this.paths.set(blob.geometry,path);}
                ctx.fillStyle=hex(blob.color);ctx.fill(path,'evenodd');
            }
            ctx.restore();
        }
    }
}
