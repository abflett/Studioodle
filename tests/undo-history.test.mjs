import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
let server,Artwork,ArtworkChange,UndoHistory,geometry;
const OriginalPath=globalThis.Path2D;
before(async()=>{
 globalThis.Path2D=class {rect(){}};
 server=await createServer({configFile:false,server:{middlewareMode:true,ws:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 ({Artwork}=await server.ssrLoadModule('/src/editor/Artwork.ts'));
 ({ArtworkChange}=await server.ssrLoadModule('/src/editor/artworkChange.ts'));
 ({UndoHistory}=await server.ssrLoadModule('/src/editor/UndoHistory.ts'));
 geometry=await server.ssrLoadModule('/src/editor/vectorPaintGeometry.ts');
});
after(async()=>{await server?.close();if(OriginalPath===undefined)delete globalThis.Path2D;else globalThis.Path2D=OriginalPath;});
const rectangle=(left,top,right,bottom)=>[[[[left,top],[right,top],[right,bottom],[left,bottom],[left,top]]]];
function definition(){return {width:20,height:20,bounds:{left:0,top:0,right:20,bottom:20},silhouette:{},ink:[],typedArrayBytes:0,
 contains:(x,y)=>x>=0&&y>=0&&x<20&&y<20,regionAt:x=>x<10?1:2,regions:[
 {id:1,bounds:[0,0,10,20],geometry:()=>rectangle(0,0,10,20)},
 {id:2,bounds:[10,0,20,20],geometry:()=>rectangle(10,0,20,20)}]};}
function artwork(){return new Artwork(100,100,[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff},
 {id:'lion',kind:'animal-lion',x:50,y:50,color:0,vectorPaint:{version:1,regions:[{id:1,base:0xff88bb,blobs:[]},{id:2,base:0x00aabb,blobs:[]}]}}],definition);}
function checkpoint(geometry,dirty=false){const change=new ArtworkChange();change.regions.set('one',{surfaceId:'lion',id:1,paint:{region:{id:1,base:0xffffff,blobs:[{color:1,geometry}]},needsCompaction:dirty}});return change;}

test('fill history retains only the changed region and restores it without touching its neighbor',()=>{
 const art=artwork(),before=art.serialize();art.beginChange();assert.equal(art.fill({x:45,y:50},0x8833aa),true);
 const change=art.endChange();assert.equal(change.regions.size,1);assert.equal(change.surfaces.size,0);
 assert.equal([...change.regions.values()][0].id,1);art.undoChange(change);assert.deepEqual(art.serialize(),before);art.dispose();
});

test('a brush gesture captures each affected region once and history compacts pending paint into blobs',async()=>{
 const art=artwork();
 art.beginChange();for(let i=0;i<80;i++)art.brush({x:44,y:50},{x:46,y:50},0x8833aa,false,{size:2,tip:'round'});art.endChange();
 art.beginChange();for(let i=0;i<20;i++)art.brush({x:45,y:50},{x:47,y:50},0x00ff00,false,{size:2,tip:'round'});
 const before=art.endChange();assert.equal(before.regions.size,1);
 const snapshot=[...before.regions.values()][0].paint;assert.equal(snapshot.region.blobs.length,80);
 const history=new UndoHistory();history.push(before);const pendingBytes=history.retainedBytes;await history.settled();
 assert.equal(snapshot.region.blobs.length,1);assert.equal(snapshot.needsCompaction,false);assert.ok(history.retainedBytes<pendingBytes);
 art.undoChange(history.pop());const region=art.serialize().surfaces[1].vectorPaint.regions[0];
 assert.equal(region.blobs.length,1);assert.equal(region.blobs[0].color,0x8833aa);
 assert.equal(geometry.containsGeometry(region.blobs[0].geometry,[5,10]),true);art.dispose();history.clear();
});

test('paint snapshots share immutable geometry; later compaction cannot mutate retained history',async()=>{
 const art=artwork();art.brush({x:44,y:50},{x:46,y:50},0x8833aa);await art.compactPaint();
 art.beginChange();art.brush({x:44,y:50},{x:46,y:50},0x00ff00);const change=art.endChange();
 const before=JSON.stringify([...change.regions.values()][0].paint);await art.compactPaint();
 assert.equal(JSON.stringify([...change.regions.values()][0].paint),before);
 art.undoChange(change);await art.compactPaint();assert.equal(art.serialize().surfaces[1].vectorPaint.regions[0].blobs[0].color,0x8833aa);art.dispose();
});

test('sticker operations retain properties rather than paint, and deletion restores paint and order',()=>{
 const art=artwork();
 for(const action of [()=>art.move('lion',{x:60,y:55}),()=>art.flip('lion','horizontal'),()=>art.transform('lion',.2,30)]){
  const before=art.serialize();art.beginChange();action();const change=art.endChange();
  assert.equal(change.regions.size,0);assert.equal(change.surfaces.get('lion').paint,undefined);
  art.undoChange(change);assert.deepEqual(art.serialize(),before);
 }
 const before=art.serialize();art.beginChange();art.remove('lion');const removed=art.endChange();
 assert.equal(art.stickerCount,0);assert.equal(removed.surfaces.get('lion').paint.length,2);art.undoChange(removed);assert.deepEqual(art.serialize(),before);
 art.beginChange();const copy=art.duplicate('lion');const duplicated=art.endChange();assert.ok(copy);art.undoChange(duplicated);assert.deepEqual(art.serialize(),before);
 art.beginChange();const added=art.add('animal-lion',0,{x:70,y:70});const addition=art.endChange();
 art.undoChange(addition);assert.equal(art.position(added),undefined);assert.deepEqual(art.serialize(),before);
 art.beginChange();art.move('lion',{x:50,y:50});assert.equal(art.endChange().empty,true);
 art.beginChange();art.remove('paper');assert.equal(art.endChange().empty,true);
 art.beginChange();art.move('lion',{x:65,y:65});art.remove('lion');art.undoChange(art.endChange());assert.deepEqual(art.serialize(),before);art.dispose();
});

test('history keeps more than 50 actions and accounts shared geometry once',()=>{
 const shared=rectangle(0,0,10,10),history=new UndoHistory();
 const first=checkpoint(shared);history.push(first);const bytes=history.retainedBytes;
 for(let i=0;i<199;i++)history.push(checkpoint(shared));
 assert.equal(history.length,200);assert.equal(history.retainedBytes,bytes+199*first.resources().overhead);
 for(let i=0;i<200;i++)assert.ok(history.pop());assert.equal(history.retainedBytes,0);history.clear();
});

test('memory eviction drops oldest whole actions and preserves focus sequence boundaries',()=>{
 const a=checkpoint(rectangle(0,0,10,10)),b=checkpoint(rectangle(20,0,30,10));
 const resource=a.resources(),budget=resource.overhead+[...resource.geometry.values()].reduce((a,b)=>a+b,0)+1;
 const history=new UndoHistory(budget);history.push(a);const focus=history.mark();history.push(b);
 assert.equal(history.length,1);assert.ok(history.retainedBytes<=budget);assert.equal(history.pop(focus),b);assert.equal(history.pop(),undefined);
 history.push(a);assert.equal(history.pop(history.mark()),undefined);assert.equal(history.pop(),a);history.clear();
});


test('region undo retains a long sequence of small fills without an action-count cap',()=>{
 const art=artwork(),before=art.serialize(),history=new UndoHistory();
 for(let i=0;i<180;i++){art.beginChange();art.fill({x:45,y:50},i);history.push(art.endChange());}
 assert.equal(history.length,180);assert.ok(history.retainedBytes<200_000);
 for(let i=0;i<180;i++)art.undoChange(history.pop());
 assert.deepEqual(art.serialize(),before);art.dispose();history.clear();
});

test('canceling paint restored from pending saved coverage preserves the compacted painting',async()=>{
 const art=artwork(),data=art.serialize();art.dispose();
 const blob={color:0x8833aa,geometry:rectangle(1,1,6,6)};
 data.surfaces[1].vectorPaint.regions[0].blobs=Array.from({length:80},()=>blob);
 const loaded=Artwork.restore(data,definition);
 loaded.beginChange();loaded.brush({x:44,y:45},{x:46,y:45},0xff8800,false,{size:2,tip:'round'});
 const change=loaded.endChange();assert.equal([...change.regions.values()][0].paint.needsCompaction,true);
 loaded.undoChange(change);await loaded.compactPaint();
 const expected=geometry.compactRegion(data.surfaces[1].vectorPaint.regions[0]);
 assert.deepEqual(loaded.serialize().surfaces[1].vectorPaint.regions[0],expected);loaded.dispose();
});

test('a late historical worker result cannot overwrite paint restored by undo',async()=>{
 const OriginalWorker=globalThis.Worker,instances=[],jobs=[];
 globalThis.Worker=class {constructor(){instances.push(this);}postMessage(job){jobs.push(job);}terminate(){}};
 const art=artwork(),history=new UndoHistory();
 try{
  const change=checkpoint(rectangle(1,1,6,6),true);
  const region=[...change.regions.values()][0].paint.region;
  region.blobs=Array.from({length:80},()=>region.blobs[0]);
  history.push(change);
  for(let i=0;i<30&&!jobs.length;i++)await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(jobs.length,1);
  art.undoChange(history.pop());art.brush({x:44,y:45},{x:46,y:45},0xff8800,false,{size:2,tip:'round'});
  const current=art.serialize();
  instances[0].onmessage({data:{id:jobs[0].id,regions:jobs[0].regions.map(geometry.compactRegion)}});
  await history.settled();assert.deepEqual(art.serialize(),current);assert.equal(history.retainedBytes,0);
 }finally{
  art.dispose();history.clear();instances[0]?.onerror();
  if(OriginalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=OriginalWorker;
 }
});
