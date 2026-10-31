import { Artwork } from '../../src/editor/Artwork';
import { EditorSession } from '../../src/editor/EditorSession';
import { pictureSvg } from '../../src/editor/pictureSvg';
import { renderPicture } from '../../src/editor/renderPicture';
import { svgPrintSize } from '../../src/editor/exportResolution';
import { pictureFile, printPicture } from '../../src/app/pictureOutput';
import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import type { SavedPicture } from '../../src/editor/savedPicture';
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
export async function checkNormalizedPageOutput(){
 const artwork=Artwork.create(1000,1414,'#eefaff');
 const picture:SavedPicture={id:'normalized-output',title:'A4 normalized',version:6,updatedAt:1,format:'portrait',size:{width:1000,height:1414},printSizeMm:{width:210,height:297},background:'#eefaff',leafColor:0,document:artwork.serialize()};artwork.dispose();
 const session=new EditorSession(picture,{save(){},changed(){}});
 let snapshot:SavedPicture|undefined;session.execute({type:'snapshot',onComplete:value=>{snapshot=value;}});session.dispose();
 assert(snapshot?.printSizeMm?.width===210,'Session checkpoint retains physical size');
 const store=createIndexedPictureRepository('studioodle-normalized-output-test');await store.save(snapshot!);
 try{const restored=await store.get(picture.id);assert(restored?.printSizeMm?.height===297,'Storage retains physical size');assert((await store.getSummary(picture.id))?.printSizeMm?.width===210,'Metadata retains physical size');}finally{await store.delete(picture.id);}
 const svg=await pictureSvg(picture),size=svgPrintSize(svg);
 assert(svg.getAttribute('viewBox')==='0 0 1000 1414','SVG retains normalized coordinates');
 assert(svg.getAttribute('width')==='210mm'&&Math.abs(size.height*25.4-297)<.001,'SVG supplies A4 physical dimensions');
 const raster=await renderPicture(picture);
 try{assert(raster.width===2481&&raster.height===3508,'Default raster output is A4 at 300 DPI');}finally{raster.width=raster.height=1;}
 const pdf=await pictureFile(picture,'pdf');const box=/\/MediaBox\s*\[([^\]]+)\]/.exec(await pdf.text())?.[1]?.trim().split(/\s+/).map(Number);
 assert(box&&Math.abs(box[2]!-210/25.4*72)<.01&&Math.abs(box[3]!-297/25.4*72)<.01,'PDF uses physical A4, not 1000-unit page inches');
 const open=window.open,preview=document.implementation.createHTMLDocument();let printed=false;
 window.open=(()=>({document:preview,closed:false,opener:null,focus(){},close(){},print(){printed=true;},requestAnimationFrame(callback:FrameRequestCallback){callback(performance.now());return 0;}})) as typeof window.open;
 try{printPicture(picture,()=>{throw Error('Print failed');});for(let i=0;i<100&&!printed;i++)await new Promise(r=>setTimeout(r,10));assert(printed,'Print preview completes');const css=[...preview.querySelectorAll('style')].map(node=>node.textContent).join('');assert(css.includes(`size:${size.width}in ${size.height}in`),'Browser print uses physical dimensions');}finally{window.open=open;}
 return {normalizedSave:true,physicalSvg:true,png300:true,physicalPdf:true,physicalPrint:true};
}
