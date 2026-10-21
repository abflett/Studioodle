import { Artwork } from '../../src/editor/Artwork';
import { paintPath } from '../../src/editor/vectorPaintStyles';
import type { ArtworkDocument } from '../../src/editor/document';
import type { MultiPolygon } from '../../src/editor/polygonGeometry';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function denseDocument():ArtworkDocument{
 const ring=(radius:number,reverse=false)=>{
  const points=Array.from({length:240},(_,i)=>[150+Math.cos(i*Math.PI/120)*radius,150+Math.sin(i*Math.PI/120)*radius] as [number,number]);
  if(reverse)points.reverse();points.push([...points[0]!] as [number,number]);return points;
 };
 return {version:5,width:300,height:300,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff,vectorPaint:{version:1,regions:[{id:1,base:0xffffff,
  blobs:Array.from({length:8},(_,i)=>({color:[0x773399,0xee7733,0x228899][i%3]!,geometry:[[ring(140-i*14),ring(129-i*14,true)]]}))}]}}]};
}
const pixel=(ctx:CanvasRenderingContext2D,x:number,y:number)=>[...ctx.getImageData(x,y,1,1).data];
export async function checkPaintDisplay(){
 const doc=denseDocument(),art=Artwork.restore(doc),canvas=document.createElement('canvas'),reference=document.createElement('canvas');
 canvas.width=canvas.height=reference.width=reference.height=600;
 const ctx=canvas.getContext('2d')!,ref=reference.getContext('2d')!;ctx.scale(2,2);ref.scale(2,2);
 const descriptor=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'fill')!;
 let fills=0;
 Object.defineProperty(CanvasRenderingContext2D.prototype,'fill',{...descriptor,value:function(this:CanvasRenderingContext2D,...args:unknown[]){fills++;return Reflect.apply(descriptor.value,this,args);}});
 try{
  art.render(ctx,false,true);art.render(ref);
  assert(pixel(ctx,300,60).join()===pixel(ref,300,60).join(),'Initial cached vector paint differs');
  fills=0;art.render(ctx,false,true);assert(fills===0,'Unchanged dense paint must reuse its display instead of filling old paths');
  art.beginChange();art.brush({x:140,y:150},{x:160,y:150},0x00dd55,false,{kind:'ink',size:10,shape:'round'});const undo=art.endChange();
  fills=0;art.render(ctx,false,true);assert(fills<=2,'An incremental brush must not redraw old color partitions');
  assert(pixel(ctx,300,300)[1]!>180,'Incremental paint was not displayed');
  await art.compactPaint();fills=0;art.render(ctx,false,true);assert(fills===0,'Worker merging must not rebuild the unchanged picture');
  art.undoChange(undo);art.render(ctx,false,true);assert(pixel(ctx,300,300).join()===pixel(ref,300,300).join(),'Undo did not invalidate cached paint');
  await art.fill({x:5,y:5},0xff88bb);art.render(ctx,false,true);art.render(ref);
  assert(pixel(ctx,10,10).join()===pixel(ref,10,10).join(),'Bucket fill did not invalidate cached paint');
  ctx.setTransform(1.25,0,0,1.25,30.3,12.6);ref.setTransform(1.25,0,0,1.25,30.3,12.6);ctx.clearRect(-100,-100,1000,1000);ref.clearRect(-100,-100,1000,1000);
  art.render(ctx,false,true);art.render(ref);
  assert(pixel(ctx,100,100).join()===pixel(ref,100,100).join(),'Changed view transform did not rebuild cached paint');
  // Numeric construction must preserve compound paths and holes exactly.
  const geometry:MultiPolygon=[[[[0,0],[40,0],[40,40],[0,40],[0,0]],[[10,10],[10,30],[30,30],[30,10],[10,10]]]];
  const text=geometry.flatMap(p=>p.map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join('')+'Z')).join('');
  ctx.resetTransform();ref.resetTransform();ctx.clearRect(0,0,600,600);ref.clearRect(0,0,600,600);ctx.fillStyle=ref.fillStyle='purple';
  ctx.fill(paintPath(geometry));ref.fill(new Path2D(text));
  const a=ctx.getImageData(0,0,50,50).data,b=ref.getImageData(0,0,50,50).data;assert(a.every((value,index)=>value===b[index]),'Numeric paint paths changed hole rendering');
  const large=document.createElement('canvas');large.width=large.height=1800;
  const largeCtx=large.getContext('2d')!;largeCtx.scale(6,6);
  const create=document.createElement,own=Object.getOwnPropertyDescriptor(document,'createElement');
  const buffers:HTMLCanvasElement[]=[],copies:Artwork[]=[];
  Object.defineProperty(document,'createElement',{configurable:true,value:function(this:Document,...args:unknown[]){const element=Reflect.apply(create,this,args);if(args[0]==='canvas')buffers.push(element);return element;}});
  try{
   for(let i=0;i<4;i++){const copy=Artwork.restore(doc);copies.push(copy);copy.render(largeCtx,false,true);}
   assert(buffers.reduce((sum,c)=>sum+c.width*c.height*4,0)<=32*1024*1024+16,'Display cache exceeded its global pixel budget');
   fills=0;copies[0]!.render(largeCtx,false,true);assert(fills>0,'Evicted display did not rebuild');
   fills=0;copies[0]!.render(largeCtx,false,true);assert(fills===0,'Rebuilt display was not reused');
  }finally{
   for(const copy of copies)copy.dispose();
   if(own)Object.defineProperty(document,'createElement',own);else Reflect.deleteProperty(document,'createElement');
  }
  assert(buffers.every(c=>c.width===1&&c.height===1),'Disposed display retained its backing pixels');
  return {boundedMemory:true,numericPaths:true,incrementalDisplay:true,noRebuildAfterMerge:true,fillUndoZoomInvalidation:true};
 }finally{Object.defineProperty(CanvasRenderingContext2D.prototype,'fill',descriptor);art.dispose();}
}
