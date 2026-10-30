import { brushBlob, compactRegion, compactRegionPrefix, filledRegion, containsGeometry } from '../../src/editor/vectorPaintGeometry';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';
import type { VectorPaintRegion } from '../../src/editor/vectorPaintTypes';
export function paintWorkloads() {
 const scattered:VectorPaintRegion={id:1,base:0xffffff,blobs:[]};
 for(let y=0;y<16;y++)for(let x=0;x<24;x++)scattered.blobs.push({color:1+(x+y)%12,geometry:rectangleGeometry(x*20+2,y*20+2,x*20+12,y*20+12)});
 const dense:VectorPaintRegion={id:1,base:0xffffff,blobs:[]};
 for(let i=0;i<240;i++){const a:[number,number]=[250+Math.sin(i*.19)*180,180+Math.cos(i*.13)*140],b:[number,number]=[250+Math.sin((i+1)*.19)*180,180+Math.cos((i+1)*.13)*140];dense.blobs.push({color:1+Math.floor(i/24)%5,geometry:brushBlob(a,b,4)});}
 return {scattered,dense};
}
export function profilePaintModel(){
 const cases=paintWorkloads(),results=[];
 for(const [name,input] of Object.entries(cases)){
  let start=performance.now();const compact=compactRegion(input);const compactMs=performance.now()-start;
  const more={...compact,blobs:[...compact.blobs,{color:999,geometry:brushBlob([240,160],[245,165],3)}]};
  start=performance.now();const incremental=compactRegionPrefix(more,compact.blobs.length);const incrementalMs=performance.now()-start;
  start=performance.now();const fill=filledRegion(compact,998,name==='scattered'?[5,5]:[250,180],undefined,rectangleGeometry(0,0,500,360),compact.blobs.length);const fillMs=performance.now()-start;
  const signature=(region:VectorPaintRegion|undefined)=>{if(!region)return '';let hash=2166136261;for(let y=1;y<360;y+=3)for(let x=1;x<500;x+=3){const color=[...region.blobs].reverse().find(b=>containsGeometry(b.geometry,[x,y]))?.color??region.base;hash=Math.imul(hash^color,16777619)>>>0;}return hash.toString(16);};
  results.push({name,compactMs,incrementalMs,fillMs,signature:[compact,incremental,fill].map(signature)});
 }
 const start=performance.now();let points=0;for(let i=0;i<10000;i++)points+=brushBlob([i*.031,0],[i*.031+2,3],8)[0]![0]!.length;
 return {results,brush10000Ms:performance.now()-start,points};
}
