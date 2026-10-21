import type { VectorDefinition } from './vectorDefinition';
import type { PaintBlob } from './vectorPaintTypes';

export type DisplayPaint = PaintBlob & { regionId: number };
// Disposable RGBA display pixels, shared across all surfaces. Documents stay vector.
export const paintDisplayBudget = 64 * 1024 * 1024;
const caches = new Map<PaintDisplayCache, number>();
let allocated = 0;
type Rect = { left:number; top:number; right:number; bottom:number };
type Plan = Rect & { scale:number; width:number; height:number };
export type DisplayRequest = { cache:PaintDisplayCache; rect:Rect; scale:number };
const contains=(a:Rect,b:Rect)=>a.left<=b.left&&a.top<=b.top&&a.right>=b.right&&a.bottom>=b.bottom;
const area=(r:Rect)=>(r.right-r.left)*(r.bottom-r.top);
function transformedRect(m:DOMMatrix,r:Rect):Rect {
    const points=[[r.left,r.top],[r.right,r.top],[r.left,r.bottom],[r.right,r.bottom]].map(([x,y])=>({x:m.a*x!+m.c*y!+m.e,y:m.b*x!+m.d*y!+m.f}));
    return {left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
}
const intersect=(a:Rect,b:Rect):Rect=>({left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)});

export class PaintDisplayCache {
    private canvas?: HTMLCanvasElement;
    private context?: CanvasRenderingContext2D;
    private pixels?:Plan;
    private plan?:Plan;
    private dirty=true;
    private settle?:ReturnType<typeof setTimeout>;
    private requestedScale=0;
    private refine=false;
    private pending:DisplayPaint[]=[];
    append(paint:DisplayPaint){if(this.pixels&&!this.dirty)this.pending.push(paint);}
    invalidate(){this.dirty=true;this.pending=[];}
    private release(){
        allocated-=caches.get(this)??0;caches.delete(this);
        if(this.canvas)this.canvas.width=this.canvas.height=1;
        this.canvas=undefined;this.context=undefined;this.pixels=undefined;this.invalidate();
    }
    dispose(){if(this.settle)clearTimeout(this.settle);this.settle=undefined;this.plan=undefined;this.release();}

    request(ctx:CanvasRenderingContext2D,definition:VectorDefinition,refresh?:()=>void):DisplayRequest|undefined {
        this.plan=undefined;
        const m=ctx.getTransform(),inverse=m.inverse(),b=definition.bounds;
        if(!Number.isFinite(inverse.a))return;
        const viewport={left:0,top:0,right:ctx.canvas.width,bottom:ctx.canvas.height};
        const visible=intersect(b,transformedRect(inverse,viewport));
        if(area(visible)<=0||visible.right<=visible.left||visible.bottom<=visible.top)return;
        const desired=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));
        let scale=desired;
        if(this.pixels&&refresh&&!this.refine){
            // Reproject during zoom; refine once, after the view settles.
            if(this.requestedScale!==desired){
                this.requestedScale=desired;if(this.settle)clearTimeout(this.settle);
                this.settle=setTimeout(()=>{this.settle=undefined;this.refine=true;refresh();},150);
            }
            scale=this.pixels.scale;
        }
        const keep=this.pixels&&contains(this.pixels,visible)&&!this.refine;
        const marginX=ctx.canvas.width*.18,marginY=ctx.canvas.height*.18;
        const rect=keep?this.pixels!:intersect(b,transformedRect(inverse,{left:-marginX,top:-marginY,right:viewport.right+marginX,bottom:viewport.bottom+marginY}));
        this.refine=false;this.requestedScale=desired;
        return {cache:this,rect,scale};
    }

    /** Allocate the visible working set together, so surfaces cannot evict peers in the same frame. */
    static prepareFrame(requests:DisplayRequest[]){
        const wanted=requests.reduce((n,r)=>n+area(r.rect)*r.scale*r.scale*4,0);
        const factor=Math.min(1,Math.sqrt(paintDisplayBudget*.9/Math.max(1,wanted)));
        const active=new Set(requests.map(r=>r.cache));
        let planned=0;
        for(const request of requests){
            const {cache,rect}=request;
            // Quantized reductions avoid oscillation around a memory threshold.
            const scale=factor<1?Math.pow(2,Math.floor(Math.log2(request.scale*factor)*4)/4):request.scale;
            const width=Math.max(1,Math.floor((rect.right-rect.left)*scale)),height=Math.max(1,Math.floor((rect.bottom-rect.top)*scale));
            cache.plan={...rect,scale,width,height};planned+=width*height*4;
        }
        // Release resized members first, before reserving the whole frame.
        for(const {cache} of requests)if(cache.pixels&&(cache.pixels.width!==cache.plan!.width||cache.pixels.height!==cache.plan!.height))cache.release();
        const activeBytes=[...active].reduce((n,c)=>n+(caches.get(c)??0),0);
        for(const [cache] of caches){
            if(allocated-activeBytes+planned<=paintDisplayBudget)break;
            if(!active.has(cache))cache.release();
        }
    }

    draw(ctx:CanvasRenderingContext2D,full:(ctx:CanvasRenderingContext2D)=>void,
        delta:(ctx:CanvasRenderingContext2D,paint:DisplayPaint)=>void):boolean {
        const plan=this.plan;if(!plan)return true;
        const bytes=plan.width*plan.height*4;
        if(!this.canvas){
            this.canvas=document.createElement('canvas');this.context=this.canvas.getContext('2d')??undefined;
            if(!this.context){this.release();return false;}
        }
        allocated-=caches.get(this)??0;caches.delete(this);caches.set(this,bytes);allocated+=bytes;
        const target=this.context!,old=this.pixels;
        const changed=!old||old.width!==plan.width||old.height!==plan.height||old.left!==plan.left||old.top!==plan.top||old.right!==plan.right||old.bottom!==plan.bottom;
        if(!old||old.width!==plan.width||old.height!==plan.height){this.canvas.width=plan.width;this.canvas.height=plan.height;}
        else if(changed||this.dirty){target.resetTransform();target.clearRect(0,0,plan.width,plan.height);}
        target.setTransform(plan.width/(plan.right-plan.left),0,0,plan.height/(plan.bottom-plan.top),-plan.left*plan.width/(plan.right-plan.left),-plan.top*plan.height/(plan.bottom-plan.top));
        if(changed||this.dirty){full(target);this.dirty=false;}
        else for(const paint of this.pending)delta(target,paint);
        this.pending=[];this.pixels=plan;
        ctx.drawImage(this.canvas,plan.left,plan.top,plan.right-plan.left,plan.bottom-plan.top);
        return true;
    }
}
