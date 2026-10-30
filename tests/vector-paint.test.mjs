import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createServer } from 'vite';
let server,geometry,VectorPaint,valid,svgGeometry,styles;
before(async()=>{
 server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 styles=await server.ssrLoadModule('/src/editor/vectorPaintStyles.ts');
 geometry=await server.ssrLoadModule('/src/editor/vectorPaintGeometry.ts');
 ({svgPathGeometry:svgGeometry}=await server.ssrLoadModule('/src/editor/svgPathGeometry.ts'));
 ({VectorPaint}=await server.ssrLoadModule('/src/editor/VectorPaint.ts'));
 ({isSavedPicture:valid}=await server.ssrLoadModule('/src/editor/pictureValidation.ts'));
});
after(async()=>{await server?.close();});
const count=g=>g.flat(2).length;
const stroke=(state,definition,a,b,radius,color,square)=>state.apply(definition,geometry.brushBlob(a,b,radius,square),color).changed;

test('save checkpoints reuse unchanged regions and keep newer edits and undo independent', async () => {
 const shape=geometry.brushBlob([5,5],[15,5],2);
 const state=new VectorPaint({version:1,regions:[{id:1,base:0xffffff,blobs:[{color:1,geometry:shape},{color:1,geometry:shape}]},{id:2,base:2,blobs:[]}]});
 const before=state.snapshotRegion(1),first=state.checkpoint(),prepared=await first.compact();
 assert.equal(prepared.regions[0].blobs.length,1);
 assert.strictEqual((await state.checkpoint().compact()).regions[0],prepared.regions[0]);
 state.fill(2,3);
 const changed=await state.checkpoint().compact();
 assert.strictEqual(changed.regions[0],prepared.regions[0]);
 assert.equal(changed.regions[1].base,3);assert.equal(prepared.regions[1].base,2);
 state.fill(1,4);const pending=state.checkpoint();
 state.restoreRegion(1,before);
 const [old,restored]=await Promise.all([pending.compact(),state.checkpoint().compact()]);
 assert.equal(old.regions[0].base,4);assert.equal(restored.regions[0].base,0xffffff);
 assert.equal(first.data.regions[0].blobs.length,2,'Prepared results must not rewrite a captured checkpoint');
 state.dispose();
 assert.deepEqual(await pending.compact(),old,'Detached saves must remain usable after disposal');
});
test('a thousand repeated strokes compact to one stable color blob',()=>{
 const shape=geometry.brushBlob([5,5],[15,15],2);
 const result=geometry.compactRegion({id:1,base:0xffffff,blobs:Array.from({length:1000},()=>({color:0x773399,geometry:shape}))});
 assert.equal(result.blobs.length,1);
 assert.equal(count(result.blobs[0].geometry),count(shape));
 assert.ok(geometry.containsGeometry(result.blobs[0].geometry,[10,10]));
});
test('different colors remove covered paint instead of retaining hidden layers',()=>{
 const a=geometry.brushBlob([5,5],[15,5],3),b=geometry.brushBlob([10,0],[10,10],2);
 const result=geometry.compactRegion({id:1,base:0xffffff,blobs:[{color:1,geometry:a},{color:2,geometry:b}]});
 assert.equal(result.blobs.length,2);
 assert.equal(geometry.containsGeometry(result.blobs.find(b=>b.color===1).geometry,[10,5]),false);
 assert.equal(geometry.containsGeometry(result.blobs.find(b=>b.color===2).geometry,[10,5]),true);
 const erased=geometry.compactRegion({...result,blobs:[...result.blobs,{color:0xffffff,geometry:geometry.brushBlob([10,5],[10,5],50)}]});
 assert.equal(erased.blobs.length,0);
});
test('input nodes use the fine grid and saved snapshots survive later merging',async()=>{
 const shape=geometry.brushBlob([1.123,2.345],[8.456,9.789],2);
 for(const point of shape.flat(2))for(const n of point)assert.equal(n*64,Math.round(n*64));
 const state=new VectorPaint();state.fill(1,0xff00ff);
 const definition={regions:[{id:1,bounds:[0,0,30,30]}]};
 stroke(state,definition,[5,5],[10,10],2,0x00ffff,false);
 const snapshot=state.serialize();
 stroke(state,definition,[5,5],[10,10],2,0x00ffff,false);
 await state.settled();
 assert.equal(snapshot.regions[0].blobs.length,1);
 assert.equal(state.serialize().regions[0].blobs.length,1);
 await state.fill(1,0x112233,[6,6]);await state.settled();
 assert.equal(state.serialize().regions[0].blobs[0].color,0x112233);
 assert.equal(snapshot.regions[0].blobs[0].color,0x00ffff);
});
test('saved vector paint validates and cannot be mixed with raster runs',()=>{
 const shape=geometry.brushBlob([1,1],[2,2],1);
 const picture={version:6,id:'v',title:'v',format:'landscape',size:{width:100,height:70},background:'#ffffff',leafColor:0,updatedAt:1,
 document:{version:6,width:100,height:70,surfaces:[{id:'page',kind:'canvas',x:0,y:0,color:0xffffff},
 {id:'moon',kind:'fantasy-moon-sorceress',x:50,y:35,color:0,vectorPaint:{version:1,regions:[{id:1,base:0xffffff,blobs:[{color:2,geometry:shape}]}]}}]}};
 assert.equal(valid(picture),true);
 picture.version=3;picture.document.version=3;assert.equal(valid(picture),false);
 picture.version=6;picture.document.version=6;
 picture.document.surfaces[1].paint=[[0,1,0]];assert.equal(valid(picture),false);
 delete picture.document.surfaces[1].paint;
 picture.document.surfaces[1].vectorPaint.regions[0].blobs[0].geometry[0][0][0][0]=NaN;
 assert.equal(valid(picture),false);
});


