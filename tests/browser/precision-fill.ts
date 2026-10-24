import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { usePrecisionFill } from '../../src/ui/usePrecisionFill';
import { appMousePointerId } from '../../src/ui/appMouse';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
export async function checkPrecisionFill(){
 const container=document.createElement('div');document.body.append(container);
 let state:ReturnType<typeof usePrecisionFill>|undefined,element:HTMLElement|null=null,restores=0;
 const fills:{x:number;y:number}[]=[];
 function Harness(){
  state=usePrecisionFill({enabled:true,magnify:()=>({offset:{x:80,y:-90},restore:()=>{restores++;}}),fill:point=>fills.push(point)});
  return createElement('section',{ref:(node:HTMLElement|null)=>{element=node;},...state.handlers,style:{position:'fixed',left:0,top:0,width:400,height:300}});
 }
 const root=createRoot(container);root.render(createElement(Harness));
 const pointer=(type:string,x:number,y:number)=>element!.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:appMousePointerId,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
 const hold=async()=>{pointer('pointerdown',20,290);await new Promise(resolve=>setTimeout(resolve,560));await frame();};
 try{
  await frame();await frame();
  await hold();
  if(state?.aim?.x!==100||state.aim.y!==200)throw Error('Magnified cross must follow inset target');
  pointer('pointerup',20,290);
  if(fills[0]?.x!==100||fills[0].y!==200||restores!==1)throw Error('Stationary release lost original target');
  await hold();pointer('pointermove',30,280);await frame();
  if(Number(state?.aim?.x)!==110||Number(state?.aim?.y)!==190)throw Error('Fine aiming must track relative pointer movement');
  pointer('pointerup',30,280);
  if(fills[1]?.x!==110||fills[1].y!==190)throw Error('Fill must use visible inset cross');
  await hold();pointer('pointerup',20,310);
  if(fills.length!==2||Number(restores)!==3)throw Error('Outside release must cancel and restore');
  pointer('pointerdown',20,290);pointer('pointerup',20,290);
  if(fills[2]?.x!==20||fills[2].y!==290)throw Error('Quick fill must remain at original press');
  return {insetAim:true,stationaryTarget:true,relativeMovement:true,outsideCancellation:true,quickFill:true};
 }finally{root.unmount();container.remove();}
}
