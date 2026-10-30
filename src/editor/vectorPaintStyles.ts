import type { MultiPolygon, Pair } from './polygonGeometry';
import type { BrushOptions, FillOptions } from './toolOptions';
import { brushBlob } from './vectorPaintGeometry';

export function geometryBounds(geometry:MultiPolygon){
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const polygon of geometry)for(const ring of polygon)for(const [x,y] of ring){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    return [left,top,right,bottom];
}
export const rectangleGeometry=(left:number,top:number,right:number,bottom:number):MultiPolygon=>[[[[left,top],[right,top],[right,bottom],[left,bottom],[left,top]]]];
export const mapGeometry=(geometry:MultiPolygon,point:(p:Pair)=>Pair):MultiPolygon=>geometry.map(p=>p.map(r=>r.map(point)));

/** Sweep a thin fixed-angle elliptical nib; its angle does not follow the stroke. */
export function diagonalTipStroke(a: Pair, b: Pair, radius: number, rising: boolean): MultiPolygon {
    const angle = rising ? -Math.PI / 4 : Math.PI / 4, c = Math.cos(angle), s = Math.sin(angle), aspect = .14;
    const local = ([x, y]: Pair): Pair => [c * x + s * y, (-s * x + c * y) / aspect];
    return mapGeometry(brushBlob(local(a), local(b), radius), ([u, v]) => [c * u - s * v * aspect, s * u + c * v * aspect]);
}

/** Ordinary brush geometry only; raster spray never enters boolean topology. */
export function styledStroke(a:Pair,b:Pair,radius:number,options:BrushOptions):MultiPolygon{
    if(options.tip==='round')return brushBlob(a,b,radius);
    if(options.tip==='diagonal-up'||options.tip==='diagonal-down')return diagonalTipStroke(a,b,radius,options.tip==='diagonal-up');
    throw Error('Spray belongs to the raster overlay.');
}

const patterns=new Map<string,Path2D>();
export function drawPaint(ctx:CanvasRenderingContext2D,path:Path2D,color:number,bounds:number[],pattern?:FillOptions){
    const hex=(n:number)=>`#${n.toString(16).padStart(6,'0')}`;
    if(!pattern||pattern.pattern==='solid'){ctx.fillStyle=hex(color);ctx.fill(path);return;}
    ctx.fillStyle='white';ctx.fill(path);ctx.save();ctx.clip(path);
    const key=`${pattern.pattern}:${pattern.spacing}:${bounds.join(',')}`;
    let tile=patterns.get(key);
    if(!tile){
        tile=new Path2D();const [left,top,right,bottom]=bounds as [number,number,number,number],s=pattern.spacing;
        if(pattern.pattern==='stripes'){
            for(let sum=Math.floor((left+top)/s)*s;sum<right+bottom+s;sum+=s){tile.moveTo(sum-top,top);tile.lineTo(sum+s/2-top,top);tile.lineTo(sum+s/2-bottom,bottom);tile.lineTo(sum-bottom,bottom);tile.closePath();}
        }else for(let y=Math.floor(top/s);y<=Math.ceil(bottom/s);y++)for(let x=Math.floor(left/s);x<=Math.ceil(right/s);x++){
            if(pattern.pattern==='checker'){if((x+y)%2===0)tile.rect(x*s,y*s,s,s);}
            else {tile.moveTo((x+.75)*s,(y+.5)*s);tile.arc((x+.5)*s,(y+.5)*s,s/4,0,2*Math.PI);}
        }
        if(patterns.size>=64)patterns.delete(patterns.keys().next().value!);patterns.set(key,tile);
    }
    ctx.fillStyle=hex(color);ctx.fill(tile);ctx.restore();
}

/** Construct browser paths directly from numeric paint geometry, without SVG text. */
export function paintPath(geometry:MultiPolygon):Path2D {
    const path=new Path2D();
    for(const polygon of geometry)for(const ring of polygon){
        const first=ring[0];if(!first)continue;
        path.moveTo(first[0],first[1]);
        const last=ring.at(-1)!,end=last[0]===first[0]&&last[1]===first[1]?ring.length-1:ring.length;
        for(let i=1;i<end;i++)path.lineTo(ring[i]![0],ring[i]![1]);
        path.closePath();
    }
    return path;
}