test('SVG region boolean geometry preserves holes, separate components, arcs and transformed curves',()=>{
 const identity=[1,0,0,1,0,0];
 const donut=svgGeometry('M0 0H100V100H0Z M20 20H80V80H20Z',identity);
 assert.ok(geometry.containsGeometry(donut,[10,10]));
 assert.equal(geometry.containsGeometry(donut,[50,50]),false);
 const separate=svgGeometry('M0 0H10V10H0Z M20 0H30V10H20Z',identity);
 assert.equal(separate.length,2);
 const circle=svgGeometry('M0 10A10 10 0 1 0 20 10A10 10 0 1 0 0 10Z',[2,0,0,2,50,20]);
 assert.ok(geometry.containsGeometry(circle,[70,40]));
 assert.equal(geometry.containsGeometry(circle,[40,40]),false);
 assert.ok(circle.flat(2).length>32);
});

test('pattern styles merge by color and pattern rather than color alone',()=>{
 const shape=geometry.brushBlob([5,5],[15,5],2);
 const result=geometry.compactRegion({id:1,base:0xffffff,blobs:[
  {color:0x773399,pattern:{pattern:'dots',spacing:8},geometry:shape},
  {color:0x773399,pattern:{pattern:'stripes',spacing:8},geometry:shape},
 ]});
 assert.equal(result.blobs.length,1);
 assert.equal(result.blobs[0].pattern.pattern,'stripes');
});

test('near-coincident curved strokes remain valid through repeated unions, fills and differences', async()=>{
 const state=new VectorPaint();
 const definition={regions:[{id:1,bounds:[0,0,200,200],geometry:()=>svgGeometry('M0 100A100 100 0 1 0 200 100A100 100 0 1 0 0 100Z',[1,0,0,1,0,0])}]};
 for(let i=0;i<160;i++){
  const x=116.01259777301146+Math.sin(i*.21)*15,y=97.17914246109615+Math.cos(i*.31)*12;
  stroke(state,definition,[x,y],[121.24579098191879+Math.sin(i*.21)*15,93.43833454370352+Math.cos(i*.31)*12],3,i%2?0x773399:0x42aadd,false);
 }
 assert.equal(await state.fill(1,0xff8811,[116,97],undefined,definition.regions[0].geometry),true);
 await state.settled();
 assert.equal(await state.fill(1,0x112233,[116,97],undefined,definition.regions[0].geometry),true);
 await state.settled();
 const result=state.serialize().regions[0];
 assert.ok(result.blobs.some(b=>b.color===0x112233&&geometry.containsGeometry(b.geometry,[116,97])));
 for(const blob of result.blobs)for(const point of blob.geometry.flat(2))for(const value of point){
  assert.ok(Number.isFinite(value));assert.equal(value*4096,Math.round(value*4096));
 }
});

test('fixed-precision booleans preserve nested islands and holes independent of input winding',async()=>{
 const {default:polygons}=await server.ssrLoadModule('/src/editor/polygonGeometry.ts');
 const square=(a,b)=>[[a,a],[a,b],[b,b],[b,a],[a,a]];
 const result=polygons.union([[square(0,100),square(20,80)],[square(40,60)]]);
 assert.equal(result.length,2);
 assert.equal(geometry.containsGeometry(result,[10,10]),true);
 assert.equal(geometry.containsGeometry(result,[30,30]),false);
 assert.equal(geometry.containsGeometry(result,[50,50]),true);
 const cut=polygons.difference(result,[[square(45,55)]]);
 assert.equal(geometry.containsGeometry(cut,[50,50]),false);
 assert.equal(geometry.containsGeometry(cut,[42,42]),true);
});


