import { containsBrush } from './regionContainment';
import { regionsNear } from './regionSearch';
import polygonClipping, { prepareBooleanGeometry } from './polygonGeometry';
import type { FillOptions } from './toolOptions';
import { paintStyleKey, normalizedPattern } from './vectorPaintTypes';
import { drawPaint, geometryBounds, rectangleGeometry, paintPath } from './vectorPaintStyles';
import { PaintDisplayCache } from './paintDisplayCache';
import type { DisplayPaint } from './paintDisplayCache';
import { computePaint } from './paintWorker';
import type { MultiPolygon, Pair } from './polygonGeometry';
import type { PaintBlob, PaintSnapshot, VectorPaintData, VectorPaintRegion } from './vectorPaintTypes';
import type { VectorDefinition } from './vectorDefinition';

type SaveRegion = { version: number; snapshot: PaintSnapshot; prepared?: Promise<VectorPaintRegion> };

export class VectorPaint {
    private regions:Map<number,VectorPaintRegion>;
    private display?:PaintDisplayCache;
    private displayPoints=0;
    private disposed=false;
    private revision=0;
    private dirty=new Set<number>();
    private timer?:ReturnType<typeof setTimeout>;
    private busy=false;
    private pendingMerge?:Promise<(VectorPaintRegion|undefined)[]>;
    private failed=false;
    private stableCounts=new Map<number,number>();
    private compacted=new WeakSet<PaintBlob[]>();
    private regionVersions = new Map<number, number>();
    private saveRegions = new Map<number, SaveRegion>();
    private changedRegion(id: number) { this.regionVersions.set(id, (this.regionVersions.get(id) ?? 0) + 1); }
    private paths=new WeakMap<MultiPolygon,Path2D>();
    private coveragePaths=new WeakMap<VectorPaintRegion,{blobs:PaintBlob[];count:number;path:Path2D}>();
    private path(geometry:MultiPolygon){let path=this.paths.get(geometry);if(!path){path=paintPath(geometry);this.paths.set(geometry,path);}return path;}
    private coveragePath(paint:VectorPaintRegion){
        let cached=this.coveragePaths.get(paint);
        if(!cached||cached.blobs!==paint.blobs){cached={blobs:paint.blobs,count:0,path:new Path2D()};this.coveragePaths.set(paint,cached);}
        for(;cached.count<paint.blobs.length;cached.count++)cached.path.addPath(this.path(paint.blobs[cached.count]!.geometry));
        return cached.path;
    }
    // Restore is read-only: previews/exports must never queue paint maintenance.
    constructor(data?:VectorPaintData,private readonly defaultColor=0xffffff,private readonly changing?:(id:number)=>void,private readonly resolve:(color:number)=>number=(color)=>color){this.regions=new Map(structuredClone(data?.regions??[]).map(region=>[region.id,region]));for(const region of this.regions.values())for(const blob of region.blobs)this.trackDisplay(blob.geometry);}
    invalidateColors() { this.display?.invalidate(); }
    private trackDisplay(geometry:MultiPolygon){
        if(this.displayPoints>=1024)return;
        for(const polygon of geometry)for(const ring of polygon)this.displayPoints+=ring.length;
    }
    private region(id:number){let r=this.regions.get(id);if(!r){r={id,base:this.defaultColor,blobs:[]};this.regions.set(id,r);}return r;}
    snapshotRegion(id:number):PaintSnapshot {
        const region=this.regions.get(id);
        return {region:region?{...region,blobs:[...region.blobs]}:undefined,
            needsCompaction:!!region?.blobs.length&&!this.compacted.has(region.blobs),compacted:this.stableCounts.get(id)??0};
    }
    snapshotRegions(){return [...this.regions.keys()].map(id=>this.snapshotRegion(id));}
    /** Reuse prepared paint across geometry-only edits and only compact changed regions. */
    checkpoint() {
        const entries = [...this.regions.keys()].map(id => {
            const version = this.regionVersions.get(id) ?? 0;
            let entry = this.saveRegions.get(id);
            if (!entry || entry.version !== version) {
                entry = { version, snapshot: this.snapshotRegion(id) };
                this.saveRegions.set(id, entry);
            }
            return entry;
        });
        for (const id of this.saveRegions.keys()) if (!this.regions.has(id)) this.saveRegions.delete(id);
        const data: VectorPaintData = { version: 1, regions: entries.map(entry => entry.snapshot.region!) };
        return { data, compact: async (): Promise<VectorPaintData> => {
            const pending = entries.filter(entry => entry.snapshot.needsCompaction && !entry.prepared);
            if (pending.length) {
                const job = computePaint({ regions: pending.map(entry => entry.snapshot.region!), compacted: pending.map(entry => entry.snapshot.compacted ?? 0) });
                pending.forEach((entry, index) => {
                    const prepared = job.then(result => {
                        if (!result[index]) throw Error('Could not prepare drawing for saving.');
                        entry.snapshot = { region: result[index]!, needsCompaction: false, compacted: result[index]!.blobs.length };
                        return result[index]!;
                    });
                    entry.prepared = prepared;
                    void prepared.catch(() => { if (entry.prepared === prepared) entry.prepared = undefined; });
                });
            }
            return { version: 1, regions: await Promise.all(entries.map(entry => entry.prepared ?? entry.snapshot.region!)) };
        } };
    }
    restoreRegion(id:number,snapshot:PaintSnapshot){
        this.changedRegion(id);
        this.display?.invalidate();
        this.revision++;this.dirty.delete(id);this.stableCounts.set(id,snapshot.compacted??0);
        if(snapshot.region){
            const region={...snapshot.region,blobs:[...snapshot.region.blobs]};
            this.regions.set(id,region);for(const blob of region.blobs)this.trackDisplay(blob.geometry);
            if(!snapshot.needsCompaction)this.compacted.add(region.blobs);
        }
        else this.regions.delete(id);
        if(snapshot.needsCompaction)this.schedule(id);
    }
    fill(id:number,color:number,point?:Pair,options?:FillOptions,boundary?:()=>MultiPolygon):boolean|Promise<boolean>{
        const pattern=normalizedPattern(options),key=paintStyleKey(color,pattern);
        const r=this.regions.get(id)??{id,base:this.defaultColor,blobs:[]};
        if(point&&r.blobs.length){
            const revision=this.revision;
            // Reuse completed maintenance instead of queuing the same raw strokes
            // twice. Read the latest accepted prefix after maintenance completes.
            const prepare=()=>this.disposed?Promise.resolve([]):computePaint({regions:[{...r,blobs:[...r.blobs]}],compacted:[this.stableCounts.get(id)??0],fill:{color,point,pattern,boundary:boundary?.()}});
            return (this.pendingMerge?this.pendingMerge.then(prepare,prepare):prepare()).then(([result])=>{
                // A different edit supersedes an in-flight fill; never paint stale topology.
                if(!result||revision!==this.revision)return false;
                this.changedRegion(id);this.changing?.(id);this.display?.invalidate();this.stableCounts.set(id,result.blobs.length);this.compacted.add(result.blobs);this.dirty.delete(id);for(const blob of result.blobs)this.trackDisplay(blob.geometry);this.regions.set(id,result);this.revision++;return true;
            });
        }
        if(paintStyleKey(r.base,r.pattern)===key)return false;
        this.changedRegion(id);this.changing?.(id);this.display?.invalidate();this.regions.set(id,r);this.compacted.delete(r.blobs);r.base=color;r.pattern=pattern;this.revision++;if(r.blobs.length)this.schedule(id);return true;
    }
    apply(definition:VectorDefinition,geometry:MultiPolygon,color:number){
        const bounds=geometryBounds(geometry),pieces:MultiPolygon[]=[];let changed=false;
        for(const region of regionsNear(definition.regions,bounds)){
            const [left,top,right,bottom]=region.bounds;
            if(bounds[2]!<left!||bounds[0]!>right!||bounds[3]!<top!||bounds[1]!>bottom!)continue;
            const inside=region.rectangular&&bounds[0]!>=left!&&bounds[1]!>=top!&&bounds[2]!<=right!&&bounds[3]!<=bottom!;
            const boundary=inside?undefined:region.geometry?.()??rectangleGeometry(left!,top!,right!,bottom!);
            const contained=inside||containsBrush(boundary!,bounds,region.bounds);
            if(!contained)prepareBooleanGeometry(boundary!);
            const coverage=contained?geometry:polygonClipping.intersection(geometry,boundary!);
            if(!coverage.length)continue;
            pieces.push(coverage);
            const existing=this.regions.get(region.id);
            if((!existing||!existing.blobs.length)&&paintStyleKey(existing?.base??this.defaultColor,existing?.pattern)===paintStyleKey(color))continue;
            this.changing?.(region.id);
            this.changedRegion(region.id);
            const paint=this.region(region.id);this.compacted.delete(paint.blobs);
            this.trackDisplay(coverage);this.display?.append({regionId:region.id,color,geometry:coverage});
            paint.blobs.push({color,geometry:coverage});this.dirty.add(region.id);changed=true;
        }
        if(changed){this.revision++;this.schedule();}
        // Regions already partition the surface. The consumer subtracts their
        // combined coverage in one operation; no second union is needed here.
        return{changed,coverage:pieces.flat()};
    }
    dispose(){this.display?.dispose();this.display=undefined;this.disposed=true;this.revision++;this.saveRegions.clear();this.regionVersions.clear();if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
    private schedule(id?:number){if(this.disposed)return;if(id!==undefined)this.dirty.add(id);this.failed=false;if(this.timer)return;this.timer=setTimeout(()=>{this.timer=undefined;void this.flush();},120);}
    private async flush():Promise<void>{
        if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
        if(this.disposed||this.busy||this.failed||!this.dirty.size)return;
        this.busy=true;
        const snapshot=[...this.dirty].map(id=>this.regions.get(id)!).map(r=>({...r,blobs:[...r.blobs]}));
        this.dirty.clear();
        try {
            const prepared = snapshot.map(region => {
                const cached = this.saveRegions.get(region.id);
                return cached?.version === (this.regionVersions.get(region.id) ?? 0) ? cached.prepared : undefined;
            });
            this.pendingMerge = prepared.every(result => result !== undefined)
                ? Promise.all(prepared as Promise<VectorPaintRegion>[])
                : computePaint({regions:snapshot,compacted:snapshot.map(region=>this.stableCounts.get(region.id)??0)});
            const merged=await this.pendingMerge;
            if(this.disposed)return;
            // Compact a completed prefix even while new strokes arrive. A fill
            // replaces that prefix, so identity/base checks reject stale work.
            for(const result of merged){
                if(!result)continue;
                const current=this.regions.get(result.id),source=snapshot.find(r=>r.id===result.id)!;
                if(current&&paintStyleKey(current.base,current.pattern)===paintStyleKey(source.base,source.pattern)&&source.blobs.every((blob,i)=>current.blobs[i]===blob)){
                    current.blobs=[...result.blobs,...current.blobs.slice(source.blobs.length)];
                    this.stableCounts.set(current.id,result.blobs.length);
                    this.coveragePaths.delete(current);
                    for(const blob of source.blobs)this.paths.delete(blob.geometry);
                    if(current.blobs.length===result.blobs.length)this.compacted.add(current.blobs);
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
    prepareDisplay(ctx:CanvasRenderingContext2D,definition:VectorDefinition,refresh?:()=>void){
        if(this.displayPoints<1024)return;
        this.display??=new PaintDisplayCache();return this.display.request(ctx,definition,refresh);
    }
    draw(ctx:CanvasRenderingContext2D,definition:VectorDefinition,cacheDisplay:boolean|(()=>void)=false){
        if(cacheDisplay&&this.displayPoints>=1024){
            this.display??=new PaintDisplayCache();
            if(this.display.draw(ctx,target=>this.drawVectors(target,definition),(target,paint)=>this.drawDelta(target,definition,paint)))return;
        }
        this.drawVectors(ctx,definition);
    }
    private drawDelta(ctx:CanvasRenderingContext2D,definition:VectorDefinition,paint:DisplayPaint){
        const region=definition.regions.find(region=>region.id===paint.regionId);
        if(!region)return;
        ctx.save();ctx.clip(region.path);drawPaint(ctx,this.path(paint.geometry),this.resolve(paint.color),region.bounds,paint.pattern);ctx.restore();
    }
    private drawVectors(ctx:CanvasRenderingContext2D,definition:VectorDefinition){
        ctx.fillStyle=`#${this.defaultColor.toString(16).padStart(6,'0')}`;ctx.fill(definition.silhouette);
        for(const region of definition.regions){
            const paint=this.regions.get(region.id);
            if(!paint)continue;
            if(paint.base!==this.defaultColor||paint.pattern)drawPaint(ctx,region.path,this.resolve(paint.base),region.bounds,paint.pattern);
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
                    ctx.strokeStyle=`#${this.resolve(blob.color).toString(16).padStart(6,'0')}`;ctx.stroke(this.path(blob.geometry));
                }
                ctx.restore();
            }
            for(const blob of paint.blobs){
                drawPaint(ctx,this.path(blob.geometry),this.resolve(blob.color),region.bounds,blob.pattern);
            }
            ctx.restore();
        }
    }
}
