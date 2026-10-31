import { createElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorLayerShadows } from '../../src/ui/EditorLayerShadows';
const frame=()=>new Promise(r=>requestAnimationFrame(r));
let dispose: (()=>void) | undefined;
export async function mountLayerShadows(){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 function Fixture(){
  const studio=useRef<HTMLElement>(null);
  return createElement('main',{ref:studio,className:'art-studio',style:{position:'fixed',inset:0,zIndex:9999,background:'white'}},
   createElement('div',{className:'ribbon-shell',style:{height:60}},
    createElement('header',{className:'art-ribbon main-ribbon',style:{position:'absolute',inset:'0 0 auto',height:60,padding:0,background:'white'}}),
    createElement('div',{className:'art-ribbon sticker-ribbon',style:{top:56,left:'30%',right:'auto',width:'40%',height:104,padding:0,background:'white'}})),
   createElement('section',{className:'art-canvas',style:{position:'absolute',inset:0,background:'transparent'}},
    createElement('div',{className:'canvas-host',style:{position:'absolute',left:100,top:60,width:innerWidth-200,height:innerHeight-180,background:'white'}})),
   createElement(EditorLayerShadows,{studio,viewKey:'fixture',drawerVisible:true,hidden:false,focused:false}));
 }
 root.render(createElement(Fixture));dispose=()=>{root.unmount();host.remove();dispose=undefined;};
 for(let i=0;i<8;i++)await frame();
 return {orange:{x:innerWidth/2,y:60},purple:{x:innerWidth/2,y:160},blue:{x:200,y:60},green:{x:30,y:60},red:{x:innerWidth/2,y:innerHeight-120}};
}
export function unmountLayerShadows(){dispose?.();}
export async function sampleLayerShadows(data:string,points:Record<string,{x:number;y:number}>){
 const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 const result:Record<string,number[]>={};
 for(const [name,point] of Object.entries(points))result[name]=[1,3,6,10,18,28].map(distance=>{const i=(Math.round(point.y+distance)*canvas.width+Math.round(point.x))*4;return (765-pixels[i]!-pixels[i+1]!-pixels[i+2]!)/3;});
 return result;
}
