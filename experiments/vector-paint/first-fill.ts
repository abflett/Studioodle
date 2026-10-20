import { EditorSession } from '../../src/editor/EditorSession';
import { paintWorkerMetrics } from '../../src/editor/VectorPaint';
import { VectorPaint } from '../../src/editor/VectorPaint';
import { brushBlob } from '../../src/editor/vectorPaintGeometry';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export async function checkFirstFill(){
 // Read-only restores used by previews must not start or enqueue worker jobs.
 const previewData={version:1 as const,regions:[{id:1,base:0xffffff,blobs:Array.from({length:200},(_,i)=>({color:i%2?0x242428:0xff8800,geometry:brushBlob([40+i/5,40],[45+i/5,45],2)}))}]};
 const restored=Array.from({length:12},()=>new VectorPaint(previewData));
 await new Promise(resolve=>setTimeout(resolve,150));
 assert(paintWorkerMetrics().jobs.length===0&&paintWorkerMetrics().startupMs===0,'Read-only restores must not load or occupy the worker');
 assert(restored.every(p=>p.serialize().regions[0]!.blobs.length===200),'Restoring must not rewrite saved geometry');
 const session=new EditorSession({id:'cold-fill',title:'Cold fill',format:'landscape',size:{width:1754,height:1240},background:'#cce8ff',leafColor:0x242428},{save:()=>{},changed:()=>{}});
 session.execute({type:'set-tool',tool:'brush'});session.execute({type:'set-brush',options:{kind:'ink',shape:'round',size:5}});
 session.begin({x:310,y:160},1,0);
 for(let i=1;i<=2400;i++){const t=i/2400*Math.PI*2,jitter=Math.sin(i*13)*.8;session.move({x:240+(70+jitter)*Math.cos(t),y:160+(85+jitter)*Math.sin(t)},1,true,.47);}
 session.release({x:310,y:160},1,.47);
 session.execute({type:'set-tool',tool:'bucket'});session.execute({type:'set-color',color:0xff8811});
 const start=performance.now();session.execute({type:'fill-at',point:{x:240,y:160}});await session.settled();
 const firstFillMs=performance.now()-start;
 assert(firstFillMs<1500,`First blank-page ink fill took ${firstFillMs.toFixed(1)}ms`);
 session.execute({type:'set-color',color:0xff11aa});const next=performance.now();session.execute({type:'fill-at',point:{x:240,y:160}});await session.settled();
 const nextFillMs=performance.now()-next;
 const metrics=paintWorkerMetrics();
 assert(metrics.jobs.filter(job=>job.kind==='fill')[0]!.computeMs<100,'First fill must reuse completed stroke compaction');
 return {firstFillMs,nextFillMs,readOnlyRestores:restored.length,inputSamples:2400,...metrics};
}
