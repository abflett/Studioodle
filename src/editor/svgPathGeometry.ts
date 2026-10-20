import { SVGPathData } from 'svg-pathdata';
import polygonClipping from './polygonGeometry';
import type { MultiPolygon, Pair, Ring } from './polygonGeometry';
import { containsGeometry } from './vectorPaintGeometry';

/** Boolean geometry is flattened adaptively; display clipping retains the exact SVG curves. */
export function svgPathGeometry(d: string, matrix: number[], tolerance = .01): MultiPolygon {
    const commands = new SVGPathData(d).toAbs().normalizeHVZ(false).normalizeST().qtToC().aToC()
        .matrix(matrix[0]!,matrix[1]!,matrix[2]!,matrix[3]!,matrix[4]!,matrix[5]!).commands;
    const rings: Ring[] = []; let ring: Ring = [], current: Pair = [0,0];
    const close = () => { if(ring.length>2){if(ring[0]![0]!==ring.at(-1)![0]||ring[0]![1]!==ring.at(-1)![1])ring.push(ring[0]!);rings.push(ring);}ring=[]; };
    const midpoint = (a:Pair,b:Pair):Pair => [(a[0]+b[0])/2,(a[1]+b[1])/2];
    const curve = (a:Pair,b:Pair,c:Pair,end:Pair,depth=0) => {
        const dx=end[0]-a[0],dy=end[1]-a[1],length=Math.hypot(dx,dy);
        const distance=(p:Pair)=>length?Math.abs(dx*(a[1]-p[1])-(a[0]-p[0])*dy)/length:Math.hypot(p[0]-a[0],p[1]-a[1]);
        const excess=Math.hypot(b[0]-a[0],b[1]-a[1])+Math.hypot(c[0]-b[0],c[1]-b[1])+Math.hypot(end[0]-c[0],end[1]-c[1])-length;
        if(depth>=18||(Math.max(distance(b),distance(c))<=tolerance&&excess<=tolerance)){ring.push(end);return;}
        const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,end),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),middle=midpoint(abc,bcd);
        curve(a,ab,abc,middle,depth+1);curve(middle,bcd,cd,end,depth+1);
    };
    for(const command of commands){
        switch(command.type){
            case SVGPathData.MOVE_TO: close();current=[command.x,command.y];ring.push(current);break;
            case SVGPathData.LINE_TO: current=[command.x,command.y];ring.push(current);break;
            case SVGPathData.CURVE_TO: {const end:Pair=[command.x,command.y];curve(current,[command.x1,command.y1],[command.x2,command.y2],end);current=end;break;}
            case SVGPathData.CLOSE_PATH: close();break;
            default: throw Error('Unnormalized SVG curve');
        }
    }
    close();
    const area=(r:Ring)=>Math.abs(r.reduce((sum,a,i)=>{const b=r[(i+1)%r.length]!;return sum+a[0]*b[1]-b[0]*a[1];},0)/2);
    const ordered=rings.filter(r=>area(r)>1e-10).sort((a,b)=>area(b)-area(a));
    const polygons:MultiPolygon=[];const owners=new Map<Ring,{depth:number;polygon:Ring[]}>();
    for(let i=0;i<ordered.length;i++){
        const r=ordered[i]!;
        const parent=ordered.slice(0,i).reverse().find(outer=>containsGeometry([[outer]],r[0]!));
        const depth=parent?owners.get(parent)!.depth+1:0;
        if(depth%2===0){const polygon=[r];polygons.push(polygon);owners.set(r,{depth,polygon});}
        else {const polygon=owners.get(parent!)!.polygon;polygon.push(r);owners.set(r,{depth,polygon});}
    }
    if(!polygons.length)return [];
    return polygonClipping.union(polygons);
}
