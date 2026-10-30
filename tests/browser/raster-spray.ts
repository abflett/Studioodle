import { Artwork } from '../../src/editor/Artwork';
import { RasterSpray, validRasterSpray, sprayResolution } from '../../src/editor/rasterSpray';
import { isSavedPicture } from '../../src/editor/pictureValidation';
import { pictureSvg } from '../../src/editor/pictureSvg';
import { createColoringPage } from '../../src/editor/coloringPage';
import { prepareStickers, vectorDefinition } from '../../src/editor/vectorStickers';
import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import { renderThumbnail } from '../../src/app/pictureThumbnails';
import type { SavedPicture } from '../../src/editor/savedPicture';
const assert = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
export async function checkRasterSpray(capture = false) {
 const random = Math.random; let seed = 12;
 Math.random = () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const art = Artwork.create(320,240,'#ffffff');
 const canvas=document.createElement('canvas'); canvas.width=320;canvas.height=240;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 const pixels=()=>{ art.render(ctx);return ctx.getImageData(0,0,320,240).data; };
 const snapshot=():SavedPicture=>({id:'spray-test',title:'Raster spray',version:6,updatedAt:Date.now(),format:'landscape',size:{width:320,height:240},background:'#ffffff',leafColor:0,document:art.serialize()});
 try {
  art.beginChange();
  for(let i=0;i<12;i++)art.brush({x:40,y:100},{x:280,y:100},0xdd3344,false,{tip:'scatter',size:64});
  const sprayChange=art.endChange(), saved=snapshot();
  assert(saved.document.surfaces[0]!.vectorPaint!.regions.length===0,'Spray must not generate vector paint');
  assert(saved.document.surfaces[0]!.rasterSpray!.tiles.length>1,'Spray should touch multiple sections');
  assert(sprayChange.spray.size===saved.document.surfaces[0]!.rasterSpray!.tiles.length,'Capture each touched section only once');
  assert(sprayChange.resources().overhead>256,'Raster snapshots count against undo memory');
  assert(isSavedPicture(saved)&&validRasterSpray(saved.document.surfaces[0]!.rasterSpray),'Valid bounded raster save');
  const before=pixels();
  const preview = capture ? canvas.toDataURL('image/png') : undefined;
  const invalid = structuredClone(saved.document.surfaces[0]!.rasterSpray!); invalid.tiles.push(invalid.tiles[0]!);
  assert(!validRasterSpray(invalid),'Reject duplicate sections');
  assert(!validRasterSpray({...invalid,width:9000}),'Reject excessive raster sizes');

  const checkpoint=art.checkpoint();
  art.beginChange(); art.brush({x:60,y:100},{x:260,y:100},0x2277ee,false,{tip:'scatter',size:64});const second=art.endChange();
  assert(JSON.stringify(checkpoint.document)===JSON.stringify(await checkpoint.compact()),'Detached checkpoint cannot follow new spray');
  art.undoChange(second);assert(pixels().every((n,i)=>n===before[i]),'Section undo must restore exactly');
  art.beginChange(); const filled=art.fill({x:100,y:100},0x55aa77);assert(typeof filled==='boolean'&&filled,'Spray must not require bucket worker topology');const fillChange=art.endChange();
  assert(art.serialize().surfaces[0]!.rasterSpray!.tiles[0]!.pixels.every((n,i)=>n===saved.document.surfaces[0]!.rasterSpray!.tiles[0]!.pixels[i]),'Fill must leave spray untouched');
  art.undoChange(fillChange);
  art.beginChange();art.brush({x:160,y:70},{x:160,y:130},0,false,{tip:'round',size:40});const ordinary=art.endChange();await art.compactPaint();
  const combined=pixels();
  art.beginChange();art.brush({x:160,y:70},{x:160,y:130},0,true);const erased=art.endChange();
  assert(pixels()[(100*320+160)*4]===255,'Eraser clears spray and ordinary paint');
  art.undoChange(erased);assert(pixels().every((n,i)=>n===combined[i]),'Undo restores both paint layers');art.undoChange(ordinary);
  const restored=Artwork.restore(structuredClone(saved.document));restored.render(ctx);assert(ctx.getImageData(0,0,320,240).data.every((n,i)=>n===before[i]),'Reload preserves pixels exactly');restored.dispose();
  const repo=createIndexedPictureRepository('studioodle-raster-spray-test');await repo.save(saved);assert(JSON.stringify((await repo.get(saved.id))!.document)===JSON.stringify(saved.document),'IndexedDB raster round trip');await repo.delete(saved.id);
  const thumbnail=await renderThumbnail(saved);assert(thumbnail.blob.size>1000,'Gallery PNG includes spray');
  const svg=await pictureSvg(saved);assert(svg.querySelectorAll('image').length===saved.document.surfaces[0]!.rasterSpray!.tiles.length,'SVG embeds bounded PNG sections');
  const {picturePdf}=await import('../../src/app/picturePdf');const pdf=await picturePdf(svg,'Spray');assert((await pdf.text()).includes('/Subtype /Image'),'PDF embeds spray image pixels');
  const image=new Image();const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  try {image.src=url;await image.decode();ctx.clearRect(0,0,320,240);ctx.drawImage(image,0,0,320,240);const output=ctx.getImageData(0,0,320,240).data;let error=0;for(let i=0;i<before.length;i++)error+=Math.abs(before[i]!-output[i]!);assert(error/before.length<1,'SVG pixels match canvas spray');}finally{URL.revokeObjectURL(url);}
  assert(!createColoringPage(saved,'Page').document.surfaces[0]!.rasterSpray,'Coloring pages discard spray');
  art.undoChange(sprayChange);assert(!art.serialize().surfaces[0]!.rasterSpray,'Undo new sections releases the layer');
  // Raster sections also follow sticker transforms, focus, duplication, deletion and rollback.
  await prepareStickers(['fantasy-moon-sorceress']);
  const definition=vectorDefinition('fantasy-moon-sorceress');
  const stickerArt=new Artwork(320,240,[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff},{id:'moon',kind:'fantasy-moon-sorceress',x:160,y:120,scale:.25,color:0}],()=>definition);
  stickerArt.setFocus('moon');stickerArt.beginChange();
  for(let i=0;i<5;i++)stickerArt.brush({x:100,y:120},{x:220,y:120},0x2244ee,false,{tip:'scatter',size:64});
  const focused=stickerArt.endChange();const stickerSaved=stickerArt.serialize();assert(stickerSaved.surfaces[1]!.rasterSpray,'Focused sticker owns spray');assert(!stickerSaved.surfaces[0]!.rasterSpray,'Focused spray never reaches paper');
  stickerArt.beginChange();const duplicate=stickerArt.duplicate('moon')!;const copied=stickerArt.endChange();assert(stickerArt.serialize().surfaces[2]!.rasterSpray,'Duplicate retains spray');stickerArt.undoChange(copied);
  stickerArt.beginChange();stickerArt.remove('moon');const deleted=stickerArt.endChange();stickerArt.undoChange(deleted);assert(JSON.stringify(stickerArt.serialize().surfaces[1]!.rasterSpray)===JSON.stringify(stickerSaved.surfaces[1]!.rasterSpray),'Delete undo restores spray');
  stickerArt.undoChange(focused);assert(!stickerArt.serialize().surfaces[1]!.rasterSpray,'Focused rollback restores sections');stickerArt.dispose();void duplicate;
  // Ownership masks prevent paint reaching hidden paper and follow transformations.
  const boxPath=new Path2D();boxPath.rect(0,0,100,100);
  const box={width:100,height:100,bounds:{left:0,top:0,right:100,bottom:100},regions:[{id:1,path:boxPath,bounds:[0,0,100,100]}],regionCount:1,silhouette:boxPath,ink:[],typedArrayBytes:0,contains:(x:number,y:number)=>x>=0&&x<100&&y>=0&&y<100,regionAt:()=>1,inRegion:()=>true};
  const ownership=new Artwork(320,240,[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff},{id:'box',kind:'fantasy-moon-sorceress',x:160,y:120,color:0}],()=>box);
  ownership.beginChange();for(let i=0;i<8;i++)ownership.brush({x:120,y:120},{x:200,y:120},0xee3355,false,{tip:'scatter',size:48});ownership.endChange();
  ownership.move('box',{x:260,y:120});ownership.render(ctx);
  const old=ctx.getImageData(130,100,50,40).data;assert(old.every((n,i)=>i%4===3||n===255),'Moving sticker reveals unsprayed paper beneath');
  const moved=ctx.getImageData(230,100,50,40).data;assert(moved.some((n,i)=>i%4!==3&&n<240),'Spray follows sticker movement');
  ownership.setFocus('box');ownership.beginChange();ownership.brush({x:250,y:120},{x:280,y:120},0x3344ee,false,{tip:'scatter',size:48});ownership.undoChange(ownership.endChange());ownership.dispose();
  // Adjacent sections remain seamless when magnified.
  const solid=new Uint8ClampedArray(128*128*4);for(let i=0;i<solid.length;i+=4){solid[i]=30;solid[i+1]=80;solid[i+2]=150;solid[i+3]=255;}
  const tiles=new RasterSpray(256,128,{version:1,width:256,height:128,tiles:[{x:0,y:0,pixels:solid},{x:1,y:0,pixels:solid}]});
  const zoom=document.createElement('canvas');zoom.width=1024;zoom.height=512;const z=zoom.getContext('2d')!;z.scale(4,4);tiles.draw(z);
  const seam=z.getImageData(508,100,8,1).data;assert(seam.every((n,i)=>n===[30,80,150,255][i%4]),'No section seams at 4x zoom');tiles.dispose();zoom.width=zoom.height=1;
  // Heavy multicolor usage: fixed section count and zero vector blobs as density grows.
  const heavy=Artwork.create(640,480,'#ffffff');const timings=[];const eventMs:number[]=[];let last={x:0,y:0};
  for(let pass=0;pass<3;pass++){
   const start=performance.now();heavy.beginChange();
   for(let y=0;y<480;y+=24)for(let x=0;x<640;x+=32){const p={x,y};const eventStart=performance.now();heavy.brush(last,p,[0xe94d5b,0x367bbe,0x33a477][pass]!,false,{tip:'scatter',size:64});eventMs.push(performance.now()-eventStart);last=p;}
   heavy.endChange();timings.push(performance.now()-start);
  }
  const start=performance.now(),dense=heavy.serialize(),serializeMs=performance.now()-start;
  assert(dense.surfaces[0]!.vectorPaint!.regions.length===0,'Heavy spray has zero vector blobs');assert(dense.surfaces[0]!.rasterSpray!.tiles.length<=20,'Heavy spray has bounded sections');
  const denseCanvas=document.createElement('canvas');denseCanvas.width=640;denseCanvas.height=480;const dc=denseCanvas.getContext('2d')!;
  const drawStart=performance.now();for(let i=0;i<20;i++)heavy.render(dc);dc.getImageData(0,0,1,1);const render20Ms=performance.now()-drawStart;
  eventMs.sort((a,b)=>a-b);
  const result={preview,sectionUndo:true,fillIgnoresSpray:true,eraserBoth:true,roundTrip:true,svgPixels:true,stickerLifecycle:true,heavy:{timings,eventP95Ms:eventMs[Math.floor(eventMs.length*.95)],eventMaxMs:eventMs.at(-1),serializeMs,render20Ms,tiles:dense.surfaces[0]!.rasterSpray!.tiles.length,rawPixelBytes:20*128*128*4,pixelBytes:dense.surfaces[0]!.rasterSpray!.tiles.reduce((n,t)=>n+t.pixels.byteLength,0)},resolution:sprayResolution(8192,2048)};
  heavy.dispose();denseCanvas.width=denseCanvas.height=1;return result;
 } finally {Math.random=random;art.dispose();canvas.width=canvas.height=1;}
}
