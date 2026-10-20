import { compactRegion } from './vectorPaintGeometry';
import type { VectorPaintRegion } from './vectorPaintTypes';
self.onmessage=(event: MessageEvent<{id:number;regions:VectorPaintRegion[]}>)=>{
    try { self.postMessage({id:event.data.id,regions:event.data.regions.map(compactRegion)}); }
    catch(error){self.postMessage({id:event.data.id,error:String(error)});}
};
