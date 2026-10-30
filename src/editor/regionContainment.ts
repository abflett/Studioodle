import { containsGeometry } from './vectorPaintGeometry';
import type { MultiPolygon } from './polygonGeometry';
const indexes=new WeakMap<MultiPolygon,((bounds:readonly number[])=>boolean)|null>();
/** A cell containing no boundary segment has one exact inside/outside classification.
 * This is a conservative rejection of boolean work, never a raster clipping approximation. */
export function containsBrush(geometry:MultiPolygon,bounds:readonly number[],regionBounds:readonly number[]) {
    let test=indexes.get(geometry);
    if(test===undefined){test=build(geometry,regionBounds);indexes.set(geometry,test);}
    return test?.(bounds)??false;
}
function build(geometry:MultiPolygon,b:readonly number[]) {
    const [left,top,right,bottom]=b as [number,number,number,number],width=right-left,height=bottom-top;
    const unit=Math.max(8,Math.sqrt(width*height/1024));
    const columns=Math.max(1,Math.ceil(width/unit)),rows=Math.max(1,Math.ceil(height/unit));
    if(columns<3||rows<3)return null;
    const cells=new Uint8Array(columns*rows); // 0 unknown, 1 boundary, 2 outside, 3 inside
    const column=(x:number)=>Math.max(0,Math.min(columns-1,Math.floor((x-left)/width*columns)));
    const row=(y:number)=>Math.max(0,Math.min(rows-1,Math.floor((y-top)/height*rows)));
    const epsilon=1/4096;
    for(const polygon of geometry)for(const ring of polygon)for(let i=1;i<ring.length;i++){
        const a=ring[i-1]!,p=ring[i]!;
        for(let y=row(Math.min(a[1],p[1])-epsilon);y<=row(Math.max(a[1],p[1])+epsilon);y++)
            for(let x=column(Math.min(a[0],p[0])-epsilon);x<=column(Math.max(a[0],p[0])+epsilon);x++)cells[y*columns+x]=1;
    }
    return (bounds:readonly number[])=>{
        if(bounds[0]!<left||bounds[1]!<top||bounds[2]!>right||bounds[3]!>bottom)return false;
        for(let y=row(bounds[1]!);y<=row(bounds[3]!);y++)for(let x=column(bounds[0]!);x<=column(bounds[2]!);x++){
            const index=y*columns+x;
            if(!cells[index])cells[index]=containsGeometry(geometry,[left+(x+.5)/columns*width,top+(y+.5)/rows*height])?3:2;
            if(cells[index]!==3)return false;
        }
        return true;
    };
}
