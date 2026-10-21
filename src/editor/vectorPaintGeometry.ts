import { paintStyleKey } from './vectorPaintTypes';
import polygonClipping from './polygonGeometry';
import type { MultiPolygon, Pair } from './polygonGeometry';
import type { PaintBlob, PaintJob, VectorPaintRegion } from './vectorPaintTypes';
import type { FillOptions } from './toolOptions';

const brushGrid = 64;
const snap = (n: number) => Math.round(n * brushGrid) / brushGrid;
/** Capsule outline, bounded chord error, with input nodes on a fine logical grid. */
export function brushBlob(a: Pair, b: Pair, radius: number, square = false): MultiPolygon {
    const points: Pair[] = [];
    if(square) {
        for(const p of [a,b])for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]])points.push([snap(p[0]+x!*radius),snap(p[1]+y!*radius)]);
    } else {
        const steps=Math.min(128,Math.max(16,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-.01/Math.max(radius,.01))))));
        for(const p of [a,b])for(let i=0;i<steps;i++)points.push([snap(p[0]+Math.cos(i*2*Math.PI/steps)*radius),snap(p[1]+Math.sin(i*2*Math.PI/steps)*radius)]);
    }
    // Convex hull of two discs/squares is the swept brush shape.
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(a:Pair,b:Pair,c:Pair)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const lower:Pair[]=[],upper:Pair[]=[];
    for(const p of points){while(lower.length>=2&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p);}
    for(const p of [...points].reverse()){while(upper.length>=2&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p);}
    const ring=[...lower.slice(0,-1),...upper.slice(0,-1)];
    if(ring.length<3)return [];
    ring.push(ring[0]!);return [[ring]];
}

/** Last paint wins; compact each color and discard coverage hidden by other colors. */
export function compactRegion(region: VectorPaintRegion): VectorPaintRegion {
    const colors=new Map<string,PaintBlob>();
    // Union consecutive same-color strokes in batches, deduplicating repeated
    // coverage before running any boolean work. Color order remains intact.
    const runs:PaintBlob[]=[];
    for(let index=0;index<region.blobs.length;){
        const style=region.blobs[index]!,color=style.color,key=paintStyleKey(color,style.pattern),unique=new Map<string,MultiPolygon>();
        while(index<region.blobs.length&&paintStyleKey(region.blobs[index]!.color,region.blobs[index]!.pattern)===key){
            const geometry=region.blobs[index++]!.geometry;
            if(geometry.length)unique.set(JSON.stringify(geometry),geometry);
        }
        // Balanced reduction avoids repeatedly clipping an ever-growing outline
        // against the next 64 samples on long first strokes.
        let shapes=[...unique.values()];
        while(shapes.length>1){
            const next:MultiPolygon[]=[];
            for(let i=0;i<shapes.length;i+=8)next.push(polygonClipping.union(shapes[i]!,...shapes.slice(i+1,i+8)));
            shapes=next;
        }
        const geometry=shapes[0]??[];
        if(geometry.length)runs.push({color,pattern:style.pattern,geometry});
    }
    for(const blob of runs){
        const key=paintStyleKey(blob.color,blob.pattern);
        for(const [other,paint] of colors)if(other!==key){
            const remaining=polygonClipping.difference(paint.geometry,blob.geometry);
            if(remaining.length)colors.set(other,{...paint,geometry:remaining});else colors.delete(other);
        }
        if(key!==paintStyleKey(region.base,region.pattern)){
            const previous=colors.get(key);
            colors.set(key,{...blob,geometry:previous?polygonClipping.union(previous.geometry,blob.geometry):blob.geometry});
        }
    }
    const blobs=[...colors.values()];
    return {...region,blobs};
}
/** Bucket topology is calculated in the worker, never during pointer dispatch. */
export function filledRegion(region:VectorPaintRegion,color:number,point:Pair,pattern?:FillOptions,boundary?:MultiPolygon):VectorPaintRegion|undefined {
    const r=compactRegion(region),key=paintStyleKey(color,pattern);
    // Compaction makes visible color components disjoint. Test topmost first.
    for(const blob of [...r.blobs].reverse())for(const polygon of blob.geometry)if(containsGeometry([polygon],point)){
        if(paintStyleKey(blob.color,blob.pattern)===key)return;
        return {...r,blobs:[...r.blobs,{color,pattern,geometry:[polygon]}]};
    }
    if(paintStyleKey(r.base,r.pattern)===key)return;
    if(boundary){
        const background=polygonClipping.difference(boundary,...r.blobs.map(blob=>blob.geometry));
        if(background.length>1){
            const component=background.find(polygon=>containsGeometry([polygon],point));
            if(component)return {...r,blobs:[...r.blobs,{color,pattern,geometry:[component]}]};
        }
    }
    return {...r,base:color,pattern};
}
export function polygonPath(geometry: MultiPolygon) {
    return geometry.flatMap(p=>p.map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join('')+'Z')).join('');
}
export function containsGeometry(geometry: MultiPolygon, point: Pair) {
    return geometry.some(polygon=>{
        let inside=false;
        for(const ring of polygon){let hit=false;
            for(let i=0,j=ring.length-1;i<ring.length;j=i++){
                const a=ring[i]!,b=ring[j]!;
                if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
            }
            if(hit)inside=!inside;
        }
        return inside;
    });
}

/** Identical job semantics in the browser worker and the non-worker test fallback. */
export function runPaintJob(job: PaintJob) {
    return job.fill
        ? [filledRegion(job.regions[0]!, job.fill.color, job.fill.point, job.fill.pattern, job.fill.boundary)]
        : job.regions.map(compactRegion);
}
