import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createServer } from 'vite';
let server,paint,styles,clipper,containsBrush,VectorPaint;
before(async()=>{
 server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 paint=await server.ssrLoadModule('/src/editor/vectorPaintGeometry.ts');styles=await server.ssrLoadModule('/src/editor/vectorPaintStyles.ts');
 ({default:clipper}=await server.ssrLoadModule('/src/editor/polygonGeometry.ts'));
 ({containsBrush}=await server.ssrLoadModule('/src/editor/regionContainment.ts'));({VectorPaint}=await server.ssrLoadModule('/src/editor/VectorPaint.ts'));
});
after(async()=>{await server?.close();});
const rectangle=(a,b,c,d)=>styles.rectangleGeometry(a,b,c,d);
const at=(r,p)=>[...r.blobs].reverse().find(b=>paint.containsGeometry(b.geometry,p))?.color??r.base;
test('local maintenance preserves remote components and removes overlapping old paint',()=>{
 const islands=Array.from({length:80},(_,i)=>rectangle(i*20,0,i*20+10,10)[0]);
 const r={id:1,base:0,blobs:[{color:1,geometry:islands},{color:2,geometry:rectangle(3,3,7,7)}]};
 const original=clipper.difference;let maximum=0;
 clipper.difference=(a,...b)=>{maximum=Math.max(maximum,a.length);return original(a,...b);};
 try{
  const result=paint.compactRegionPrefix(r,1);assert.equal(maximum,1,'Only nearby islands should enter subtraction');
  assert.equal(at(result,[5,5]),2);assert.equal(at(result,[1,1]),1);assert.equal(at(result,[1585,5]),1);assert.equal(at(result,[15,5]),0);
  assert.strictEqual(result.blobs.find(b=>b.color===1).geometry.find(p=>p===islands[79]),islands[79]);
 }finally{clipper.difference=original;}
});
test('fill moves exactly one connected component and merges its destination style',()=>{
 const r={id:1,base:0,blobs:[{color:1,geometry:[rectangle(0,0,10,10)[0],rectangle(30,0,40,10)[0]]},{color:2,geometry:rectangle(10,0,20,10)},{color:3,geometry:rectangle(60,0,70,10)}]};
 const filled=paint.filledRegion(r,2,[5,5],undefined,undefined,3);
 assert.equal(filled.blobs.find(b=>b.color===2).geometry.length,1,'Touching destination must become one component');
 assert.equal(at(filled,[5,5]),2);assert.equal(at(filled,[15,5]),2);assert.equal(at(filled,[35,5]),1);assert.equal(at(filled,[65,5]),3);
 const erased=paint.filledRegion(filled,0,[35,5],undefined,undefined,filled.blobs.length);assert.equal(at(erased,[35,5]),0);assert.equal(at(erased,[5,5]),2);
 assert.equal(paint.filledRegion(filled,2,[5,5],undefined,undefined,filled.blobs.length),undefined);
 assert.equal(at(r,[5,5]),1,'History source cannot be mutated');
});
test('conservative interior cells never swallow holes, notches or boundary crossings',()=>{
 const outer=[[0,0],[120,0],[120,120],[80,120],[80,80],[0,80],[0,0]],hole=[[30,30],[30,50],[50,50],[50,30],[30,30]];
 const boundary=[[outer,hole]],b=[0,0,120,120];
 assert(containsBrush(boundary,[8,8,16,16],b));
 for(const box of [[35,35,45,45],[70,70,90,90],[5,90,15,100],[-1,10,10,20],[25,25,55,55]])assert.equal(containsBrush(boundary,box,b),false);
 const state=new VectorPaint(),definition={regions:[{id:1,bounds:b,geometry:()=>boundary}]};
 const original=clipper.intersection;let calls=0;clipper.intersection=(...args)=>{calls++;return original(...args);};
 try{
  const shape=rectangle(8,8,16,16);assert.strictEqual(state.apply(definition,shape,1).coverage[0],shape[0]);assert.equal(calls,0);
  state.apply(definition,rectangle(25,25,55,55),2);assert.equal(calls,1);
  const result=paint.compactRegion(state.serialize().regions[0]);assert.equal(at(result,[40,40]),0xffffff);assert.equal(at(result,[27,27]),2);
 }finally{clipper.intersection=original;state.dispose();}
});
test('paint workload color signatures remain stable after localized geometry processing',async()=>{
 const {profilePaintModel}=await server.ssrLoadModule('/tests/fixtures/paint-workloads.ts');
 assert.deepEqual(profilePaintModel().results.map(r=>r.signature),[['1ee7c39d','d1c8c9d1','84d7d86a'],['f32c98af','7e37ec51','5a5fb12f']]);
});

test('prepared region clipping matches fresh clipping repeatedly and stays within its cache budget',async()=>{
 const {prepareBooleanGeometry,booleanGeometryCacheStats}=await server.ssrLoadModule('/src/editor/polygonGeometry.ts');
 const boundary=rectangle(0,0,100,100);boundary[0].push([[30,30],[30,60],[60,60],[60,30],[30,30]]);
 const before=JSON.stringify(boundary);prepareBooleanGeometry(boundary);
 for(let i=0;i<40;i++){
  const stroke=paint.brushBlob([i*2,20],[i*2+15,85],4);
  for(const name of ['intersection','difference','union']){
   const fresh=clipper[name](stroke,structuredClone(boundary)),cached=clipper[name](stroke,boundary);
   assert.deepEqual(cached,fresh);
  }
  assert.deepEqual(clipper.difference(boundary,stroke),clipper.difference(structuredClone(boundary),stroke));
 }
 assert.equal(JSON.stringify(boundary),before,'Reusable Clipper inputs must not mutate region geometry');
 for(let batch=0;batch<12;batch++){
  const ring=Array.from({length:2300},(_,i)=>[batch*300+100*Math.cos(i/2300*Math.PI*2),100*Math.sin(i/2300*Math.PI*2)]);ring.push([...ring[0]]);prepareBooleanGeometry([[ring]]);
 }
 const stats=booleanGeometryCacheStats();assert(stats.entries>0&&stats.entries<12,'Old region inputs must be evicted');assert(stats.estimatedBytes<=stats.budget);
 const oversized=Array.from({length:20000},(_,i)=>[Math.cos(i/20000*Math.PI*2),Math.sin(i/20000*Math.PI*2)]);oversized.push([...oversized[0]]);prepareBooleanGeometry([[oversized]]);
 assert.deepEqual(booleanGeometryCacheStats(),stats,'An oversized region must use uncached clipping');
});
