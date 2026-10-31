import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { StickerSelectionToolbar } from '../../src/ui/StickerSelectionToolbar';
import { createEditorBridge } from '../../src/editor/bridge';
import EditorPreview from '../../src/ui/EditorPreview';
import { prepareStudio } from '../../src/app/startup';
import { prepareStickers } from '../../src/editor/vectorStickers';
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>requestAnimationFrame(r));};
const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message);};
export async function checkRibbonCollapse(){
 await prepareStudio(()=>{});
 await prepareStickers(['circle']);
 const app=document.querySelector<HTMLElement>('#root')!,display=app.style.display;app.style.display='none';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const button=(label:string)=>host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
 const workspace=()=>host.querySelector('.art-canvas')!.getBoundingClientRect();
 const paper=()=>host.querySelector('.canvas-host')!.getBoundingClientRect();
 const center=()=>{const w=workspace(),p=paper();return {x:(w.left+w.width/2-p.left)/p.width,y:(w.top+w.height/2-p.top)/p.height};};
 try{
  root.render(createElement(EditorPreview,{setup:{id:'ribbon-check',title:'Ribbon check',format:'landscape',size:{width:innerWidth,height:innerHeight},background:'#ffffff',leafColor:0,document:{version:6,width:innerWidth,height:innerHeight,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff},{id:'circle',kind:'circle',x:innerWidth/2,y:innerHeight/2,scale:.2,color:0}]}},settings:{advancedPainting:true,mouseSpeed:100},onBack:()=>{}}));
  await settle();const fitted=paper(),open=workspace();
  const theme=document.documentElement.dataset.theme;
  try{
   document.documentElement.dataset.theme='light';
   const light=getComputedStyle(button('Go home')).color,lightGlow=getComputedStyle(button('Go home').querySelector('svg')!).filter;
   document.documentElement.dataset.theme='dark';
   assert(getComputedStyle(button('Go home')).color!==light,'Ribbon icon follows theme text color');
   assert(getComputedStyle(button('Go home').querySelector('svg')!).filter!==lightGlow,'Ribbon glow inverts with the theme');
  }finally{if(theme===undefined)delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;}

  const shadowRegion=()=>host.querySelector<HTMLElement>('[data-layer-shadow="ribbon-to-paper"]')!;
  const fittedShadow=shadowRegion().style.clipPath;
  assert(fittedShadow&& !shadowRegion().hidden,'Fitted paper receives the ribbon shadow');
  const drawerHost=document.createElement('div');host.querySelector('.ribbon-shell')!.append(drawerHost);const drawerRoot=createRoot(drawerHost);
  try{
   drawerRoot.render(createElement(StickerSelectionToolbar,{bridge:createEditorBridge(),focused:false,order:{forward:true,backward:true},drawerRef:{current:null},onFocus:()=>{},onFinish:()=>{}}));await settle();
   const drawer=drawerHost.querySelector('.sticker-ribbon')!.getBoundingClientRect(),buttons=[...drawerHost.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>b.getBoundingClientRect());
   if(innerWidth<=800)assert(drawer.left===0&&drawer.right===innerWidth&&drawer.height<=54,'Small-screen submenu fills width with compact vertical padding');
   else assert(drawer.left>0&&drawer.right<innerWidth,'Larger displays keep the inset submenu');
   const focus=drawerHost.querySelector<HTMLElement>('[aria-label="Focus on this sticker (F)"]')!,fill=getComputedStyle(focus);
   assert(fill.backgroundImage==='none'&&parseFloat(fill.borderRadius)>0&&parseFloat(fill.borderRadius)<=10,'Ribbon feedback uses softly rounded tiles');
   if(innerWidth<=800)assert(getComputedStyle(drawerHost.querySelector('.sticker-ribbon')!).borderBottomLeftRadius==='0px','Full-width submenu has square corners');
   assert(buttons.length===(innerWidth<=800?10:11)&&buttons.every(b=>Math.abs(b.top-buttons[0]!.top)<1&&b.left>=drawer.left&&b.right<=drawer.right),'Selection controls stay in one visible row, with fewer actions on small screens');
   assert(Math.abs((buttons[0]!.left+buttons.at(-1)!.right)/2-innerWidth/2)<1,'Submenu controls are centered without a separate Delete gap');
   if(innerWidth>800){const labels=[...drawerHost.querySelectorAll('button')].map(b=>b.getAttribute('aria-label'));assert(labels.indexOf('Duplicate')<labels.indexOf('Focus on this sticker (F)'),'Desktop Duplicate precedes Focus');}
   let finished=false;
   drawerRoot.render(createElement(StickerSelectionToolbar,{bridge:createEditorBridge(),focused:true,order:{forward:true,backward:true},drawerRef:{current:null},onFocus:()=>{},onFinish:()=>{finished=true;}}));await settle();
   assert(drawerHost.querySelectorAll('button').length===1&&!!drawerHost.querySelector('[aria-label="Exit focus"]'),'Focus has a single Done action');
   const focusedDrawer=drawerHost.querySelector<HTMLElement>('.is-focused')!,floating=focusedDrawer.getBoundingClientRect();
   assert(floating.width<=52&&floating.height<=52&&getComputedStyle(focusedDrawer).backgroundImage==='none','Focused Done floats without a submenu bar');
   drawerHost.querySelector<HTMLButtonElement>('[aria-label="Exit focus"]')!.click();assert(finished,'Focused Done exits focus');
  }finally{drawerRoot.unmount();drawerHost.remove();}
  const rows=host.querySelectorAll('.main-ribbon');
  for(const row of rows){const boxes=[...row.querySelectorAll('button')].filter(b=>innerWidth<=800||b!==button('Hide tools')).map(b=>b.getBoundingClientRect());assert(boxes.every(b=>Math.abs(b.top-boxes[0]!.top)<1),'Main ribbon stays on one row: '+JSON.stringify(boxes));assert(Math.abs((boxes[0]!.left+boxes.at(-1)!.right)/2-innerWidth/2)<1,'Main tools center independently of desktop Collapse');}
  const collapse=button('Hide tools').getBoundingClientRect();
  const collapseIcon=button('Hide tools').querySelector('svg')!.getBoundingClientRect();
  assert(collapse.right<=innerWidth&&collapse.top<12&&host.querySelector('.main-ribbon')!.lastElementChild===button('Hide tools'),'Collapse stays on the top row');
  if(innerWidth>800)assert(innerWidth-collapse.right<=12,'Desktop Collapse stays at the top right');
  for(const tool of host.querySelectorAll('.main-ribbon button')){
   if(tool===button('Hide tools'))continue;
   const box=tool.getBoundingClientRect();assert(box.right<=collapse.left||box.bottom<=collapse.top||box.top>=collapse.bottom,'Ribbon tools do not overlap collapse');
  }
  button('Hide tools').click();await settle();const full=workspace(),expanded=paper();
  assert(!host.querySelector('[data-layer-shadow]:not([hidden])'),'Collapsing tools also removes their shadows');
  assert(full.height>open.height&&full.top===0,'Collapse releases the whole ribbon space');
  assert(Math.abs(expanded.width-full.width)<1&&Math.abs(expanded.height-full.height)<1,'Fit expands to fill matching display ratio');
  assert(document.activeElement===button('Show tools'),'Hidden ribbon transfers keyboard focus to reopen');
  const floating=button('Show tools').getBoundingClientRect();assert(innerWidth-floating.right<=20&&floating.top<12,'Reopen stays at the top right');assert(floating.width>=44&&floating.height>=44,'Reopen keeps a touch-sized target');
  const reopenIcon=button('Show tools').querySelector('svg')!.getBoundingClientRect();
  assert(getComputedStyle(button('Show tools')).borderWidth==='0px','Reopen stays borderless');
  assert(Math.abs(reopenIcon.width-collapseIcon.width)<1&&Math.abs(reopenIcon.left-collapseIcon.left)<1&&Math.abs(reopenIcon.top-collapseIcon.top)<1,'Reopen matches the expanded icon size and position: '+JSON.stringify({collapseIcon,reopenIcon}));
  button('Show tools').click();await settle();assert(Math.abs(paper().height-fitted.height)<.01,'Reopening restores fitted page');
  host.querySelector<HTMLButtonElement>('button[aria-label^="Zoom "]')!.click();await settle();const zoomed=paper(),anchor=center();
  assert(shadowRegion().style.clipPath!==fittedShadow,'Shadow receivers follow manual zoom');
  button('Hide tools').click();await settle();assert(Math.abs(paper().width-zoomed.width)<.01,'Manual zoom does not change on collapse');
  assert(Math.abs(center().x-anchor.x)<.0001&&Math.abs(center().y-anchor.y)<.0001,'Manual artwork center stays anchored');
  button('Show tools').click();await settle();assert(Math.abs(paper().width-zoomed.width)<.01,'Manual zoom survives reopen');
  assert(document.activeElement===button('Hide tools'),'Reopening returns keyboard focus');
  const shortcut=()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'t',bubbles:true,cancelable:true}));
  shortcut();await settle();assert(button('Show tools'),'T hides the ribbon');
  shortcut();await settle();assert(!host.querySelector('.ribbon-reopen'),'T reopens the ribbon');
  button('Colors').click();await settle();shortcut();await settle();assert(!host.querySelector('.ribbon-reopen'),'T is paused while a picker is open');
  button('Close picker').click();await settle();
  const clickPaper=async(x:number,y:number)=>{const target=host.querySelector<HTMLElement>('.canvas-host')!,box=paper();for(const type of ['pointerdown','pointerup'])target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,button:0,buttons:type==='pointerdown'?1:0,clientX:box.left+box.width*x,clientY:box.top+box.height*y}));await settle();};
  button('Select and move stickers').click();await settle();await clickPaper(.5,.5);
  assert(!!host.querySelector('.sticker-ribbon:not(.is-focused)'),'Tapping a sticker opens selection controls');
  button('Select and move stickers').click();await settle();assert(!host.querySelector('.sticker-ribbon'),'Tapping Select again dismisses selection');
  button('Select and move stickers').click();await settle();await clickPaper(.5,.5);
  button('Fill').click();await settle();assert(!host.querySelector('.sticker-ribbon'),'Choosing a painting tool dismisses ordinary selection');
  button('Select and move stickers').click();await settle();await clickPaper(.5,.5);
  button('Focus on this sticker (F)').click();await settle();
  assert(!!host.querySelector('.focus-mode')&&host.querySelector('.sticker-ribbon')?.querySelectorAll('button').length===1,'Focusing shows only Done');
  assert(button('Select and move stickers').disabled&&button('Stickers').disabled,'Focus disables both Select and adding stickers');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'v',bubbles:true,cancelable:true}));await settle();
  assert(button('Fill').getAttribute('aria-pressed')==='true','V cannot activate selection during focus');
  assert([...host.querySelectorAll<HTMLElement>('[data-layer-shadow^="submenu-"]')].every(e=>e.hidden),'Focus has no phantom submenu shadow');
  button('Erase').click();await settle();assert(!!host.querySelector('.focus-mode'),'Painting tools preserve focused sticker');
  button('Exit focus').click();await settle();
  assert(!host.querySelector('.focus-mode')&&!!host.querySelector('.sticker-ribbon:not(.is-focused)')&&button('Select and move stickers').getAttribute('aria-pressed')==='true','Done restores normal sticker selection');
  assert(!button('Select and move stickers').disabled,'Leaving focus enables Select again');
  await clickPaper(.01,.01);assert(!host.querySelector('.sticker-ribbon'),'Tapping empty paper dismisses restored selection');
  return {shortcut:true,dialogGuard:true,fitExpansion:true,manualZoom:true,centerAnchor:true,focusReturn:true,touchTarget:true,focusedDone:true,selectionDismissal:true};
 }finally{root.unmount();host.remove();app.style.display=display;}
}