test('restoring saved paint does not start a worker or queue maintenance',async()=>{
 const PreviousWorker=globalThis.Worker;let created=0;
 globalThis.Worker=class {constructor(){created++;}};
 try{
  const shape=geometry.brushBlob([3,3],[8,8],1);
  const data={version:1,regions:[{id:1,base:0xffffff,blobs:[{color:1,geometry:shape}]}]};
  const restored=Array.from({length:12},()=>new VectorPaint(data));
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(created,0);assert.ok(restored.every(p=>JSON.stringify(p.serialize())===JSON.stringify(data)));
 }finally{if(PreviousWorker===undefined)delete globalThis.Worker;else globalThis.Worker=PreviousWorker;}
});


test('base fills skip worker maintenance and brush jobs contain only dirty regions', async () => {
 const PreviousWorker=globalThis.Worker; const instances=[], jobs=[];
 globalThis.Worker=class {
  constructor(){instances.push(this); }
  postMessage(job){jobs.push(job);queueMicrotask(()=>this.onmessage({data:{id:job.id,regions:job.regions}}));}
  terminate(){}
 };
 try {
  const state=new VectorPaint();
  for(let id=1;id<=100;id++)state.fill(id,0x112233);
  await state.settled();
  assert.equal(instances.length,0,'Whole-region fills need no boolean job');
  const definition={regions:[{id:37,bounds:[0,0,40,40]}]};
  stroke(state,definition,[10,10],[20,20],2,0xff0000,false);
  await state.settled();
  assert.deepEqual(jobs.map(job=>job.regions.map(region=>region.id)),[[37]]);
  stroke(state,definition,[20,20],[25,25],2,0x00ff00,false);
  state.dispose();
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(jobs.length,1,'Disposed paint must not submit delayed maintenance');
 } finally {
  instances[0]?.onerror();
  if(PreviousWorker===undefined)delete globalThis.Worker;else globalThis.Worker=PreviousWorker;
 }
});


test('incremental compaction reuses disjoint old colors and matches full compaction for new coverage',()=>{
 const box=(l,t,r,b)=>[[[[l,t],[r,t],[r,b],[l,b],[l,t]]]];
 const initial=geometry.compactRegion({id:1,base:0xffffff,blobs:[
  {color:1,geometry:box(0,0,20,20)},{color:2,geometry:box(5,5,25,25)},{color:3,geometry:box(10,10,30,30)}]});
 const unchanged=geometry.compactRegionPrefix(initial,initial.blobs.length);
 assert.ok(unchanged.blobs.every((blob,i)=>blob===initial.blobs[i]));
 for(const base of [0xffffff,2]){
  const input={...initial,base,blobs:[...initial.blobs,{color:1,geometry:box(12,0,18,32)},{color:base,geometry:box(15,15,28,28)}]};
  const full=geometry.compactRegion(input),fast=geometry.compactRegionPrefix(input,initial.blobs.length);
  const color=(r,x,y)=>[...r.blobs].reverse().find(blob=>geometry.containsGeometry(blob.geometry,[x,y]))?.color??r.base;
  for(let y=-1;y<33;y++)for(let x=-1;x<33;x++)assert.equal(color(fast,x+.37,y+.23),color(full,x+.37,y+.23));
 }
});


test('fixed diagonal nibs preserve their angle while sweeping in either direction',()=>{
 for(const rising of [true,false]){
  const tap=styles.diagonalTipStroke([20,20],[20,20],8,rising);
  assert.ok(geometry.containsGeometry(tap,rising?[24,16]:[24,24]));
  assert.equal(geometry.containsGeometry(tap,rising?[24,24]:[24,16]),false);
  const swept=styles.diagonalTipStroke([20,20],[70,20],8,rising);
  for(let x=20;x<=70;x+=5)assert.ok(geometry.containsGeometry(swept,[x,20]));
  for(const ring of swept.flat())assert.deepEqual(ring[0],ring.at(-1));
 }
});

test('spray cannot accidentally enter vector topology',()=>{
 assert.throws(()=>styles.styledStroke([20,20],[20,20],10,{size:20,tip:'scatter'}), /raster overlay/);
});
