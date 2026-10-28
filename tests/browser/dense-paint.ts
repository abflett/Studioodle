import { Artwork as CurrentArtwork } from '../../src/editor/Artwork';
const frame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
const percentile=(values:number[],fraction:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*fraction))]!;

/** Dense multicolor workload: measures display cost after paint has accumulated. */
export async function profileDensePaint(Artwork:typeof CurrentArtwork=CurrentArtwork){
 const art=Artwork.create(900,700,'#f6f2e8'),colors=[0x8c1830,0x47318d,0xe23c3c,0xf06d35,0xf1c59b,0x301b12];
 const canvas=document.createElement('canvas');canvas.width=1350;canvas.height=1050;
 const ctx=canvas.getContext('2d')!;ctx.scale(1.5,1.5);
 try{
  for(let stroke=0;stroke<30;stroke++){
   let previous={x:450+Math.cos(stroke)*200,y:350+Math.sin(stroke)*200};
   for(let step=1;step<=96;step++){
    const angle=stroke*.71+step*.11;
    const next={x:450+Math.sin(angle*1.7+stroke*.13)*290,y:350+Math.cos(angle*1.3+stroke*.41)*250};
    art.brush(previous,next,colors[stroke%colors.length]!,false,{tip:'round',size:5+stroke%4});previous=next;
   }
   await art.compactPaint();
  }
  const data=art.serialize(),points=data.surfaces.flatMap(surface=>surface.vectorPaint?.regions??[]).reduce((n,region)=>n+region.blobs.reduce((n,blob)=>n+blob.geometry.reduce((n,polygon)=>n+polygon.reduce((n,ring)=>n+ring.length,0),0),0),0);
  art.render(ctx,false,true);ctx.getImageData(675,525,1,1);await frame();
  const drawMs:number[]=[],brushMs:number[]=[],frameMs:number[]=[];
  const NativePath=globalThis.Path2D;let stringPaths=0,stringBytes=0;
  globalThis.Path2D=class extends NativePath {constructor(path?:string|Path2D){super(path);if(typeof path==='string'){stringPaths++;stringBytes+=path.length;}}};
  let previous={x:420,y:290},lastFrame=await frame();
  try{
   for(let step=0;step<90;step++){
    const point={x:420+Math.sin(step*.17)*70,y:290+step*2};
    let start=performance.now();art.brush(previous,point,colors[Math.floor(step/8)%colors.length]!,false,{tip:'round',size:8});brushMs.push(performance.now()-start);
    start=performance.now();art.render(ctx,false,true);ctx.getImageData(675,525,1,1);drawMs.push(performance.now()-start);
    await new Promise(resolve=>setTimeout(resolve,16));const now=await frame();frameMs.push(now-lastFrame);lastFrame=now;previous=point;
   }
  }finally{globalThis.Path2D=NativePath;}
  await art.compactPaint();
  return {points,brushP95Ms:percentile(brushMs,.95),drawP95Ms:percentile(drawMs,.95),drawMaxMs:Math.max(...drawMs),frameP95Ms:percentile(frameMs,.95),stringPaths,stringBytes,diagnosticPng:canvas.toDataURL()};
 }finally{art.dispose();}
}
