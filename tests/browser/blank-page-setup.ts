import '../../src/ui/styles.css';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BlankPageSetup } from '../../src/ui/BlankPageSetup';
import type { PaperPresetId } from '../../src/editor/paperPresets';
import type { EditorSetup } from '../../src/editor/setup';
import { drawingColors } from '../../src/editor/palette';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export async function checkBlankPageSetup(){
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 let opened:EditorSetup|undefined;
 function Harness(){
  const [step,onStep]=useState<'shape'|'paper'>('shape');
  const [paperPreset,onPreset]=useState<PaperPresetId>('full');
  const [orientation,onOrientation]=useState<'portrait'|'landscape'>('landscape');
  const [background,onBackground]=useState('#f6f2e8');
  return createElement(BlankPageSetup,{step,onStep,paperPreset,onPreset,orientation,onOrientation,background,onBackground,onClose:()=>{},onOpen:setup=>{opened=setup;}});
 }
 root.render(createElement(Harness));
 const click=async(label:string)=>{const b=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.getAttribute('aria-label')===label);assert(b,'Missing '+label);b.click();await frame();};
 try{
  await frame();await frame();
  const choices=container.querySelectorAll<HTMLButtonElement>('.blank-size-choice');assert(choices.length===4,'Four supported paper presets');
  assert(choices[0]!.querySelector('text')?.textContent==='A4','Size marking belongs inside artwork');
  assert(choices[2]!.querySelector('text')?.textContent==='4 \u00d7 6','Photo dimensions must use a multiplication sign');
  assert(getComputedStyle(container.querySelector('.dialog-heading h2')!).width==='1px','Visible heading must be omitted');
  choices[1]!.click();await frame();await click('Tall');
  await click('Next: paper color');
  assert(container.querySelectorAll('.paper-color').length===32,'Blank setup must show complete palette');
  await click(drawingColors[0]!.name);
  assert(container.querySelector('.blank-paper-summary')?.getAttribute('aria-label')?.includes(drawingColors[0]!.name),'Selected color must update paper summary');
  const mark=container.querySelector('.blank-paper-summary text')!;
  assert(getComputedStyle(mark).fill!=='rgb(36, 36, 40)','Dark paper needs contrasting size marking');
  await click('Back to paper shape');
  assert(container.querySelector('[aria-label="Tall"]')?.getAttribute('aria-pressed')==='true','Back navigation must retain orientation');
  container.querySelectorAll<HTMLButtonElement>('.blank-size-choice')[3]!.click();await frame();
  assert([...container.querySelectorAll<HTMLButtonElement>('.blank-orientation-button')].every(b=>b.disabled),'Square must disable orientation');
  container.querySelectorAll<HTMLButtonElement>('.blank-size-choice')[1]!.click();await frame();
  assert(container.querySelector('[aria-label="Tall"]')?.getAttribute('aria-pressed')==='true','Leaving square restores chosen orientation');
  await click('Paper color');
  assert(container.querySelector('[aria-pressed="true"].paper-color')?.getAttribute('aria-label')===drawingColors[0]!.name,'Step navigation must preserve color');
  await click('Start drawing');
  assert(opened?.format==='portrait'&&opened.size?.width===559&&opened.size.height===794,'Start must use selected A5 physical dimensions');
  assert(opened?.background==='#242428','Start must use selected background');
  return {paperMarks:true,stepNavigation:true,fullPalette:true,selectionRetention:true,squareOrientation:true,physicalDimensions:true,summaryContrast:true};
 }finally{root.unmount();container.remove();}
}
