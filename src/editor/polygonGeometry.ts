import { Clipper64, ClipType, FillRule, PolyTree64, ReuseableDataContainer64, PathType } from 'clipper2-ts';
import type { Paths64, PolyPath64 } from 'clipper2-ts';

export type Pair = [number, number];
export type Ring = Pair[];
export type MultiPolygon = Ring[][];
// Much finer than both SVG curve flattening and the brush grid. Every boolean
// input/output shares this lattice, including newly calculated intersections.
const geometryScale = 4096;
function paths(geometry: MultiPolygon): Paths64 {
    return geometry.flatMap(polygon=>polygon.flatMap((ring,index)=>{
        const points=ring.map(([x,y])=>({x:Math.round(x*geometryScale),y:Math.round(y*geometryScale)}))
            .filter((p,i,a)=>!i||p.x!==a[i-1]!.x||p.y!==a[i-1]!.y);
        if(points.length>1&&points[0]!.x===points.at(-1)!.x&&points[0]!.y===points.at(-1)!.y)points.pop();
        if(points.length<3)return [];
        const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length]!;return sum+a.x*b.y-b.x*a.y;},0);
        if(!area)return [];
        if((area>0)!==(index===0))points.reverse();
        return [points];
    }));
}
// Only explicitly registered immutable region boundaries are retained, never live paint.
const preparedBudget=8*1024*1024;
type Prepared={clip:ReuseableDataContainer64;subject?:ReuseableDataContainer64;bytes:number;vertices:number};
const prepared=new Map<MultiPolygon,Prepared>();let preparedBytes=0;
function trimPrepared(){while(preparedBytes>preparedBudget&&prepared.size){const oldest=prepared.keys().next().value!;preparedBytes-=prepared.get(oldest)!.bytes;prepared.delete(oldest);}}
export function prepareBooleanGeometry(geometry:MultiPolygon){
    const cached=prepared.get(geometry);if(cached){prepared.delete(geometry);prepared.set(geometry,cached);return;}
    const vertices=geometry.reduce((n,p)=>n+p.reduce((n,r)=>n+r.length,0),0),bytes=vertices*512+256;
    if(bytes>preparedBudget)return;
    const clip=new ReuseableDataContainer64();clip.addPaths(paths(geometry),PathType.Clip,false);
    prepared.set(geometry,{clip,vertices,bytes});preparedBytes+=bytes;trimPrepared();
}
export function booleanGeometryCacheStats(){return {entries:prepared.size,estimatedBytes:preparedBytes,budget:preparedBudget};}
function reusable(geometry:MultiPolygon,subject:boolean){
    const cached=prepared.get(geometry);if(!cached)return;
    prepared.delete(geometry);prepared.set(geometry,cached);
    if(!subject)return cached.clip;
    if(!cached.subject){cached.subject=new ReuseableDataContainer64();cached.subject.addPaths(paths(geometry),PathType.Subject,false);const extra=cached.vertices*512;cached.bytes+=extra;preparedBytes+=extra;trimPrepared();}
    return cached.subject;
}
function operation(type:ClipType,subject:MultiPolygon,clips:MultiPolygon[]):MultiPolygon {
    const engine=new Clipper64(),tree=new PolyTree64();
    const cached=reusable(subject,true);
    if(cached)engine.addReuseableData(cached);else engine.addSubject(paths(subject));
    for(const clip of clips){const cached=reusable(clip,false);if(cached)engine.addReuseableData(cached);else engine.addClip(paths(clip));}
    if(!engine.execute(type,FillRule.NonZero,tree))throw Error('Vector geometry operation failed');
    const output:MultiPolygon=[];
    const ring=(node:PolyPath64):Ring=>{
        const result=node.poly!.map(({x,y}):Pair=>[x/geometryScale,y/geometryScale]);
        result.push([...result[0]!] as Pair);return result;
    };
    const visit=(parent:PolyPath64)=>{for(let i=0;i<parent.count;i++){
        const node=parent.child(i);
        if(!node.isHole){const polygon=[ring(node)];for(let j=0;j<node.count;j++)polygon.push(ring(node.child(j)));output.push(polygon);}
        visit(node);
    }};
    visit(tree);return output;
}
export default {
    union:(subject:MultiPolygon,...clips:MultiPolygon[])=>operation(ClipType.Union,subject,clips),
    difference:(subject:MultiPolygon,...clips:MultiPolygon[])=>operation(ClipType.Difference,subject,clips),
    intersection:(subject:MultiPolygon,...clips:MultiPolygon[])=>{
        let result=subject;for(const clip of clips)result=operation(ClipType.Intersection,result,[clip]);return result;
    },
};
