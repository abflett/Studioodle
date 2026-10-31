import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import EditorPreview from '../../src/ui/EditorPreview';
import { prepareStudio } from '../../src/app/startup';
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>requestAnimationFrame(r));};
const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message);};
export async function checkRibbonCollapse(){
 await prepareStudio(()=>{});
 const app=document.querySelector<HTMLElement>('#root')!,display=app.style.display;app.style.display='none';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const button=(label:string)=>host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
 const workspace=()=>host.querySelector('.art-canvas')!.getBoundingClientRect();
 const paper=()=>host.querySelector('.canvas-host')!.getBoundingClientRect();
 const center=()=>{const w=workspace(),p=paper();return {x:(w.left+w.width/2-p.left)/p.width,y:(w.top+w.height/2-p.top)/p.height};};
 try{
  root.render(createElement(EditorPreview,{setup:{id:'ribbon-check',title:'Ribbon check',format:'landscape',size:{width:innerWidth,height:innerHeight},background:'#ffffff',leafColor:0},settings:{advancedPainting:true,mouseSpeed:100},onBack:()=>{}}));
  await settle();const fitted=paper(),open=workspace();
  const collapse=button('Hide tools').getBoundingClientRect();
  assert(collapse.right<=innerWidth&&innerWidth-collapse.right<=20&&collapse.top<12,'Collapse is at the ribbon top right');
  for(const tool of host.querySelectorAll('.main-ribbon button')){
   const box=tool.getBoundingClientRect();assert(box.right<=collapse.left||box.bottom<=collapse.top||box.top>=collapse.bottom,'Ribbon tools do not overlap collapse');
  }
  button('Hide tools').click();await settle();const full=workspace(),expanded=paper();
  assert(full.height>open.height&&full.top===0,'Collapse releases the whole ribbon space');
  assert(Math.abs(expanded.width-full.width)<1&&Math.abs(expanded.height-full.height)<1,'Fit expands to fill matching display ratio');
  assert(document.activeElement===button('Show tools'),'Hidden ribbon transfers keyboard focus to reopen');
  const floating=button('Show tools').getBoundingClientRect();assert(Math.abs(floating.right-collapse.right)<1&&Math.abs(floating.top-collapse.top)<1,'Toggle stays in the same corner');assert(floating.width>=44&&floating.height>=44,'Reopen keeps a touch-sized target');
  button('Show tools').click();await settle();assert(Math.abs(paper().height-fitted.height)<.01,'Reopening restores fitted page');
  host.querySelector<HTMLButtonElement>('button[aria-label^="Zoom "]')!.click();await settle();const zoomed=paper(),anchor=center();
  button('Hide tools').click();await settle();assert(Math.abs(paper().width-zoomed.width)<.01,'Manual zoom does not change on collapse');
  assert(Math.abs(center().x-anchor.x)<.0001&&Math.abs(center().y-anchor.y)<.0001,'Manual artwork center stays anchored');
  button('Show tools').click();await settle();assert(Math.abs(paper().width-zoomed.width)<.01,'Manual zoom survives reopen');
  assert(document.activeElement===button('Hide tools'),'Reopening returns keyboard focus');
  return {fitExpansion:true,manualZoom:true,centerAnchor:true,focusReturn:true,touchTarget:true};
 }finally{root.unmount();host.remove();app.style.display=display;}
}
