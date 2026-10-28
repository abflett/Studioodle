import { createAdvancedSceneFixture } from './advanced-scene-fixture';
import { EditorSession } from '../../src/editor/EditorSession';
import { PaintDisplayCache } from '../../src/editor/paintDisplayCache';
import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import type { SavedPicture } from '../../src/editor/savedPicture';

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const frame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
const stats=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,p50Ms:sorted[Math.floor(sorted.length*.5)]??0,p95Ms:sorted[Math.floor(sorted.length*.95)]??0,maxMs:sorted.at(-1)??0};};
const palette=[0x8eaa59,0xd6ac6a,0xce7b50,0xf0ce8b,0x729ea1,0x986799,0x759659,0xe1a268];
let fixture:SavedPicture;
const workerJobs:{kind:string;queueMs:number;runMs:number;roundTripMs:number;postMs:number;depth:number}[]=[];
let pending=0,maxPending=0;
const NativeWorker=globalThis.Worker;
// Production transport and executor, instrumented only in this diagnostic.
globalThis.Worker=class extends NativeWorker {
 private requests=new Map<number,{sent:number;kind:string;postMs:number;depth:number}>();
 constructor(url:string|URL,options?:WorkerOptions){
  super(String(url).includes('vectorPaint.worker')?new URL('./profile-paint.worker.ts',import.meta.url):url,options);
  this.addEventListener('message',({data})=>{const request=this.requests.get(data.id);if(!request)return;this.requests.delete(data.id);pending--;
   workerJobs.push({kind:request.kind,queueMs:Math.max(0,data.profile.started-request.sent),runMs:data.profile.runMs,roundTripMs:performance.timeOrigin+performance.now()-request.sent,postMs:request.postMs,depth:request.depth});});
 }
 postMessage(message:unknown,options?:StructuredSerializeOptions|Transferable[]){
  const data=message as {id:number;fill?:unknown};const request={sent:performance.timeOrigin+performance.now(),kind:data.fill?'fill':'compact',postMs:0,depth:++pending};maxPending=Math.max(maxPending,pending);this.requests.set(data.id,request);
  if(Array.isArray(options))super.postMessage(message,options);else super.postMessage(message,options);request.postMs=performance.timeOrigin+performance.now()-request.sent;
 }
};
export async function prepareAdvancedScene(){
 const {picture,metrics}=await createAdvancedSceneFixture();fixture=picture;return metrics;
}
export async function profileAdvancedScene(dpr=1){
 if(!fixture)throw Error('Prepare the advanced scene first');
 const canvas=document.createElement('canvas');canvas.width=Math.round(1260*dpr);canvas.height=Math.round(891*dpr);
 Object.assign(canvas.style,{position:'fixed',inset:'0',width:'1260px',height:'891px',zIndex:'99999'});document.body.append(canvas);
 const ctx=canvas.getContext('2d')!,repository=createIndexedPictureRepository('studioodle-profile-temp');
 let view={zoom:1,x:0,y:0},refreshRequested=false,draws=0,rebuilds=0,deltas=0;
 const refresh=()=>{refreshRequested=true;};
 const cachesSeen=new Set<PaintDisplayCache>();
 const original=PaintDisplayCache.prototype.draw;
 PaintDisplayCache.prototype.draw=function(context,full,delta){cachesSeen.add(this);return original.call(this,context,target=>{rebuilds++;full(target);},(target,paint)=>{deltas++;delta(target,paint);});};
 const session=new EditorSession(fixture,{save:picture=>repository.save(picture),changed:()=>{}});
 const art=session.artwork,draw=()=>{ctx.resetTransform();ctx.clearRect(0,0,canvas.width,canvas.height);const scale=canvas.width/fixture.document.width*view.zoom;ctx.setTransform(scale,0,0,scale,-view.x*scale,-view.y*scale);art.render(ctx,false,refresh);draws++;refreshRequested=false;};
 const phases:Record<string,unknown>={},longTasks:number[]=[];
 const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push(entry.duration);});observer.observe({type:'longtask',buffered:false});
 try{
  const idleGaps:number[]=[];let idleLast=await frame();for(let i=0;i<20;i++){const now=await frame();idleGaps.push(now-idleLast);idleLast=now;}phases.blankCanvasRafGap=stats(idleGaps);
  let start=performance.now();draw();phases.coldDrawMs=performance.now()-start;
  // Prewarm exact clipping as a separate, reported first-action cost.
  session.execute({type:'set-tool',tool:'brush'});session.execute({type:'set-brush',options:{tip:'round',size:7}});
  const point={x:fixture.document.width*.5,y:fixture.document.height*.55};
  start=performance.now();session.begin(point,1,0);session.release(point,1,1);draw();phases.firstBrushAndDrawMs=performance.now()-start;
  await art.compactPaint();await pause(250);draw();workerJobs.length=0;maxPending=pending;
  for(const mode of ['paint','pan','zoom','zoomedPaint'] as const){
   console.info('scene: phase',mode);
   const brush:number[]=[],render:number[]=[],feedback:number[]=[],gaps:number[]=[];const beforeRebuilds=rebuilds;
   let previous={x:fixture.document.width*.3,y:fixture.document.height*.4},last=await frame();
   for(let step=0;step<60;step++){
    const now=await frame();gaps.push(now-last);last=now;
    const begin=performance.now();let brushEnd=begin;
    if(mode==='paint'||mode==='zoomedPaint'){
     if(step%10===0){session.execute({type:'set-color',color:palette[Math.floor(step/10)%palette.length]!});session.begin(previous,1,0);}
     const next={x:fixture.document.width*(.3+step*.0035),y:fixture.document.height*(.42+Math.sin(step*.12)*.13)};
     session.move(next,1,true,view.zoom);if(step%10===9)session.release(next,1,view.zoom);session.update(performance.now());previous=next;brushEnd=performance.now();brush.push(brushEnd-begin);
    }else if(mode==='pan'){view={zoom:1.8,x:Math.sin(step*.06)*180+180,y:Math.cos(step*.08)*110+110};}
    else{view={zoom:1+step/60*2,x:step*3,y:step*2};}
    draw();render.push(performance.now()-brushEnd);feedback.push(performance.now()-begin);
   }
   const presented=await frame();gaps.push(presented-last);
   phases[mode]={brush:stats(brush),renderSubmission:stats(render),actionToSubmission:stats(feedback),rafGap:stats(gaps),cacheRebuilds:rebuilds-beforeRebuilds,liveCachePixelBytes:[...cachesSeen].reduce((n,cache)=>{const c=Reflect.get(cache,'canvas') as HTMLCanvasElement|undefined;return n+(c?c.width*c.height*4:0);},0)};
   await pause(200);if(refreshRequested){start=performance.now();draw();phases[mode+'RefineMs']=performance.now()-start;}
  }
  session.execute({type:'set-tool',tool:'bucket'});const fills:number[]=[];
  for(let i=0;i<8;i++){
   session.execute({type:'set-color',color:palette[(i+2)%palette.length]!});start=performance.now();session.execute({type:'fill-at',point:{x:fixture.document.width*(.35+i*.025),y:fixture.document.height*.5}});
   await new Promise<void>(resolve=>session.execute({type:'snapshot',onComplete:()=>resolve()}));draw();fills.push(performance.now()-start);
  }
  phases.fillsIncludingDraw=stats(fills);
  console.info('scene: fills complete');
  start=performance.now();await art.compactPaint();while(pending)await pause(10);phases.backgroundDrainMs=performance.now()-start;
  start=performance.now();await new Promise<void>((resolve,reject)=>session.execute({type:'save',onComplete:ok=>ok?resolve():reject(Error('Profile save failed'))}));phases.saveMs=performance.now()-start;
  const jobs=[...workerJobs];phases.worker={jobs:jobs.length,maxPending,queue:stats(jobs.map(j=>j.queueMs)),execution:stats(jobs.map(j=>j.runMs)),roundTrip:stats(jobs.map(j=>j.roundTripMs)),postMessage:stats(jobs.map(j=>j.postMs)),fills:jobs.filter(j=>j.kind==='fill'),raw:jobs};
  await pause(100);observer.disconnect();phases.longTasks=stats(longTasks);phases.draws=draws;phases.cacheRebuilds=rebuilds;phases.incrementalDeltas=deltas;
  view={zoom:1,x:0,y:0};draw();
  return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,dpr,canvasPixels:canvas.width*canvas.height,phases,diagnosticPng:canvas.toDataURL(),document:fixture};
 }finally{observer.disconnect();session.dispose();PaintDisplayCache.prototype.draw=original;canvas.remove();await repository.delete(fixture.id);}
}
