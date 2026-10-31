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
  if(gallery.width<box('.selection').width-1)throw Error('Landscape gallery needs the full composition width');
  const stack=box('.portfolio-stack'),bookWidth=Math.min(pages.width,pages.height*1.5)*1.04;
  if(bookWidth<stack.width*.9||bookWidth>stack.width*1.3)throw Error('Book and gallery need comparable visual widths');
  const center=(b:DOMRect)=>({x:b.x+b.width/2,y:b.y+b.height/2}),a=center(blank),b=center(pages),c=center(stack);
  const edges=[Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(a.x-c.x,a.y-c.y),Math.hypot(b.x-c.x,b.y-c.y)];
  if(Math.max(...edges)/Math.min(...edges)>1.65)throw Error('Selection centers should form a balanced triangle');
  if(innerWidth>=1280&&(blank.top<32||box('.selection').left<64))throw Error('Large displays need top and side breathing room');
  for(const button of screen.querySelectorAll<HTMLElement>('.selection-preferences button,.library-actions button')){const b=button.getBoundingClientRect();if(b.width<44||b.height<44)throw Error('Landscape utility controls need a 44px touch target');}
 }
 const serialize=(b:DOMRect)=>({x:b.x,y:b.y,width:b.width,height:b.height});
 return {width:innerWidth,height:innerHeight,theme,blank:serialize(blank),pages:serialize(pages),controls:serialize(controls),gallery:serialize(gallery)};
}
export function closeSelectionLayout(){closeGalleryLoading();if(previousTheme===undefined)delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=previousTheme;}
