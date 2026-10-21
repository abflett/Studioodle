import { stroke, waitForEdits } from './helpers';
import { EditorSession } from '../../src/editor/EditorSession';
import { prepareStickers } from '../../src/editor/vectorStickers';
import { Artwork } from '../../src/editor/Artwork';
import { decodeSvgDefinition } from '../../src/editor/svgDefinition';
import { VectorPaint } from '../../src/editor/VectorPaint';
import { brushBlob } from '../../src/editor/vectorPaintGeometry';
import type { ArtworkDocument } from '../../src/editor/document';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
/** Real worker, Path2D and Canvas regression. Paint remains vector at every display scale. */
export async function checkVectorPaint(){
 const svg=await(await fetch('/src/assets/vector/fantasy-moon-sorceress.svg')).text();
 const vector=decodeSvgDefinition(svg);
 const doc:ArtworkDocument={version:5,width:400,height:500,surfaces:[{id:'page',kind:'canvas',x:0,y:0,color:0xffffff},
 {id:'moon',kind:'fantasy-moon-sorceress',x:170,y:240,color:0x242428}]};
 const art=Artwork.restore(doc,()=>vector);
 assert((await art.fill({x:170,y:174},0x773399)),'Vector bucket fills');
 assert(art.brush({x:168,y:175},{x:172,y:175},0x42aadd,false,{size:2,kind:'ink',shape:'round'}),'Vector brush paints');
 let saved=art.serialize();
 assert(!('paint' in saved.surfaces[1]!)&&!!saved.surfaces[1]!.vectorPaint,'No raster paint allocated/serialized');
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=480;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.setTransform(16,0,0,16,-145*16,-162*16);
 art.render(ctx);const before=ctx.getImageData(0,0,960,480).data;
 await art.compactPaint();
 art.render(ctx);const after=ctx.getImageData(0,0,960,480).data;
 // Merging identical coverage cannot change any pixel far from a brush boundary.
 let changes=0;for(let y=0;y<480;y++)for(let x=0;x<960;x++){
  if(Math.abs(y-208)<22&&x>345&&x<455)continue;
  const i=(y*960+x)*4;if([0,1,2].some(c=>Math.abs(before[i+c]!-after[i+c]!)>3))changes++;
 }
 assert(changes===0,`Worker changed ${changes} pixels away from brush edge`);
 saved=art.serialize();const restored=Artwork.restore(saved,()=>vector);restored.render(ctx);
 const roundtrip=ctx.getImageData(0,0,960,480).data;
 const diffs=[...roundtrip.keys()].filter(i=>Math.abs(roundtrip[i]!-after[i]!)>2);
 assert(diffs.length===0,`Save/restore differs at ${diffs.length} channels; examples ${JSON.stringify(diffs.slice(0,12).map(i=>[i,roundtrip[i],after[i]]))}; state equal ${JSON.stringify(saved)===JSON.stringify(restored.serialize())}`);
 await prepareStickers(['fantasy-moon-sorceress']);
 const session=new EditorSession({id:'vector-undo',title:'Vector Trial',format:'portrait',size:{width:400,height:500},background:'#ffffff',leafColor:0x773399,document:saved},{save:()=>{},changed:()=>{}});
 session.execute({type:'set-tool',tool:'brush'});session.execute({type:'set-color',color:0xff8800});
 const undoBefore=JSON.stringify(session.artwork.serialize());
 session.begin({x:170,y:178},1,0);session.move({x:173,y:178},1,true,1);session.release({x:173,y:178},1,1);
 await session.artwork.compactPaint();
 session.execute({type:'undo'});
 assert(JSON.stringify(session.artwork.serialize())===undoBefore,'Compaction must not change undo snapshots');
 const high=document.createElement('canvas');high.width=1920;high.height=960;
 const hc=high.getContext('2d')!;hc.setTransform(32,0,0,32,-145*32,-162*32);
 const highArt=Artwork.restore(saved,()=>vector);highArt.render(hc);
 assert(!('paint' in highArt.serialize().surfaces[1]!),'Higher output resolution must not create a raster paint layer');
 const fixture={...vector,regions:[{id:1,path:new Path2D('M0 0H50V50H0Z'),bounds:[0,0,50,50]}]};
 const state=new VectorPaint();
 for(let i=0;i<200;i++)stroke(state,fixture,[10,10],[20,20],3,0x773399,false);
 const pending=state.settled();
 state.fill(1,0xeeeeee);
 for(let i=0;i<200;i++)stroke(state,fixture,[15,10],[15,25],2,0x42aadd,false);
 await pending;await state.settled();
 const result=state.serialize();
 assert(result.regions[0]!.base===0xeeeeee,'Worker must not restore stale backing colors');
 assert(result.regions[0]!.blobs.length===2,'Worker must compact repeated strokes into two colors');
 const bytes=JSON.stringify(result).length;
 assert(bytes<20_000,`Repeated strokes retained excessive geometry: ${bytes}`);
 assert(art.brush({x:170,y:175},{x:170,y:175},0,true),'Vector eraser works');
 await art.compactPaint();
 // Advanced texture tools use vector coverage too.
 assert(restored.brush({x:170,y:175},{x:171,y:175},0xff8800,false,{size:3,kind:'pencil',shape:'round'}),'Textured brush works');
 assert(restored.serialize().surfaces[1]!.vectorPaint&&!('paint' in restored.serialize().surfaces[1]!),'Textured brushes remain vector');
 const page=Artwork.create(100,100,'#ffffff');
 const corners=[{x:20,y:20},{x:80,y:20},{x:80,y:80},{x:20,y:80},{x:20,y:20}];
 for(let i=1;i<corners.length;i++)assert(page.brush(corners[i-1]!,corners[i]!,0,false,{size:6,kind:'ink',shape:'round'}),'Page outline stroke');
 await page.compactPaint();assert((await page.fill({x:50,y:50},0x22aa66)),'Fill inside a closed page outline');
 const pc=document.createElement('canvas');pc.width=pc.height=100;const pctx=pc.getContext('2d',{willReadFrequently:true})!;page.render(pctx);
 const rgb=(x:number,y:number)=>{const p=pctx.getImageData(x,y,1,1).data;return(p[0]!<<16)|(p[1]!<<8)|p[2]!;};
 assert(rgb(50,50)===0x22aa66&&rgb(5,5)===0xffffff&&rgb(20,50)===0,'Page bucket must preserve its closed vector boundary');
 for(const kind of ['ink','pencil','brush','spray'] as const){
  const styled=Artwork.create(100,100,'#ffffff');
  assert(styled.brush({x:40,y:40},{x:60,y:60},0x773399,false,{size:12,kind,shape:'round'}),`${kind} must paint`);
  await styled.compactPaint();assert(styled.serialize().surfaces[0]!.vectorPaint!.regions.some(r=>r.blobs.length),`${kind} remains vector`);
 }
 for(const pattern of ['dots','stripes','checker'] as const){
  assert((await page.fill({x:50,y:50},0x2244aa,{pattern,spacing:8})),`${pattern} vector fill`);
  await page.compactPaint();page.render(pctx);
  assert(page.serialize().surfaces[0]!.vectorPaint!.regions.some(r=>r.blobs.some(b=>b.pattern?.pattern===pattern)),`${pattern} persists as a vector style`);
 }
 // Real curved regions, intersecting multicolor strokes and bucket clicks both
 // before and after idle compaction. The former floating sweep failed here.
 const stress=new VectorPaint();let maxStrokeMs=0;
 for(let i=0;i<180;i++){
  const a:[number,number]=[100+(i*13.17)%95,75+(i*7.73)%120];
  const b:[number,number]=[a[0]+Math.sin(i)*17,a[1]+Math.cos(i)*12];
  const start=performance.now();stroke(stress,vector,a,b,5,0x773399+(i%3)*0x112200,false);
  maxStrokeMs=Math.max(maxStrokeMs,performance.now()-start);
  if(i%4===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 const painted=stress.serialize().regions.filter(r=>r.blobs.length).sort((a,b)=>b.blobs.flatMap(b=>b.geometry.flat(2)).length-a.blobs.flatMap(b=>b.geometry.flat(2)).length)[0]!;
 const target=vector.regions.find(r=>r.id===painted.id)!;
 // Select a point inside actual brush coverage (a triangle centroid avoids edges).
 const ring=painted.blobs.at(-1)!.geometry[0]![0]!;
 const point:[number,number]=[(ring[0]![0]+ring[1]![0]+ring[2]![0])/3,(ring[0]![1]+ring[1]![1]+ring[2]![1])/3];
 const filling=stress.fill(painted.id,0xff1188,point,undefined,target.geometry);
 assert(filling instanceof Promise,'Bucket topology must run asynchronously');
 assert(await filling,'Bucket must recolor intersecting brush geometry');
 await stress.settled();
 assert(await stress.fill(painted.id,0x11aaff,point,undefined,target.geometry),'Bucket must work again after compaction');
 await stress.settled();
 assert(maxStrokeMs<250,`A brush segment blocked for ${maxStrokeMs.toFixed(1)}ms`);
 // A dense pending region gives enough work to verify event-loop progress even
 // on fast machines; a small region can finish before a browser timer fires.
 const dense=new VectorPaint({version:1,regions:[{id:1,base:0xffffff,blobs:Array.from({length:600},(_,i)=>({color:i%2?0x773399:0x42aadd,geometry:brushBlob([i%30*3,Math.floor(i/30)*3],[i%30*3+8,Math.floor(i/30)*3+6],3)}))}]});
 let heartbeats=0;const heartbeat=setInterval(()=>heartbeats++,0);
 try {assert(await dense.fill(1,0xff8800,[50,30]),'Dense pending brush region must fill');}
 finally {clearInterval(heartbeat);}
 assert(heartbeats>0,'Bucket geometry must leave the UI event loop responsive');
 await dense.settled();
 // Commands arriving during a worker fill preserve order and one undo per fill.
 const pageSession=new EditorSession({id:'fill-order',title:'Fill order',format:'portrait',size:{width:100,height:100},background:'#ffffff',leafColor:0,document:page.serialize()},{save:()=>{},changed:()=>{}});
 const orderedBefore=JSON.stringify(pageSession.artwork.serialize());
 pageSession.execute({type:'set-tool',tool:'bucket'});pageSession.execute({type:'set-color',color:0x551188});
 pageSession.execute({type:'fill-at',point:{x:50,y:50}});
 pageSession.execute({type:'undo'});await waitForEdits(pageSession);
 assert(JSON.stringify(pageSession.artwork.serialize())===orderedBefore,'Queued undo must restore the state before async fill');
 return {vectorRoundtrip:true,undo:true,higherResolutionRender:true,workerRace:true,eraser:true,vectorTextures:true,pageClosedFill:true,vectorPatterns:true,fillAfterComplexBrush:true,queuedFillUndo:true,maxStrokeMs,fillHeartbeats:heartbeats,repeatedStrokes:400,compactedBytes:bytes,diagnosticPng:canvas.toDataURL('image/png')};
}
