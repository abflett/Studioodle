/* global fetch, DOMParser, document, Path2D */
import { discoverRegions } from '../../scripts/discover-regions.mjs';
export async function analyzeOriginalInk(){
 const source=await(await fetch('/experiments/moon-sorceress/06-traced-ink.svg')).text();
 const doc=new DOMParser().parseFromString(source,'image/svg+xml');
 const width=340,height=480,scale=8,w=width*scale,h=height*scale;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,w,h);
 ctx.scale(scale,scale);ctx.transform(.1*width/888,0,0,-.1*height/1254,0,height);ctx.fillStyle='black';
 for(const p of doc.querySelectorAll('path'))ctx.fill(new Path2D(p.getAttribute('d')));
 const rgba=ctx.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);
 for(let i=0;i<gray.length;i++)gray[i]=rgba[i*4];
 const {areas,regionCount}=discoverRegions(gray,w,h,{id:'moon'},scale);
 const fit=Math.min(210/25.4*150/width,297/25.4*150/height),pixelArea=(fit/scale)**2;
 return{regionCount,tiny:areas.flatMap((area,index)=>area*pixelArea<10.2?[{id:index+1,area:area*pixelArea}]:[])};
}
