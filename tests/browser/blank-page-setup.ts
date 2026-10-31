import '../../src/ui/styles.css';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BlankPageSetup } from '../../src/ui/BlankPageSetup';
import type { PaperPresetId, PaperOrientation } from '../../src/editor/paperPresets';
import type { EditorSetup } from '../../src/editor/setup';
import { drawingColors } from '../../src/editor/palette';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function mountSetup(initialStep:'shape'|'paper'='shape',initialOrientation:PaperOrientation='landscape'){
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 let opened:EditorSetup|undefined;
 function Harness(){
  const [step,onStep]=useState<'shape'|'paper'>(initialStep);
  const [paperPreset,onPreset]=useState<PaperPresetId>('display');
  const [orientation,onOrientation]=useState<PaperOrientation>(initialOrientation);
  const [background,onBackground]=useState('#ffffff');
  return createElement(BlankPageSetup,{displaySize:{width:1920,height:1080},step,onStep,paperPreset,onPreset,orientation,onOrientation,background,onBackground,onClose:()=>{},onOpen:setup=>{opened=setup;}});
 }
 root.render(createElement(Harness));
 return {container,getOpened:()=>opened,cleanup:()=>{root.unmount();container.remove();}};
}
export async function checkBlankPageSetup(){
 const {container,getOpened,cleanup}=mountSetup();
 const click=async(label:string)=>{const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.getAttribute('aria-label')===label);assert(b,'Missing '+label);b.click();await frame();};
 try{
  await frame();await frame();
  const choices=container.querySelectorAll<HTMLButtonElement>('.blank-size-choice');assert(choices.length===4,'Four supported paper presets');
  assert(choices[0]!.querySelector('text')?.textContent==='16:9','Size marking belongs inside artwork');
  assert(choices[3]!.querySelector('text')?.textContent==='4 \u00d7 6','Photo dimensions must use a multiplication sign');
  assert(getComputedStyle(container.querySelector('.dialog-heading h2')!).width==='1px','Visible heading must be omitted');
  choices[2]!.click();await frame();await click('Tall');
  await click('Next: paper color');
  assert(container.querySelectorAll('.paper-color').length===32,'Blank setup must show complete palette');
  await click(drawingColors[0]!.name);
  assert(container.querySelector('.blank-paper-summary')?.getAttribute('aria-label')?.includes(drawingColors[0]!.name),'Selected color must update paper summary');
  const mark=container.querySelector('.blank-paper-summary text')!;
  assert(getComputedStyle(mark).fill!=='rgb(0, 0, 0)','Dark paper needs contrasting size marking');
  await click('Back to paper shape');
  assert(container.querySelector('[aria-label="Tall"]')?.getAttribute('aria-pressed')==='true','Back navigation must retain orientation');
  await click('Square');
  assert(container.querySelector('[aria-label="Square"]')?.getAttribute('aria-pressed')==='true','Square is an orientation');
  assert(container.querySelectorAll('.blank-size-choice').length===1,'Square has one ratio choice');
  await click('Square, 1:1');
  assert(container.querySelector('.blank-size-choice text')?.textContent==='1:1','Square label uses 1:1');
  await click('Next: paper color');
  assert(container.querySelector('.blank-paper-summary')?.getAttribute('aria-label')?.startsWith('1:1,'),'Square summary must not use paper standards');
  await click('Start drawing');
  assert(getOpened()?.size?.width===1000&&getOpened()?.size?.height===1000&&getOpened()?.printSizeMm?.width===210&&getOpened()?.printSizeMm?.height===210,'Square has independent logical and print dimensions');
  await click('Back to paper shape');await click('Tall');
  assert(container.querySelectorAll('.blank-size-choice').length===4&&container.querySelectorAll('.blank-size-choice')[2]?.getAttribute('aria-pressed')==='true','Returning to Tall restores the selected A5 preset');
  await click('Paper color');
  assert(container.querySelector('[aria-pressed="true"].paper-color')?.getAttribute('aria-label')===drawingColors[0]!.name,'Step navigation must preserve color');
  await click('Start drawing');
  const opened=getOpened();
  assert(opened?.format==='portrait'&&opened.size?.width===1000&&opened.size.height===1419&&opened.printSizeMm?.width===148&&opened.printSizeMm.height===210,'Start must use selected A5 physical dimensions');
  assert(opened?.background==='#000000','Start must use selected background');
  return {paperMarks:true,stepNavigation:true,fullPalette:true,selectionRetention:true,squareOrientation:true,physicalDimensions:true,summaryContrast:true};
 }finally{cleanup();}
}

let closeLayout: (()=>void)|undefined;
export async function showBlankSetupLayout(step:'shape'|'paper',orientation:PaperOrientation){
 closeLayout?.();const {container,cleanup}=mountSetup(step,orientation);closeLayout=cleanup;
 for(let i=0;i<5;i++)await frame();
 const dialog=container.querySelector<HTMLDialogElement>('dialog')!,content=container.querySelector<HTMLElement>('.blank-setup-content')!,footer=container.querySelector<HTMLElement>('footer')!;
 for(const element of [dialog,container.querySelector<HTMLElement>('.blank-setup-body')!,content])assert(element.scrollHeight<=element.clientHeight+1&&element.scrollWidth<=element.clientWidth+1,'Blank setup must fit without scrolling: '+JSON.stringify({step,orientation,class:element.className,w:element.clientWidth,sw:element.scrollWidth,h:element.clientHeight,sh:element.scrollHeight}));
 if(innerWidth<=600||innerHeight<=540){const bounds=dialog.getBoundingClientRect(),style=getComputedStyle(dialog);assert(bounds.x===0&&bounds.y===0&&bounds.width===innerWidth&&bounds.height===innerHeight&&style.borderRadius==='0px','Small-screen overlays must fill the viewport');}
 const within=(element:Element,parent:Element)=>{const a=element.getBoundingClientRect(),b=parent.getBoundingClientRect();return a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;};
 for(const element of container.querySelectorAll('.blank-size-choice,.paper-color'))assert(within(element,content),'Every paper/color choice must remain visible');
 for(const element of footer.querySelectorAll('button'))assert(within(element,footer)&&within(element,dialog),'Footer controls must stay visible');
 if(step==='shape'){
  assert(footer.contains(container.querySelector('.blank-orientations')),'Orientation belongs in the fixed footer');
  const next=footer.querySelector('.go-button')!.getBoundingClientRect(),group=footer.querySelector('.blank-orientations')!.getBoundingClientRect();assert(group.right<=next.left-4,'Orientation and Next must not overlap');
  for(const art of container.querySelectorAll('.blank-size-choice .blank-paper-art'))assert(within(art,art.closest('.blank-size-choice')!),'Paper artwork must shrink inside its card');
 }else assert(container.querySelectorAll('.paper-color').length===32,'All background colors stay available');
 const palette=container.querySelector<HTMLElement>('.art-colors');
 return {width:innerWidth,height:innerHeight,step,orientation,columns:palette?Number(getComputedStyle(palette.parentElement!).getPropertyValue('--paper-color-columns')):undefined,swatch:palette?.querySelector('button')?.getBoundingClientRect().width};
}
export function closeBlankSetupLayout(){closeLayout?.();closeLayout=undefined;}
