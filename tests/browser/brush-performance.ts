import { Artwork as CurrentArtwork } from '../../src/editor/Artwork';
import { decodeSvgDefinition } from '../../src/editor/svgDefinition';
import polygons from '../../src/editor/polygonGeometry';
import type { MultiPolygon } from '../../src/editor/polygonGeometry';
import type { BrushOptions } from '../../src/editor/toolOptions';

/** Diagnostic timings only: deterministic geometry/count regressions live in unit tests. */
export async function profileBrush(Artwork:typeof CurrentArtwork=CurrentArtwork) {
 const source=await(await fetch('/src/assets/vector/fantasy-moon-sorceress.svg')).text();
 const scenarios=[];
 for(const kind of ['blank','ink','spray'] as const){
  const vector=decodeSvgDefinition(source);let boundsRead=0,geometryMs=0;
  const definition={...vector,regions:vector.regions.map(region=>({...region,
   get bounds(){boundsRead++;return region.bounds;},
   geometry:()=>{const start=performance.now(),value=region.geometry!();geometryMs+=performance.now()-start;return value;}}))};
  const width=vector.width,height=vector.height;
  const art=kind==='blank'?Artwork.create(width,height,'#ffffff'):new Artwork(width,height,[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff},
   {id:'moon',kind:'fantasy-moon-sorceress',x:Math.floor(width/2),y:Math.floor(height/2),color:0x242428}],()=>definition);
  const operations={intersection:{calls:0,ms:0},difference:{calls:0,ms:0},union:{calls:0,ms:0}};
  const originals={...polygons};
  for(const name of ['intersection','difference','union'] as const)polygons[name]=(...args:[MultiPolygon,...MultiPolygon[]])=>{
   const start=performance.now();try{return originals[name](...args);}finally{operations[name].calls++;operations[name].ms+=performance.now()-start;}};
  const originalRandom=Math.random;let seed=12345;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const samples:number[]=[],options:BrushOptions={kind:kind==='spray'?'spray':'ink',size:kind==='spray'?18:6,shape:'round'};
  let previous={x:width*.45,y:height*.3};
  try{
   for(let i=0;i<120;i++){
    const point={x:width*(.45+Math.sin(i*.09)*.08),y:height*(.3+i/120*.4)},start=performance.now();
    art.brush(previous,point,0x773399,false,options);samples.push(performance.now()-start);previous=point;
   }
   const sorted=[...samples].sort((a,b)=>a-b);
   scenarios.push({kind,regions:definition.regions.length,samples:120,totalMs:samples.reduce((a,b)=>a+b,0),p95Ms:sorted[113],maxMs:sorted.at(-1),boundsRead,geometryMs,operations});
  }finally{Math.random=originalRandom;Object.assign(polygons,originals);art.dispose();}
 }
 return scenarios;
}
