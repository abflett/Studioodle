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
    private scale=1;
    private settle?:ReturnType<typeof setTimeout>;
    private requestedScale=0;
    private pending: DisplayPaint[] = [];
    append(paint: DisplayPaint) { if (this.key) this.pending.push(paint); }
    invalidate() { this.key = ''; this.pending = []; }
    dispose() {
        if(this.settle)clearTimeout(this.settle);this.settle=undefined;
        allocated -= caches.get(this) ?? 0; caches.delete(this);
        if (this.canvas) this.canvas.width = this.canvas.height = 1;
        this.canvas = undefined; this.context = undefined; this.invalidate();
    }
    draw(ctx: CanvasRenderingContext2D, definition: VectorDefinition,
        full: (ctx: CanvasRenderingContext2D) => void,
        delta: (ctx: CanvasRenderingContext2D, paint: DisplayPaint) => void, refresh?:()=>void): boolean {
        const m=ctx.getTransform(),b=definition.bounds;
        const corners=[[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom]].map(([x,y])=>({x:m.a*x!+m.c*y!+m.e,y:m.b*x!+m.d*y!+m.f}));
        if(Math.max(...corners.map(p=>p.x))<0||Math.min(...corners.map(p=>p.x))>ctx.canvas.width||Math.max(...corners.map(p=>p.y))<0||Math.min(...corners.map(p=>p.y))>ctx.canvas.height)return true;
        const logicalWidth=b.right-b.left,logicalHeight=b.bottom-b.top;
        if(logicalWidth<=0||logicalHeight<=0)return true;
        const desired=Math.min(Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)),Math.sqrt((budget/4)/(logicalWidth*logicalHeight)));
        // Translation and rotation never invalidate a surface-local display.
        // During zoom reuse it, then refine once the view has settled.
        if(this.key&&desired!==this.scale&&refresh){
            if(this.requestedScale!==desired){
                this.requestedScale=desired;if(this.settle)clearTimeout(this.settle);
                this.settle=setTimeout(()=>{this.settle=undefined;this.invalidate();refresh();},150);
            }
        }else if(!this.key||!refresh){this.scale=desired;this.requestedScale=desired;}
        const width=Math.max(1,Math.floor(logicalWidth*this.scale)),height=Math.max(1,Math.floor(logicalHeight*this.scale));
        const bytes=width*height*4;
        if(bytes>budget){this.dispose();return false;}
        const key=[this.scale,b.left,b.top,width,height].join(',');
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
            target.setTransform(width/logicalWidth,0,0,height/logicalHeight,-b.left*width/logicalWidth,-b.top*height/logicalHeight);
            full(target);this.key=key;
        }else{
            target.setTransform(width/logicalWidth,0,0,height/logicalHeight,-b.left*width/logicalWidth,-b.top*height/logicalHeight);
            for(const paint of this.pending)delta(target,paint);
        }
        this.pending=[];
        ctx.drawImage(this.canvas,b.left,b.top,logicalWidth,logicalHeight);
        return true;
    }
}
