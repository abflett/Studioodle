import { useState } from 'react';
import type { Ref } from 'react';
import { Check, Pencil } from 'lucide-react';
import { fixedPalettes, colorSlot, slotColor } from '../editor/colorPalettes';
import type { CustomColors } from '../editor/colorPalettes';
import { drawingColors } from '../editor/palette';
import { DialogHeader } from './DialogHeader';
import { CustomColorPicker } from './CustomColorPicker';
const hex=(value:number)=>'#'+value.toString(16).padStart(6,'0');
export function PalettePicker({ color, custom, onChoose, onEdit, onClose, headingRef, id='art-picker-title', label='Choose a color' }: {
  color:number; custom:CustomColors; onChoose:(color:number)=>void; onEdit:(index:number,color:number)=>void; onClose:()=>void; headingRef?:Ref<HTMLHeadingElement>; id?:string; label?:string;
}) {
  const [tab,setTab]=useState(()=>color<0?Math.floor(colorSlot(color)/32):0), [editing,setEditing]=useState(false), [picking,setPicking]=useState<number>();
  const palettes=[...fixedPalettes,{name:'Custom',colors:custom,dots:custom.filter(color=>color!==null).slice(0,3)}];
  const palette=palettes[tab]!;
  return <div className="palette-picker">
    <DialogHeader id={id} title={label} headingRef={headingRef} onClose={onClose} closeLabel="Close picker">
      <div className="color-palette-well" role="group" aria-label="Color palettes">{palettes.map((p,index)=><button type="button" key={p.name} className="color-palette-tab" aria-label={`${p.name} palette`} title={p.name} aria-pressed={tab===index} onClick={()=>{setTab(index);setEditing(false);}}><svg viewBox="0 0 40 40" aria-hidden="true">{[[13,15],[27,15],[20,27]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="8" fill={p.dots[i]===null||p.dots[i]===undefined?'none':hex(p.dots[i]!)} stroke={p.dots[i]===null||p.dots[i]===undefined?'currentColor':'none'} strokeWidth="1.4"/>)}</svg></button>)}</div>
    </DialogHeader>
    <div className={`palette-swatch-grid${editing?' is-editing':''}`} role="group" aria-label={`${palette.name} colors`}>{palette.colors.map((rgb,index)=>{
      const name=rgb===null?`Set custom color ${index+1}`:tab===0?drawingColors[index]!.name:`${palette.name} color ${index+1}, ${hex(rgb)}`;
      const reference=slotColor(tab*32+index);
      return <button type="button" key={index} className={`palette-swatch${rgb===null?' is-empty':''}`} style={rgb===null?undefined:{backgroundColor:hex(rgb)}} aria-label={name} title={name} aria-pressed={rgb!==null&&color===reference} onClick={event=>{
        event.currentTarget.focus();
        if(tab===4&&(editing||rgb===null))setPicking(index);else onChoose(reference);
      }}>{rgb!==null&&color===reference&&<Check aria-hidden="true"/>}</button>;
    })}</div>
    <footer className="color-palette-footer">{tab===4&&<button type="button" className="icon-button custom-palette-edit" aria-pressed={editing} aria-label={editing?'Finish editing custom palette':'Edit custom palette'} title={editing?'Finish editing custom palette':'Edit custom palette'} onClick={()=>setEditing(!editing)}>{editing?<Check aria-hidden="true"/>:<Pencil aria-hidden="true"/>}</button>}</footer>
    {picking!==undefined&&<CustomColorPicker color={custom[picking]??null} onClose={()=>setPicking(undefined)} onApply={rgb=>{onEdit(picking,rgb);setPicking(undefined);if(!editing)onChoose(slotColor(128+picking));}}/>}
  </div>;
}
