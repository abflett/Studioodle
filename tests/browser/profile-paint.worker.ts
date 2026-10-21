// Diagnostic worker: same production executor, with queue/run timestamps added.
import { runPaintJob } from '../../src/editor/vectorPaintGeometry';
import type { PaintJob } from '../../src/editor/vectorPaintTypes';
self.onmessage=(event:MessageEvent<PaintJob&{id:number}>)=>{
 const started=performance.timeOrigin+performance.now();
 try{const regions=runPaintJob(event.data);self.postMessage({id:event.data.id,regions,profile:{started,runMs:performance.timeOrigin+performance.now()-started}});}
 catch(error){self.postMessage({id:event.data.id,error:String(error)});}
};
