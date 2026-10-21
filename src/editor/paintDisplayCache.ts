import type { VectorDefinition } from './vectorDefinition';
import type { PaintBlob } from './vectorPaintTypes';

export type DisplayPaint = PaintBlob & { regionId: number };
// Disposable presentation pixels only. Document paint, hits and export stay vector.
const budget = 32 * 1024 * 1024;
const caches = new Map<PaintDisplayCache, number>();
let allocated = 0;

export class PaintDisplayCache {
    private canvas?: HTMLCanvasElement;
    private context?: CanvasRenderingContext2D;
    private key = '';
    private pending: DisplayPaint[] = [];
    append(paint: DisplayPaint) { if (this.key) this.pending.push(paint); }
    invalidate() { this.key = ''; this.pending = []; }
    dispose() {
        allocated -= caches.get(this) ?? 0; caches.delete(this);
        if (this.canvas) this.canvas.width = this.canvas.height = 1;
        this.canvas = undefined; this.context = undefined; this.invalidate();
    }
    draw(ctx: CanvasRenderingContext2D, definition: VectorDefinition,
        full: (ctx: CanvasRenderingContext2D) => void,
        delta: (ctx: CanvasRenderingContext2D, paint: DisplayPaint) => void): boolean {
        const m=ctx.getTransform(),b=definition.bounds;
        const corners=[[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom]].map(([x,y])=>({x:m.a*x!+m.c*y!+m.e,y:m.b*x!+m.d*y!+m.f}));
        const left=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x)))-2),top=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))-2);
        const right=Math.min(ctx.canvas.width,Math.ceil(Math.max(...corners.map(p=>p.x)))+2),bottom=Math.min(ctx.canvas.height,Math.ceil(Math.max(...corners.map(p=>p.y)))+2);
        const width=right-left,height=bottom-top;
        if(width<=0||height<=0)return true;
        const bytes=width*height*4;
        if(bytes>budget){this.dispose();return false;}
        const key=[m.a,m.b,m.c,m.d,m.e,m.f,left,top,width,height].join(',');
        if(!this.canvas){
            this.canvas=document.createElement('canvas');
            this.context=this.canvas.getContext('2d')??undefined;
            if(!this.context){this.dispose();return false;}
        }
        allocated-=caches.get(this)??0;caches.delete(this);
        while(allocated+bytes>budget)caches.keys().next().value!.dispose();
        caches.set(this,bytes);allocated+=bytes;
        const target=this.context!;
        if(this.key!==key){
            this.canvas.width=width;this.canvas.height=height;
            target.setTransform(m.a,m.b,m.c,m.d,m.e-left,m.f-top);
            full(target);this.key=key;
        }else{
            target.setTransform(m.a,m.b,m.c,m.d,m.e-left,m.f-top);
            for(const paint of this.pending)delta(target,paint);
        }
        this.pending=[];
        ctx.save();ctx.resetTransform();ctx.drawImage(this.canvas,left,top);ctx.restore();
        return true;
    }
}
