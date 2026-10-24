import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { usePaperView } from '../../src/ui/usePaperView';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
export async function checkPaperView(){
 const container=document.createElement('div');document.body.append(container);
 let view:ReturnType<typeof usePaperView>|undefined;
 let setRequested:(zoom:number|null)=>void=()=>{};
 function Harness(){
  const [requested,setZoom]=useState<number|null>(null);setRequested=setZoom;
  view=usePaperView({width:200,height:200},requested,false);
  return createElement('section',{ref:view.viewport,style:{position:'fixed',left:0,top:0,width:400,height:300}},
   createElement('div',{style:{position:'absolute',left:view.position.x,top:view.position.y,width:200*view.zoom,height:200*view.zoom}}));
 }
 const root=createRoot(container);root.render(createElement(Harness));
 try{
  await frame();await frame();await frame();
  if(!view)throw Error('Paper view not mounted');
  const initial=view.captureView();
  for(const point of [{x:50,y:0},{x:350,y:0},{x:50,y:299},{x:350,y:299},{x:200,y:299},{x:5,y:299}]){
   view.restoreView(initial);setRequested(null);await frame();await frame();
   const before=view.pointAt(point)!;
   setRequested(view.zoomAt(point,8));await frame();await frame();
   const after=view.pointAt(point)!;
   if(Math.abs(before.x-after.x)>.00001||Math.abs(before.y-after.y)>.00001)throw Error('Precision zoom shifted its anchor');
   const paper=view.viewport.current!.firstElementChild!.getBoundingClientRect();
   if(Math.abs((point.x-paper.left)/view.zoom-before.x)>.00001||Math.abs((point.y-paper.top)/view.zoom-before.y)>.00001)throw Error('Rendered paper moved away from precision anchor');
  }
  view.restoreView(initial);setRequested(null);await frame();await frame();
  const restored=view.captureView()!;
  if(!initial||Math.abs(restored.x-initial.x)>.00001||Math.abs(restored.y-initial.y)>.00001||Math.abs(restored.zoom-initial.zoom)>.00001)throw Error('Precision zoom failed to restore original view');
  return {edgeAnchors:true,renderedAnchors:true,restoration:true};
 }finally{root.unmount();container.remove();}
}
