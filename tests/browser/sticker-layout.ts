import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import EditorPreview from '../../src/ui/EditorPreview';
import { stickerCategories } from '../../src/ui/stickerCatalog';
import { prepareStudio } from '../../src/app/startup';

const settle=async()=>{for(let i=0;i<6;i++)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));};
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
let host:HTMLDivElement,cleanup:(()=>void)|undefined;
export async function mountStickerLayout(){
 await prepareStudio(()=>{});
 const app=document.querySelector<HTMLElement>('#root')!,display=app.style.display;app.style.display='none';
 host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 cleanup=()=>{root.unmount();host.remove();app.style.display=display;};
 root.render(createElement(EditorPreview,{setup:{id:'sticker-layout',title:'Sticker layout',format:'landscape',size:{width:400,height:300},background:'#ffffff',leafColor:0},settings:{advancedPainting:true,mouseSpeed:100},onBack:()=>{}}));
 await settle();host.querySelector<HTMLButtonElement>('[aria-label="Stickers"]')!.click();await settle();
 host.querySelector<HTMLButtonElement>('[aria-label="Animals"]')!.click();await settle();
}
export async function checkStickerLayout(){
 await settle();
 const dialog=host.querySelector<HTMLDialogElement>('.sticker-dialog')!,grid=host.querySelector<HTMLElement>('.sticker-item-grid')!,buttons=[...grid.querySelectorAll('button')];
 const bounds=dialog.getBoundingClientRect(),inside=(element:Element)=>{const b=element.getBoundingClientRect();return b.left>=bounds.left&&b.right<=bounds.right+1&&b.top>=bounds.top&&b.bottom<=bounds.bottom+1;};
 assert([...dialog.querySelectorAll('button')].every(inside),'Sticker controls must remain inside the overlay');
 assert(dialog.scrollWidth<=dialog.clientWidth&&dialog.scrollHeight<=dialog.clientHeight+1,'Sticker pages fit without scrolling');
 assert(buttons.length>0&&buttons.length<=24,'Responsive sticker pages keep preview mounting bounded');
 const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length,rows=Math.ceil(buttons.length/columns);
 if(innerWidth===390&&innerHeight===844)assert(rows>=4,'Tall phones use the room for two more sticker rows');
 if(innerWidth===667&&innerHeight===375)assert(columns>=4,'Wider short screens use an extra sticker column');
 assert(buttons.every(button=>button.getBoundingClientRect().width>=80),'Sticker targets remain recognizable and comfortably wide');
 return {width:innerWidth,height:innerHeight,columns,rows,count:buttons.length};
}
export async function checkStickerPagination(){
 const titles=()=>[...host.querySelectorAll('.sticker-item')].map(button=>button.getAttribute('aria-label'));
 const next=host.querySelector<HTMLButtonElement>('[aria-label="Next stickers"]')!,total=Number(host.querySelector('.sticker-paging span')!.textContent!.split('/')[1]);
 const seen=[];
 for(let i=0;i<total;i++){seen.push(...titles());next.click();await settle();}
 assert(JSON.stringify(seen)===JSON.stringify(stickerCategories.find(c=>c.id==='animals')!.items.map(item=>item.title)),'Paging visits each matching sticker exactly once');
 next.click();await settle();
 return titles()[0];
}
export async function checkStickerResize(first:string){await settle();assert([...host.querySelectorAll('.sticker-item')].some(button=>button.getAttribute('aria-label')===first),'Resizing keeps the previous first sticker in view');}
export function closeStickerLayout(){cleanup?.();cleanup=undefined;}
