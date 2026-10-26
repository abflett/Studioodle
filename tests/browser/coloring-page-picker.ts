import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ColoringPagePicker } from '../../src/ui/ColoringPagePicker';
import { coloringPages } from '../../src/app/coloringPages';
import { makeColoringBook } from '../../src/editor/coloringBook';
import { pageSharingCode } from '../../src/app/coloringPageSharing';
import { workshopRepository } from '../../src/app/coloringBookWorkshop';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export async function checkColoringPagePicker(){
 const keys=['studioodle.page-favorites.v1','studioodle.workshop.v2'];
 const previous=keys.map(key=>localStorage.getItem(key));
 localStorage.removeItem(keys[0]!);
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 const custom={...coloringPages[1]!,id:'picker-custom',title:'Custom Test'};
 const pages=[...coloringPages,custom];let opened='',deleted='',added='';
 const props={pages,bundledIds:new Set(coloringPages.map(p=>p.id)),onOpen:(p:{id?:string})=>{opened=p.id!;},onClose:()=>{},onDelete:(p:{id:string})=>{deleted=p.id;},onAdded:(id:string)=>{added=id;}};
 const mount=async()=>{root.render(createElement(ColoringPagePicker,props));await frame();await frame();};
 const click=async(label:string)=>{const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.getAttribute('aria-label')===label);assert(b,'Missing button '+label);b.click();await frame();};
 try{
  await mount();
  assert(!container.textContent?.includes('Edit Page'),'Debug edit action must not be exposed');
  container.querySelector('dialog')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await frame();
  assert(container.querySelector('.page-number-badge')?.textContent==='2 / 7','Single navigation count');
  await click('Add '+coloringPages[1]!.title+' to favorites');
  assert(container.querySelector('.page-number-badge')?.textContent==='2 / 7','Favorite toggle must not move current page');
  assert(JSON.parse(localStorage.getItem(keys[0]!)!).includes('beach'),'Favorite did not persist');
  await click('Grid overview');assert(container.querySelectorAll('.coloring-page-cell').length===6,'Grid must show bounded six previews');
  assert(!container.querySelector('.page-utilities'),'Grid must omit utility controls');
  await click('Next coloring page');assert(container.querySelectorAll('.coloring-page-cell').length===1,'Grid next batch');
  await click('View Custom Test');assert(container.querySelector('.page-number-badge')?.textContent==='7 / 7','Grid selection returns to correct single page');
  assert(!opened,'Grid selection must not open editor');
  await click('Delete this custom coloring page');assert(deleted==='picker-custom','Custom delete target');
  await click('Start coloring');assert(opened==='picker-custom','Drawing action must open current page');
  await click('Letters and Numbers');assert(container.querySelector('.page-number-badge')?.textContent==='1 / 1','Learning filter');
  await click('Simple detail (toggle filter)');assert(!!container.querySelector('.page-empty-state'),'Empty filter state');
  const reset=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Show all pages')!;reset.click();await frame();
  await click('Share coloring page');
  const code=container.querySelector<HTMLTextAreaElement>('textarea')!;assert(code.value.startsWith('studioodle-page:2:'),'Share must expose portable code');
  await click('Close page sharing');await click('Add coloring pages');
  const input=container.querySelector<HTMLTextAreaElement>('textarea')!;
  const value=pageSharingCode(makeColoringBook('Imported',[coloringPages[0]!]));
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));await frame();
  const preview=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes('Preview Pages'))!;preview.click();await frame();
  const add=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes('Add Pages'))!;assert(add,'Import preview must expose Add Pages');add.click();await frame();
  assert(added&&added!==coloringPages[0]!.id,'Import must add independent ID');
  assert(workshopRepository.load().pages.some(p=>p.id===added),'Imported page was not stored');
  root.render(null);await frame();await mount();
  assert(container.querySelector('.page-artwork-button')?.getAttribute('aria-label')==='Draw '+coloringPages[1]!.title,'Favorites must come first on reopening');
  return {boundedGrid:true,filtering:true,favorites:true,gridSelection:true,sharing:true,independentImport:true,customDelete:true};
 }finally{root.unmount();container.remove();keys.forEach((key,i)=>{const value=previous[i];if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value!);});}
}
