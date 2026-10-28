import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Check } from 'lucide-react';
import { DialogHeader } from './DialogHeader';
import { closeOnBackdrop } from './dialog';

type Hsv = [number, number, number];
function rgb([h,s,v]: Hsv) {
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  const channels=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return channels.reduce((color,n)=>(color<<8)|Math.round((n+m)*255),0);
}
function hsv(color: number): Hsv {
  const [r,g,b]=[16,8,0].map(shift=>(color>>shift&255)/255) as [number,number,number];
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  const h=!d?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return [(h*60+360)%360,max?d/max:0,max];
}
const hex=(color:number)=>'#'+color.toString(16).padStart(6,'0').toUpperCase();
export function CustomColorPicker({ color, onApply, onClose }: { color: number | null; onApply: (color:number)=>void; onClose: ()=>void }) {
  const dialog=useRef<HTMLDialogElement>(null), heading=useRef<HTMLHeadingElement>(null);
  const [value,setValue]=useState<Hsv>(()=>hsv(color??0xa78fc7));
  const current=rgb(value), [draft,setDraft]=useState(hex(current)), valid=/^#[0-9a-f]{6}$/i.test(draft);
  const update=(next:Hsv)=>{setValue(next);setDraft(hex(rgb(next)));};
  useEffect(()=>{
    const element=dialog.current!, previous=document.activeElement;
    element.showModal();heading.current?.focus();
    return ()=>{element.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const pointer=(event:PointerEvent<HTMLDivElement>)=>{
    if(event.type==='pointerdown')event.currentTarget.setPointerCapture(event.pointerId);
    if(event.type==='pointermove'&&!event.buttons)return;
    const r=event.currentTarget.getBoundingClientRect();
    update([value[0],Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),1-Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))]);
  };
  return <dialog ref={dialog} className="setup-dialog palette-custom-dialog" aria-labelledby="custom-color-title" onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}} onClick={event=>closeOnBackdrop(event,onClose)}>
    <div className="custom-color-content">
      <DialogHeader id="custom-color-title" title="Choose custom color" headingRef={heading} onClose={onClose} closeLabel="Cancel color change">
        <div className="custom-color-comparison" aria-label="Previous and new color"><span style={{background:color===null?'transparent':hex(color)}}/><span style={{background:hex(current)}}/></div>
      </DialogHeader>
      <div className="custom-sv-field" style={{background:`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl(${value[0]} 100% 50%)`}} role="group" tabIndex={0} aria-label="Saturation and brightness. Use left and right for saturation, up and down for brightness" onPointerDown={pointer} onPointerMove={pointer} onKeyDown={event=>{
        const [h,s,v]=value;
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
          event.preventDefault();update([h,Math.max(0,Math.min(1,s+(event.key==='ArrowRight'?.01:event.key==='ArrowLeft'?-.01:0))),Math.max(0,Math.min(1,v+(event.key==='ArrowUp'?.01:event.key==='ArrowDown'?-.01:0)))]);
        }
      }}><span className="custom-sv-cursor" style={{left:`${value[1]*100}%`,top:`${(1-value[2])*100}%`,background:hex(current)}}/></div>
      <input type="range" min="0" max="359" step="1" value={value[0]} className="custom-hue-slider" aria-label="Hue" onChange={event=>update([Number(event.target.value),value[1],value[2]])}/>
      <footer className="custom-color-footer"><input className="custom-hex-field" value={draft} maxLength={7} spellCheck={false} autoComplete="off" aria-label="Hex color" aria-invalid={!valid} title="Hex color: copy or paste #RRGGBB" onChange={event=>{const text=event.target.value;setDraft(text);if(/^#[0-9a-f]{6}$/i.test(text))setValue(hsv(parseInt(text.slice(1),16)));}}/>
        <button type="button" className="go-button custom-color-apply" aria-label="Apply custom color" title="Apply custom color" disabled={!valid} onClick={()=>onApply(current)}><Check aria-hidden="true"/></button></footer>
    </div>
  </dialog>;
}
