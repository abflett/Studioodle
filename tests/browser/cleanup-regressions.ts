import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import EditorPreview from '../../src/ui/EditorPreview';
import { pictureRepository } from '../../src/app/pictures';
import { prepareStudio } from '../../src/app/startup';
import type { SavedPicture } from '../../src/editor/savedPicture';
const wait=async(test:()=>unknown)=>{for(let i=0;i<500;i++){if(test())return;await new Promise(r=>setTimeout(r,10));}throw Error('Async sticker check did not settle');};
const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
export async function checkAsyncStickerPlacement(){
 await prepareStudio(()=>{});
 const app=document.querySelector<HTMLElement>('#root')!,display=app.style.display;app.style.display='none';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const fetch=window.fetch,save=pictureRepository.save;
 let target='',release:(()=>void)|undefined,saved:SavedPicture|undefined;
 window.fetch=(input,options)=>String(input).includes(target)&&target?new Promise(resolve=>{release=()=>resolve(fetch(input,options));}):fetch(input,options);
 pictureRepository.save=async picture=>{saved=picture;};
 const button=(label:string)=>host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
 const open=async()=>{button('Stickers').click();await wait(()=>host.querySelector('.sticker-dialog[open]'));button('Vehicles').click();await wait(()=>host.querySelector('.sticker-item img'));};
 try{
  root.render(createElement(EditorPreview,{setup:{id:'cleanup-sticker',title:'Cleanup regression',format:'landscape',size:{width:320,height:240},background:'#ffffff',leafColor:0},settings:{advancedPainting:true,mouseSpeed:100},onBack:()=>{}}));
  await wait(()=>host.querySelector('.canvas-host canvas'));
  await open();const first=host.querySelector<HTMLImageElement>('.sticker-item img')!;target=new URL(first.src).pathname;
  first.closest<HTMLButtonElement>('button')!.click();await wait(()=>release);
  button('Close picker').click();await wait(()=>!host.querySelector('dialog[open]'));
  release!();release=undefined;await new Promise(r=>setTimeout(r,100));
  if(saved||host.querySelector('[aria-label="Selected sticker"]'))throw Error('Closing the picker must cancel pending placement');
  await open();const second=host.querySelectorAll<HTMLImageElement>('.sticker-item img')[1]!;target=new URL(second.src).pathname;
  second.closest<HTMLButtonElement>('button')!.click();await wait(()=>release);
  const workspace=host.querySelector<HTMLElement>('.art-canvas')!;workspace.style.width='55vw';await frame();await new Promise(r=>setTimeout(r,50));
  const box=workspace.getBoundingClientRect(),canvas=host.querySelector('.canvas-host')!.getBoundingClientRect();
  const expected={x:Math.round((box.left+box.width/2-canvas.left)/canvas.width*320),y:Math.round((box.top+box.height/2-canvas.top)/canvas.height*240)};
  release!();await wait(()=>saved);
  const sticker=(saved as unknown as SavedPicture).document.surfaces[1]!;
  if(Math.abs(sticker.x-expected.x)>1||Math.abs(sticker.y-expected.y)>1)throw Error('Placement must use the current resized view');
  return {closedPickerCancels:true,currentViewPlacement:true,retry:true};
 }finally{window.fetch=fetch;pictureRepository.save=save;root.unmount();host.remove();app.style.display=display;}
}
