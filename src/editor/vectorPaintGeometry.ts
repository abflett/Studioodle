import { paintStyleKey } from './vectorPaintTypes';
import polygonClipping from './polygonGeometry';
import type { MultiPolygon, Pair } from './polygonGeometry';
import type { PaintBlob, PaintJob, VectorPaintRegion } from './vectorPaintTypes';
import type { FillOptions } from './toolOptions';

// Geometry is immutable after publication; these bounds disappear with its owners.
const boundsCache = new WeakMap<object, readonly number[]>();
function bounds(geometry: MultiPolygon): readonly number[] {
    let cached=boundsCache.get(geometry);if(cached)return cached;
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const polygon of geometry)for(const ring of polygon)for(const [x,y] of ring){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    cached=[left,top,right,bottom];boundsCache.set(geometry,cached);return cached;
}
function polygonBounds(polygon: MultiPolygon[number]) {
    let cached=boundsCache.get(polygon);if(!cached){cached=bounds([polygon]);boundsCache.set(polygon,cached);}return cached;
}
const overlap=(a:readonly number[],b:readonly number[])=>a[0]!<=b[2]!+1/4096&&a[2]!>=b[0]!-1/4096&&a[1]!<=b[3]!+1/4096&&a[3]!>=b[1]!-1/4096;
const localShapes=new WeakMap<MultiPolygon,boolean>();
function localShape(geometry:MultiPolygon){
    let small=localShapes.get(geometry);if(small!==undefined)return small;
    let nodes=0;small=true;
    outer:for(const polygon of geometry)for(const ring of polygon)if((nodes+=ring.length)>128){small=false;break outer;}
    localShapes.set(geometry,small);return small;
}
/** Keep distant components out of boolean work; holes stay attached to their outer ring. */
function subtractPaint(subject: MultiPolygon, clip: MultiPolygon): MultiPolygon {
    if(subject.length<4||!localShape(clip))return polygonClipping.difference(subject,clip);
    const box=bounds(clip);if(!overlap(bounds(subject),box))return subject;
    const nearby:MultiPolygon=[],untouched:MultiPolygon=[];
    for(const polygon of subject)(overlap(polygonBounds(polygon),box)?nearby:untouched).push(polygon);
    return nearby.length?[...untouched,...polygonClipping.difference(nearby,clip)]:subject;
}
function unionPaint(a: MultiPolygon,b: MultiPolygon): MultiPolygon {
    if(!a.length)return b;if(!b.length)return a;
    if((a.length===1&&b.length===1)||!localShape(b))return polygonClipping.union(a,b);
    const ab=bounds(a),bb=bounds(b);if(!overlap(ab,bb))return [...a,...b];
    const nearA:MultiPolygon=[],nearB:MultiPolygon=[],untouched:MultiPolygon=[];
    for(const polygon of a)(overlap(polygonBounds(polygon),bb)?nearA:untouched).push(polygon);
    for(const polygon of b)(overlap(polygonBounds(polygon),ab)?nearB:untouched).push(polygon);
    if(!nearA.length||!nearB.length)return [...a,...b];
    return [...untouched,...polygonClipping.union(nearA,nearB)];
}
const circles=new Map<number, Pair[]>();
function circle(radius: number) {
    let points=circles.get(radius);if(points)return points;
    const steps=Math.min(128,Math.max(16,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-.01/Math.max(radius,.01))))));
    points=Array.from({length:steps},(_,i):Pair=>[Math.cos(i*2*Math.PI/steps)*radius,Math.sin(i*2*Math.PI/steps)*radius]);
    if(circles.size>=64)circles.delete(circles.keys().next().value!);circles.set(radius,points);return points;
}
const brushGrid = 64;
const snap = (n: number) => Math.round(n * brushGrid) / brushGrid;
/** Capsule outline, bounded chord error, with input nodes on a fine logical grid. */
export function brushBlob(a: Pair, b: Pair, radius: number, square = false): MultiPolygon {
    const points: Pair[] = [];
    if(square) {
        for(const p of [a,b])for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]])points.push([snap(p[0]+x!*radius),snap(p[1]+y!*radius)]);
    } else {
        for(const p of a[0]===b[0]&&a[1]===b[1]?[a]:[a,b])for(const [x,y] of circle(radius))points.push([snap(p[0]+x),snap(p[1]+y)]);
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
export function compactRegion(region:VectorPaintRegion):VectorPaintRegion {return compactRegionPrefix(region,0);}
export function compactRegionPrefix(region: VectorPaintRegion, compacted=0): VectorPaintRegion {
    const colors=new Map<string,PaintBlob>();
    // The worker's accepted prefix is already disjoint and merged by style.
    // Reuse it instead of serializing and clipping old colors against each other.
    for(const blob of region.blobs.slice(0,compacted)){
        const key=paintStyleKey(blob.color,blob.pattern);
        if(key!==paintStyleKey(region.base,region.pattern))colors.set(key,blob);
    }
    // Union consecutive same-color strokes in batches, deduplicating repeated
    // coverage before running any boolean work. Color order remains intact.
    const runs:PaintBlob[]=[];
    for(let index=compacted;index<region.blobs.length;){
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
            const remaining=subtractPaint(paint.geometry,blob.geometry);
            if(remaining.length)colors.set(other,{...paint,geometry:remaining});else colors.delete(other);
        }
        if(key!==paintStyleKey(region.base,region.pattern)){
            const previous=colors.get(key);
            colors.set(key,{...blob,geometry:previous?unionPaint(previous.geometry,blob.geometry):blob.geometry});
        }
    }
    const blobs=[...colors.values()];
    return {...region,blobs};
}
/** Bucket topology is calculated in the worker, never during pointer dispatch. */
export function filledRegion(region:VectorPaintRegion,color:number,point:Pair,pattern?:FillOptions,boundary?:MultiPolygon,compacted=0):VectorPaintRegion|undefined {
    const r=compactRegionPrefix(region,compacted),key=paintStyleKey(color,pattern);
    // Return a fully compacted fill so the first frame has the same boundaries
    // as later maintenance. Overlaid replacement blobs can leave an old-color
    // antialias fringe until their shared edges are removed.
    // Compaction makes visible color components disjoint. Test topmost first.
    for(let index=r.blobs.length-1;index>=0;index--){
        const blob=r.blobs[index]!;
        for(const polygon of blob.geometry){
            const box=polygonBounds(polygon);
            if(point[0]<box[0]!||point[0]>box[2]!||point[1]<box[1]!||point[1]>box[3]!||!containsGeometry([polygon],point))continue;
            if(paintStyleKey(blob.color,blob.pattern)===key)return;
            return recolorComponent(r,color,pattern,[polygon],index);
        }
    }
    if(paintStyleKey(r.base,r.pattern)===key)return;
    if(boundary){
        const background=polygonClipping.difference(boundary,...r.blobs.map(blob=>blob.geometry));
        if(background.length>1){
            const component=background.find(polygon=>containsGeometry([polygon],point));
            if(component)return recolorComponent(r,color,pattern,[component]);
        }
    }
    return {...r,base:color,pattern,blobs:r.blobs.filter(blob=>paintStyleKey(blob.color,blob.pattern)!==key)};
}
/** The input partitions are disjoint. Only the source and destination styles can change. */
function recolorComponent(region: VectorPaintRegion,color:number,pattern:FillOptions|undefined,component:MultiPolygon,source=-1):VectorPaintRegion {
    const key=paintStyleKey(color,pattern),blobs:PaintBlob[]=[];
    let target:PaintBlob|undefined;
    for(let index=0;index<region.blobs.length;index++){
        const blob=region.blobs[index]!;
        if(paintStyleKey(blob.color,blob.pattern)===key){target=blob;continue;}
        if(index===source){const geometry=blob.geometry.filter(polygon=>polygon!==component[0]);if(geometry.length)blobs.push({...blob,geometry});}
        else blobs.push(blob);
    }
    if(key!==paintStyleKey(region.base,region.pattern))blobs.push({color,pattern,geometry:target?unionPaint(target.geometry,component):component});
    return {...region,blobs};
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
        ? [filledRegion(job.regions[0]!, job.fill.color, job.fill.point, job.fill.pattern, job.fill.boundary, job.compacted?.[0]??0)]
        : job.regions.map((region,index)=>compactRegionPrefix(region,job.compacted?.[index]??0));
}
