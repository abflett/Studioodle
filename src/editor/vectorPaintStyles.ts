import polygonClipping from './polygonGeometry';
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

/** Opaque vector coverage: round/diagonal strokes or accumulating scattered circles. */
export function styledStroke(a:Pair,b:Pair,radius:number,options:BrushOptions):MultiPolygon{
    if(options.tip==='round')return brushBlob(a,b,radius);
    if(options.tip==='diagonal-up'||options.tip==='diagonal-down')return diagonalTipStroke(a,b,radius,options.tip==='diagonal-up');
    const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
    const bounds=[Math.min(a[0],b[0])-radius,Math.min(a[1],b[1])-radius,Math.max(a[0],b[0])+radius,Math.max(a[1],b[1])+radius];
    const spacing=Math.max(1.1,Math.sqrt((bounds[2]!-bounds[0]!)*(bounds[3]!-bounds[1]!)/600));
    const particles:MultiPolygon[]=[];
    const phase=Math.random()*65536;
    const random=(x:number,y:number)=>{const n=Math.sin((x+phase)*127.1+(y+phase)*311.7)*43758.5453;return n-Math.floor(n);};
    for(let gy=Math.floor(bounds[1]!/spacing);gy<=Math.ceil(bounds[3]!/spacing);gy++)for(let gx=Math.floor(bounds[0]!/spacing);gx<=Math.ceil(bounds[2]!/spacing);gx++){
        // Cover the full cell so repeated applications do not leave permanent grid holes.
        const x=(gx+random(gx,gy))*spacing,y=(gy+random(gy,gx))*spacing;
        const t=length2?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length2)):0;
        const distance=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
        if(distance>radius||random(gx+13,gy-7)>.28*(1-distance/radius*.6))continue;
        particles.push(brushBlob([x,y],[x,y],spacing*.2));
    }
    if(!particles.length)return [];
    let result:MultiPolygon=[];
    for(let i=0;i<particles.length;i+=64){const batch=particles.slice(i,i+64);result=polygonClipping.union(result.length?result:batch.shift()!,...batch);}
    return result;
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
