import { Artwork } from '../../src/editor/Artwork';
import { EditorSession } from '../../src/editor/EditorSession';
import { slotColor, resolveColor } from '../../src/editor/colorPalettes';
import { pictureSvg } from '../../src/editor/pictureSvg';
import { coloringBookPage, makeColoringBook } from '../../src/editor/coloringBook';
import { pageSharingCode, parsePageSharingCode } from '../../src/editor/pageSharing';
import type { SavedPicture } from '../../src/editor/savedPicture';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export async function checkPaletteColors(){
  const art=Artwork.create(100,100,'#ffffff');
  art.setCustomColor(0,0x3366cc);art.setCustomColor(1,0x3366cc);
  for(const [slot,y] of [[128,25],[129,75]] as const)art.brush({x:20,y},{x:80,y},slotColor(slot),false,{size:16,tip:'round'});
  for(let i=0;i<25;i++)art.brush({x:20,y:25},{x:80,y:25},slotColor(128),false,{size:16,tip:'round'});
  await art.compactPaint();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=100;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  const pixel=(y:number)=>{const p=ctx.getImageData(50,y,1,1).data;return(p[0]!<<16)|(p[1]!<<8)|p[2]!;};
  art.render(ctx,false,true);assert(pixel(25)===0x3366cc&&pixel(75)===0x3366cc,'Both slots render the same initial RGB');
  art.beginChange();art.setCustomColor(0,0x33aa66);const edit=art.endChange();
  art.render(ctx,false,true);assert(pixel(25)===0x33aa66&&pixel(75)===0x3366cc,'Palette edits update cached paint independently by slot');
  const picture:SavedPicture={id:'palette-pixels',title:'Palette pixels',version:6,updatedAt:1,format:'square',size:{width:100,height:100},background:'#ffffff',leafColor:0,document:art.serialize()};
  const svg=await pictureSvg(picture), serialized=new XMLSerializer().serializeToString(svg);
  assert(serialized.includes('#33aa66')&&serialized.includes('#3366cc'),'SVG resolves custom slots to RGB');
  const image=new Image();image.src=URL.createObjectURL(new Blob([serialized],{type:'image/svg+xml'}));await image.decode();
  ctx.clearRect(0,0,100,100);ctx.drawImage(image,0,0,100,100);URL.revokeObjectURL(image.src);
  assert(pixel(25)===0x33aa66&&pixel(75)===0x3366cc,'Vector export pixels match the canvas');
  art.undoChange(edit);art.render(ctx);assert(pixel(25)===0x3366cc,'Undo recolors existing paint');
  const restored=Artwork.restore(picture.document);restored.render(ctx);assert(pixel(25)===0x33aa66&&pixel(75)===0x3366cc,'Reload preserves drawing-owned custom colors');
  restored.dispose();art.dispose();
  const session=new EditorSession({...picture,id:'palette-session-browser'},{save:()=>{},changed:()=>{}});
  session.execute({type:'set-custom-color',index:2,color:0xaabbcc});session.execute({type:'set-tool',tool:'bucket'});session.execute({type:'set-color',color:slotColor(130)});
  session.execute({type:'fill-at',point:{x:5,y:5}});
  await new Promise<void>(resolve=>session.execute({type:'snapshot',onComplete:()=>resolve()}));
  session.execute({type:'set-custom-color',index:2,color:0xcc8844});session.artwork.render(ctx);
  assert(resolveColor(slotColor(130),session.customColors)===0xcc8844,'Custom fill uses the same live palette');session.dispose();
  // Portable sticker-only pages must carry the custom ink table, but no paint.
  const custom=Array<number|null>(32).fill(null);custom[0]=0x3366cc;
  const page=coloringBookPage({...picture,document:{...picture.document,customColors:custom,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff},{id:'shape',kind:'circle',x:50,y:50,color:slotColor(128),scale:.2}]}},'palette-page');
  const code=pageSharingCode(makeColoringBook('Custom ink',[page]));
  const shared=parsePageSharingCode(code).pages[0]!;
  assert(shared.document.customColors![0]===0x3366cc&&shared.document.surfaces[1]!.color===slotColor(128),'Sharing preserves slot identity and custom ink');
  assert(!shared.document.surfaces.some(s=>s.vectorPaint),'Shared pages never include paint');
  return {slotIdentity:true,liveRecolor:true,cachedPaint:true,undo:true,reload:true,svgPixels:true,portableCustomInk:true};
}
