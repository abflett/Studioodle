import { runPaintJob } from './vectorPaintGeometry';
import type { PaintJob } from './vectorPaintTypes';
self.onmessage=(event: MessageEvent<PaintJob & {id:number}>)=>{
    try { self.postMessage({id:event.data.id,regions:runPaintJob(event.data)}); }
    catch(error){self.postMessage({id:event.data.id,error:String(error)});}
};
