import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'vite';
let server,regionsNear,StrokeSmoothing,VectorPaint,geometry,polygons;
before(async()=>{
 server=await createServer({configFile:false,server:{middlewareMode:true,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 ({regionsNear}=await server.ssrLoadModule('/src/editor/regionSearch.ts'));
 ({StrokeSmoothing}=await server.ssrLoadModule('/src/editor/strokeSmoothing.ts'));
 ({VectorPaint}=await server.ssrLoadModule('/src/editor/VectorPaint.ts'));
 geometry=await server.ssrLoadModule('/src/editor/vectorPaintGeometry.ts');
 ({default:polygons}=await server.ssrLoadModule('/src/editor/polygonGeometry.ts'));
});
after(async()=>{await server?.close();});
const box=(l,t,r,b)=>[[[[l,t],[r,t],[r,b],[l,b],[l,t]]]];
const overlaps=(a,b)=>!(a[2]<b[0]||a[0]>b[2]||a[3]<b[1]||a[1]>b[3]);

test('region grid never omits a bounding-box candidate, including borders and off-origin shapes',()=>{
 const regions=Array.from({length:400},(_,i)=>({id:i+1,bounds:[i%20*12-100,Math.floor(i/20)*12-80,i%20*12-90,Math.floor(i/20)*12-70]}));
 regions.push({id:401,bounds:[-120,-100,160,180]});
 for(let i=0;i<600;i++){
  const x=-150+(i*37)%350,y=-120+(i*53)%350,b=[x,y,x+i%31,y+i%17];
  const expected=regions.filter(region=>overlaps(region.bounds,b)).map(region=>region.id);
  const actual=regionsNear(regions,b).filter(region=>overlaps(region.bounds,b)).map(region=>region.id);
  assert.deepEqual(actual,expected);
 }
 assert.ok(regionsNear(regions,[0,0,2,2]).length<regions.length/4);
 assert.deepEqual(regionsNear(regions,[500,500,510,510]),[]);
});

test('indexed brush clipping preserves full-scan coverage and region order across boundaries',()=>{
 const regions=Array.from({length:100},(_,i)=>{const l=i%10*10,t=Math.floor(i/10)*10;return {id:i+1,bounds:[l,t,l+10,t+10],geometry:()=>box(l,t,l+10,t+10)};});
 for(const shape of [geometry.brushBlob([8,8],[35,31],3),geometry.brushBlob([-5,20],[105,20],4),geometry.brushBlob([50,50],[50,50],18,true)]){
  const paint=new VectorPaint(),expected=[];
  for(const region of regions){const coverage=polygons.intersection(shape,region.geometry());if(coverage.length)expected.push({id:region.id,geometry:coverage});}
  const result=paint.apply({regions},shape,0x773399);
  assert.deepEqual(result.coverage,expected.flatMap(region=>region.geometry));
  assert.deepEqual(paint.serialize().regions.map(region=>({id:region.id,geometry:region.blobs[0].geometry})),expected);
  paint.dispose();
 }
});

test('rectangular fast path clips page-edge strokes but reuses fully contained vector coverage',()=>{
 const paint=new VectorPaint(),definition={regions:[{id:1,bounds:[0,0,100,100],rectangular:true,geometry:()=>box(0,0,100,100)}]};
 const inside=geometry.brushBlob([10,10],[20,20],2),outside=geometry.brushBlob([-5,10],[5,10],3);
 assert.deepEqual(paint.apply(definition,inside,1).coverage,inside);
 assert.deepEqual(paint.apply(definition,outside,2).coverage,polygons.intersection(outside,box(0,0,100,100)));paint.dispose();
});

test('smoothing stays within two screen pixels and settles to the pointer without release',()=>{
 for(const zoom of [.1,1,8,10000]){
  const trail=2/zoom,smooth=new StrokeSmoothing({x:0,y:0});let tip;
  for(let i=1;i<=120;i++){
   tip={x:i*.7/zoom,y:Math.sin(i*.2)*3/zoom};
   const points=smooth.append(tip,trail);
   assert.ok(points.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
   assert.ok(smooth.remaining*zoom<=2.00001);
  }
  let last;
  for(let i=0;i<30&&smooth.remaining;i++)last=smooth.settle(trail).at(-1)??last;
  assert.equal(smooth.remaining,0);assert.deepEqual(last,tip);assert.deepEqual(smooth.finish(),tip);
  assert.deepEqual(smooth.settle(trail),[]);
 }
});


test('continuous brush input compacts periodically instead of postponing every merge until idle',async()=>{
 const OriginalWorker=globalThis.Worker,instances=[],jobs=[];
 globalThis.Worker=class {
  constructor(){instances.push(this);}
  postMessage(job){jobs.push(job);queueMicrotask(()=>this.onmessage({data:{id:job.id,regions:job.regions.map(geometry.compactRegion)}}));}
  terminate(){}
 };
 const paint=new VectorPaint(),definition={regions:[{id:1,bounds:[0,0,100,100],rectangular:true}]};
 try{
  for(let i=0;i<16;i++){
   paint.apply(definition,geometry.brushBlob([10,10],[20,20],2),0x773399);
   await new Promise(resolve=>setTimeout(resolve,20));
   if(i===9)assert.ok(jobs.length>0,'The worker should already be merging during a continuous gesture');
  }
  await paint.settled();assert.equal(paint.serialize().regions[0].blobs.length,1);
 }finally{paint.dispose();instances[0]?.onerror();if(OriginalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=OriginalWorker;}
});
