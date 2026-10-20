import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Pair } from 'polygon-clipping';
import type { PaintBlob, VectorPaintRegion } from './vectorPaintTypes';

export const brushGrid = 64;
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
    const colors=new Map<number,MultiPolygon>();
    // Union consecutive same-color strokes in batches, deduplicating repeated
    // coverage before running any boolean work. Color order remains intact.
    const runs:PaintBlob[]=[];
    for(let index=0;index<region.blobs.length;){
        const color=region.blobs[index]!.color,unique=new Map<string,MultiPolygon>();
        while(index<region.blobs.length&&region.blobs[index]!.color===color){
            const geometry=region.blobs[index++]!.geometry;
            if(geometry.length)unique.set(JSON.stringify(geometry),geometry);
        }
        const shapes=[...unique.values()];let geometry:MultiPolygon=[];
        for(let i=0;i<shapes.length;i+=64){
            const batch=shapes.slice(i,i+64);
            geometry=polygonClipping.union(geometry.length?geometry:batch.shift()!,...batch);
        }
        if(geometry.length)runs.push({color,geometry});
    }
    for(const blob of runs){
        for(const [color,geometry] of colors)if(color!==blob.color){
            const remaining=polygonClipping.difference(geometry,blob.geometry);
            if(remaining.length)colors.set(color,remaining);else colors.delete(color);
        }
        if(blob.color!==region.base){
            const previous=colors.get(blob.color);
            colors.set(blob.color,previous?polygonClipping.union(previous,blob.geometry):blob.geometry);
        }
    }
    const blobs:PaintBlob[]=[...colors].map(([color,geometry])=>({color,geometry}));
    return {...region,blobs};
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
