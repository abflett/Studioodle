import { compactRegion, filledRegion } from './vectorPaintGeometry';
import type { PaintJob } from './vectorPaintTypes';
function runPaintJob(job:PaintJob){return job.fill?[filledRegion(job.regions[0]!,job.fill.color,job.fill.point,job.fill.pattern,job.fill.boundary)]:job.regions.map(compactRegion);}
self.onmessage=(event: MessageEvent<PaintJob & {id:number}>)=>{
    try { self.postMessage({id:event.data.id,regions:runPaintJob(event.data)}); }
    catch(error){self.postMessage({id:event.data.id,error:String(error)});}
};
