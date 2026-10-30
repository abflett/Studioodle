import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SelectionScreen } from '../../src/ui/SelectionScreen';
import { pictureRepository } from '../../src/app/pictures';
import { pictureThumbnails } from '../../src/app/pictureThumbnails';
import { prepareStudio } from '../../src/app/startup';
import { pictureSummary } from '../../src/editor/pictureSummary';
import type { SavedPicture } from '../../src/editor/savedPicture';
let cleanup: (()=>void)|undefined;
let assets: Promise<unknown>|undefined;
const wait=async(test:()=>unknown)=>{for(let i=0;i<1000;i++){if(test())return;await new Promise(r=>setTimeout(r,15));}throw Error('Loading layout did not settle');};
export async function showGalleryLoading(format:'portrait'|'square'|'landscape',phase:'thumbnail'|'opening') {
 await (assets ??= prepareStudio(()=>{}));
 cleanup?.();
 const app=document.querySelector<HTMLElement>('#root')!,display=app.style.display;app.style.display='none';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const original={...pictureRepository},get=pictureThumbnails.get;
 const size=format==='portrait'?{width:240,height:320}:format==='landscape'?{width:320,height:240}:{width:240,height:240};
 const picture:SavedPicture={id:'loading-layout',title:'Loading layout',version:6,updatedAt:1,format,size,background:'#ffffff',leafColor:0,document:{version:6,...size,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff}]}};
 let finish:((value:SavedPicture)=>void)|undefined;
 pictureRepository.list=async()=>[pictureSummary(picture)];
 pictureRepository.get=()=>new Promise(resolve=>{finish=resolve;});
 pictureThumbnails.get=(_picture,signal)=>new Promise((_resolve,reject)=>{signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});
 const show=(opening=false)=>root.render(createElement(SelectionScreen,{opening,onOpen:()=>show(true),onExit:()=>{},theme:'light',onThemeChange:()=>{},settings:{advancedPainting:true,mouseSpeed:100},onSettingsChange:()=>{}}));
 show();
 cleanup=()=>{root.unmount();host.remove();app.style.display=display;Object.assign(pictureRepository,original);pictureThumbnails.get=get;};
 await wait(()=>host.querySelector('.preview-loading'));
 await wait(()=>[...host.querySelectorAll<HTMLImageElement>('.portfolio-stack-art')].every(image=>image.complete));
 await new Promise(r=>setTimeout(r,160));
 const geometry=()=>{
  const stack=host.querySelector('.portfolio-stack')!.getBoundingClientRect(),brand=host.querySelector('.portfolio-stack-brand')!.getBoundingClientRect();
  const status=host.querySelector<HTMLElement>('.portfolio-stack-status')!,spinner=status.querySelector('svg')!.getBoundingClientRect();
  if(getComputedStyle(status).display==='none'||Math.abs(spinner.x+spinner.width/2-(brand.x+brand.width/2))>2||spinner.top<brand.bottom||spinner.bottom>stack.bottom)throw Error('Spinner must sit under the logo, inside the stack');
  return {x:spinner.x,y:spinner.y};
 };
 if(getComputedStyle(host.querySelector('.portfolio-status-error')!).display!=='none')throw Error('Loading must show only the spinner');
 const before=geometry();
 if(phase==='opening'){
  host.querySelector<HTMLButtonElement>('.previous-picture')!.click();await wait(()=>host.querySelector('[data-opening]'));
  if(getComputedStyle(host.querySelector('.portfolio-pile')!).visibility!=='hidden'||!host.querySelector<HTMLElement>('.selection')!.inert)throw Error('Opening should hide the saved sheet and suspend its controls');
  const during=geometry();if(Math.abs(during.x-before.x)>1||Math.abs(during.y-before.y)>1)throw Error('Loading position must stay fixed');
  finish?.(picture);await new Promise(r=>setTimeout(r,30));
  geometry();
  if(host.querySelector('progress')||document.querySelector('.asset-loading'))throw Error('Image opening must not use the progress overlay');
 }
 return {format,phase,spinner:geometry()};
}
export function closeGalleryLoading(){cleanup?.();cleanup=undefined;}
