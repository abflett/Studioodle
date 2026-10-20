import { EditorSession } from '../../src/editor/EditorSession';
import { prepareStickers } from '../../src/editor/vectorStickers';
import { Artwork } from '../../src/editor/Artwork';
import { decodeSvgDefinition } from '../../src/editor/svgDefinition';
import { VectorPaint } from '../../src/editor/VectorPaint';
import type { ArtworkDocument } from '../../src/editor/document';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
/** Real worker, Path2D and Canvas regression. Paint remains vector at every display scale. */
export async function checkVectorPaint(){
 const svg=await(await fetch('/src/assets/vector/fantasy-moon-sorceress.svg')).text();
 const vector=decodeSvgDefinition(svg);
 const doc:ArtworkDocument={version:3,width:400,height:500,surfaces:[{id:'page',kind:'canvas',x:0,y:0,color:0xffffff,paint:[]},
 {id:'moon',kind:'fantasy-moon-sorceress',x:170,y:240,color:0x242428,paint:[]}]};
 const art=Artwork.restore(doc,()=>vector);
 assert(art.fill({x:170,y:174},0x773399),'Vector bucket fills');
 assert(art.brush({x:168,y:175},{x:172,y:175},0x42aadd,false,{size:2,kind:'ink',shape:'round'}),'Vector brush paints');
 let saved=art.serialize();
 assert(saved.surfaces[1]!.paint.length===0&&!!saved.surfaces[1]!.vectorPaint,'No raster paint allocated/serialized');
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
 assert(highArt.serialize().surfaces[1]!.paint.length===0,'Higher output resolution must not create a raster paint layer');
 const fixture={...vector,regions:[{id:1,path:new Path2D('M0 0H50V50H0Z'),bounds:[0,0,50,50]}]};
 const state=new VectorPaint();
 for(let i=0;i<200;i++)state.brush(fixture,[10,10],[20,20],3,0x773399,false);
 const pending=state.flush();
 state.fill(1,0xeeeeee);
 for(let i=0;i<200;i++)state.brush(fixture,[15,10],[15,25],2,0x42aadd,false);
 await pending;await state.settled();
 const result=state.serialize();
 assert(result.regions[0]!.base===0xeeeeee,'Worker must not restore stale backing colors');
 assert(result.regions[0]!.blobs.length===2,'Worker must compact repeated strokes into two colors');
 const bytes=JSON.stringify(result).length;
 assert(bytes<20_000,`Repeated strokes retained excessive geometry: ${bytes}`);
 assert(art.brush({x:170,y:175},{x:170,y:175},0,true),'Vector eraser works');
 await art.compactPaint();
 // Advanced texture tools retain a working raster fallback, without losing vector paint.
 assert(restored.brush({x:170,y:175},{x:171,y:175},0xff8800,false,{size:3,kind:'pencil',shape:'round'}),'Textured fallback works');
 assert(!restored.serialize().surfaces[1]!.vectorPaint&&restored.serialize().surfaces[1]!.paint.length,'Fallback converts paint coherently');
 return {vectorRoundtrip:true,undo:true,higherResolutionRender:true,workerRace:true,eraser:true,texturedFallback:true,repeatedStrokes:400,compactedBytes:bytes,diagnosticPng:canvas.toDataURL('image/png')};
}
