import { useEffect, useState } from 'react';
import { validDisplaySize } from '../editor/paperPresets';
import type { PageSize } from '../editor/paperPresets';

export function readDisplaySize(source: Pick<Window,'innerWidth'|'innerHeight'> & {screen?:PageSize} = window):PageSize {
  const screen={width:source.screen?.width ?? 0,height:source.screen?.height ?? 0};
  if(validDisplaySize(screen))return screen;
  const viewport={width:source.innerWidth,height:source.innerHeight};
  return validDisplaySize(viewport)?viewport:{width:4,height:3};
}
export function useDisplayPage(){
  const [display,setDisplay]=useState(readDisplaySize);
  useEffect(()=>{
    const update=()=>{const next=readDisplaySize();setDisplay(previous=>previous.width===next.width&&previous.height===next.height?previous:next);};
    window.addEventListener('resize',update);window.screen.orientation?.addEventListener('change',update);
    return()=>{window.removeEventListener('resize',update);window.screen.orientation?.removeEventListener('change',update);};
  },[]);
  return display;
}
