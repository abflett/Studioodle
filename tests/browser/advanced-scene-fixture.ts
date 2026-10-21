import book from '../../src/assets/coloringBook.json';
import { Artwork } from '../../src/editor/Artwork';
import { UndoHistory } from '../../src/editor/UndoHistory';
import { prepareStickers, vectorDefinition } from '../../src/editor/vectorStickers';
import type { SavedPicture } from '../../src/editor/savedPicture';
import type { ArtworkDocument, Point, SurfaceData } from '../../src/editor/document';
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const palette=[0x8eaa59,0xd6ac6a,0xce7b50,0xf0ce8b,0x729ea1,0x986799,0x759659,0xe1a268];
function world(surface:SurfaceData,x:number,y:number){
 if(surface.kind==='canvas')return {x,y};
 const d=vectorDefinition(surface.kind),angle=(surface.rotation??0)*Math.PI/180,scale=surface.scale??1;
 const dx=(x-Math.floor(d.width/2))*scale*(surface.flipX?-1:1),dy=(y-Math.floor(d.height/2))*scale*(surface.flipY?-1:1);
 return {x:surface.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:surface.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
}
export async function createAdvancedSceneFixture(){
 const start=performance.now(),page=book.pages.find(p=>p.id==='safari')!;
 const doc=structuredClone(page.document) as ArtworkDocument;
 const ratio=1754/doc.width;doc.width=1754;doc.height=Math.round(doc.height*ratio);
 for(const surface of doc.surfaces){surface.x*=ratio;surface.y*=ratio;if(surface.kind!=='canvas')surface.scale=(surface.scale??1)*ratio;}
 await prepareStickers(doc.surfaces.map(s=>s.kind));
 let regions=0;
 for(const [i,surface] of doc.surfaces.entries()){
  if(surface.kind==='canvas'){surface.color=0xe8dcc0;continue;}
  const definition=vectorDefinition(surface.kind);
  surface.vectorPaint={version:1,regions:definition.regions.map((r,j)=>({id:r.id,base:palette[(i+j)%palette.length]!,blobs:[]}))};regions+=definition.regions.length;
 }
 const art=Artwork.restore(doc),history=new UndoHistory();let samples=0,strokes=0;
 try{
  for(const [index,surface] of doc.surfaces.entries()){
   const definition=surface.kind==='canvas'?undefined:vectorDefinition(surface.kind),b=definition?.bounds??{left:0,top:0,right:doc.width,bottom:doc.height};
   art.setFocus(surface.id);
   for(let stroke=0;stroke<8;stroke++){
    art.beginChange();let previous:Point|undefined;
    for(let step=0;step<25;step++){
     const t=step/24,x=b.left+(b.right-b.left)*(.12+.76*t),y=b.top+(b.bottom-b.top)*(.15+stroke*.09+Math.sin(t*Math.PI*3+stroke)*.07);
     const point=world(surface,x,y),base=palette[(index+stroke)%palette.length]!,color=stroke%2?Math.min(0xffffff,base+0x181818):((base&0xfefefe)>>1);
     art.brush(previous??point,point,color,false,{kind:'ink',size:stroke%2?3.5:9,shape:'round'});previous=point;samples++;
    }
    history.push(art.endChange());strokes++;await pause(17);
   }
   await art.compactPaint();
  }
  art.setFocus();await art.compactPaint();await history.settled();
  const picture:SavedPicture={id:'advanced-scene-profile',version:5,title:'Advanced Safari Stress Scene',updatedAt:1,format:'landscape',size:{width:doc.width,height:doc.height},background:'#e8dcc0',leafColor:0x242428,document:art.serialize()};
  const paint=picture.document.surfaces.flatMap(s=>s.vectorPaint?.regions??[]);
  const vertices=paint.flatMap(r=>r.blobs).flatMap(b=>b.geometry).flatMap(p=>p).reduce((n,r)=>n+r.length,0);
  return {picture,metrics:{stickers:doc.surfaces.length-1,regions,setupStrokes:strokes,setupBrushSamples:samples,blobs:paint.reduce((n,r)=>n+r.blobs.length,0),vertices,documentJsonBytes:new Blob([JSON.stringify(picture)]).size,setupMs:performance.now()-start}};
 }finally{art.dispose();history.clear();}
}
