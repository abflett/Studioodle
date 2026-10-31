import { showGalleryLoading, closeGalleryLoading } from './gallery-loading';
let previousTheme:string|undefined;
export async function showSelectionLayout(theme:'light'|'dark'){
 previousTheme=document.documentElement.dataset.theme;document.documentElement.dataset.theme=theme;
 await showGalleryLoading('landscape','thumbnail',2);
 const screen=[...document.querySelectorAll<HTMLElement>('.selection-screen')].find(e=>e.getBoundingClientRect().width>0)!;
 const box=(selector:string)=>screen.querySelector(selector)!.getBoundingClientRect();
 const blank=box('.choice-blank'),pages=box('.choice-coloring'),controls=box('.selection-preferences'),gallery=box('.previous-section'),actions=box('.library-actions');
 const inside=(b:DOMRect)=>b.left>=-1&&b.top>=-1&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;
 for(const [name,b] of Object.entries({blank,pages,controls,gallery,actions}))if(!inside(b))throw Error(`${name} exceeds viewport: ${JSON.stringify(b)}`);
 if(innerWidth>=innerHeight){
  if(blank.right>pages.left+1||controls.left<innerWidth/2||pages.top<controls.bottom-1||gallery.top<pages.bottom-1)throw Error('Landscape home regions overlap');
  if(gallery.width<innerWidth*.9)throw Error('Landscape gallery needs a full-width lower band');
  for(const button of screen.querySelectorAll<HTMLElement>('.selection-preferences button,.library-actions button')){const b=button.getBoundingClientRect();if(b.width<44||b.height<44)throw Error('Landscape utility controls need a 44px touch target');}
 }
 const serialize=(b:DOMRect)=>({x:b.x,y:b.y,width:b.width,height:b.height});
 return {width:innerWidth,height:innerHeight,theme,blank:serialize(blank),pages:serialize(pages),controls:serialize(controls),gallery:serialize(gallery)};
}
export function closeSelectionLayout(){closeGalleryLoading();if(previousTheme===undefined)delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=previousTheme;}
