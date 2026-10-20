import { Artwork } from '../../src/editor/Artwork';
import { VectorPaint } from '../../src/editor/VectorPaint';
import { decodeSvgDefinition } from '../../src/editor/svgDefinition';
export async function checkPaintSeams(){
 const art=Artwork.create(100,100,'#f5f0e0');
 const dark=0x2a190f,purple=0x4b1e64;
 for(let i=0;i<180;i++){
  const a=i/180*Math.PI*2,b=(i+1)/180*Math.PI*2;
  art.brush({x:50+30*Math.cos(a),y:50+38*Math.sin(a)},{x:50+30*Math.cos(b),y:50+38*Math.sin(b)},dark,false,{kind:'ink',shape:'round',size:2});
 }
 art.brush({x:50,y:7},{x:50,y:93},dark,false,{kind:'ink',shape:'round',size:2});
 if(!await art.fill({x:65,y:50},purple))throw Error('Right pocket did not fill');
 if(!await art.fill({x:95,y:50},dark))throw Error('Outside did not fill');
 await art.compactPaint();
 const stored=JSON.stringify(art.serialize());
 const canvas=document.createElement('canvas'),results=[];
 for(const scale of [.75,1,1.37,3,8]){
  canvas.width=canvas.height=Math.ceil(102*scale+2);
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.setTransform(scale,0,0,scale,.27,.33);art.render(ctx);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let fringes=0,max=0,antialiased=0;
  for(let y=Math.ceil(5*scale+.33);y<95*scale+.33;y++)for(let x=Math.ceil(55*scale+.27);x<97*scale+.27;x++){
   const i=(y*canvas.width+x)*4,channel=Math.max(data[i]!,data[i+1]!,data[i+2]!);
   max=Math.max(max,channel);if(channel>103)fringes++;
   const rgb=(data[i]!<<16)|(data[i+1]!<<8)|data[i+2]!;if(rgb!==dark&&rgb!==purple)antialiased++;
  }
  if(fringes)throw Error(`${fringes} pale paint seams at ${scale}x`);
  if(!antialiased)throw Error(`Paint edges lost antialiasing at ${scale}x`);
  results.push({scale,fringes,max,antialiased});
 }
 if(JSON.stringify(art.serialize())!==stored)throw Error('Rendering changed stored paint');
 const definition=decodeSvgDefinition('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-bounds="0 0 100 100" data-region-format="1"><g id="regions"><path data-bounds="0 0 100 100" d="M0 0H100V100H0Z"/></g><g id="ink"/></svg>');
 const isolated=new VectorPaint({version:1,regions:[{id:1,base:0xffffff,blobs:[
  {color:dark,geometry:[[[[20,20],[80,80],[20,80],[20,20]]]]},
  {color:purple,geometry:[[[[20,20],[80,20],[80,80],[20,20]]]]},
 ]}]});
 const bounds=document.createElement('canvas');bounds.width=bounds.height=100;const bc=bounds.getContext('2d',{willReadFrequently:true})!;
 bc.translate(.27,.33);isolated.draw(bc,definition);
 for(let y=25;y<75;y++)if([...bc.getImageData(19,y,1,1).data.slice(0,3)].some(v=>v!==255))throw Error('Seam underpaint expanded the brush outline');
 return {results,diagnosticPng:canvas.toDataURL()};
}
