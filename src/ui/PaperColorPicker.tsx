import { useLayoutEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { drawingColors } from '../editor/palette';

/** Paper backgrounds are literal RGB, independent of a drawing's linked palette. */
export function PaperColorPicker({ color, onChoose }: { color: number; onChoose: (color: number) => void }) {
  const host=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const element=host.current;
    if(!element)return;
    const fit=()=>{
      const style=getComputedStyle(element),width=element.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=element.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
      if(width<=0||height<=0)return;
      const gap=Math.max(6,Math.min(12,Math.floor(Math.min(width,height)/30))),preferred=width<400?4:8;
      // Keep the familiar four landscape rows / eight portrait rows. Only
      // change columns when the available area would make those targets tiny.
      let best={columns:preferred,size:0};
      for(const columns of [preferred,...[4,6,8,10,12,16].filter(value=>value!==preferred)]){
        const rows=Math.ceil(drawingColors.length/columns),size=Math.floor(Math.min(60,(width-gap*(columns-1))/columns,(height-gap*(rows-1))/rows));
        if(size>best.size)best={columns,size};
        if(size>=32){best={columns,size};break;}
      }
      element.style.setProperty('--paper-color-columns',String(best.columns));
      element.style.setProperty('--paper-color-size',`${Math.max(1,best.size)}px`);
      element.style.setProperty('--paper-color-gap',`${gap}px`);
    };
    fit();const observer=new ResizeObserver(fit);observer.observe(element);return()=>observer.disconnect();
  },[]);
  return <div ref={host} className="color-picker"><div className="art-colors" role="group" aria-label="Canvas background colors">
    {drawingColors.map(item => <button type="button" className="paper-color" key={item.name} aria-label={item.name} title={item.name} aria-pressed={color === item.value} style={{ backgroundColor: `#${item.value.toString(16).padStart(6, '0')}` }} onClick={() => onChoose(item.value)}>
      {color === item.value && <Check className="color-check" aria-hidden="true" />}
    </button>)}
  </div></div>;
}
