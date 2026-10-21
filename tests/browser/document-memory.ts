import { createAdvancedSceneFixture } from './advanced-scene-fixture';
import type { CanvasViewport } from '../../src/canvas/CanvasViewport';
import { CanvasEditor } from '../../src/canvas/CanvasEditor';
import { createEditorBridge } from '../../src/editor/bridge';
import { prepareStickers,releaseStickerDefinitions } from '../../src/editor/vectorStickers';
import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import type { Artwork } from '../../src/editor/Artwork';
import type { EditorSession } from '../../src/editor/EditorSession';
import type { VectorDefinition } from '../../src/editor/vectorDefinition';
const repository=createIndexedPictureRepository('studioodle-memory-diagnostic');
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
let editor:CanvasEditor|undefined,host:HTMLDivElement|undefined;
const sessionRefs:WeakRef<EditorSession>[]=[],artRefs:WeakRef<Artwork>[]=[];
let weakCanvases:WeakRef<HTMLCanvasElement>[]=[];
const create=document.createElement;
export async function prepareMemoryFixture(){
 const {picture,metrics}=await createAdvancedSceneFixture();await repository.save(picture);releaseStickerDefinitions();return metrics;
}
function state(){
 const session=Reflect.get(editor!,'session') as EditorSession;
 const surfaces=Reflect.get(session.artwork,'surfaces') as {data:{kind:string};vector:VectorDefinition}[];
 const byKind=new Map<string,Set<VectorDefinition>>();
 for(const surface of surfaces)if(surface.data.kind!=='canvas'){
  const set=byKind.get(surface.data.kind)??new Set();set.add(surface.vector);byKind.set(surface.data.kind,set);
 }
 const definitions=[...byKind.values()].flatMap(set=>[...set]);
 return {surfaces:surfaces.length,uniqueKinds:byKind.size,definitionObjects:definitions.length,duplicateDefinitions:definitions.length-byKind.size,
  uniqueLookupBytes:definitions.reduce((n,d)=>n+d.typedArrayBytes,0)};
}
export async function openMemoryCycle(probe=false){
 const picture=(await repository.load())[0]!;
 if(probe){
  const paper=picture.document.surfaces[0]!;
  picture.document.surfaces=[paper,...['space-crater','winter-snow','interiors-great-hall','interiors-arched-hallway','horizons-harbor-skyline','space-crater'].map((kind,i)=>({id:'probe-'+i,kind:kind as 'space-crater'|'winter-snow'|'interiors-great-hall'|'interiors-arched-hallway'|'horizons-harbor-skyline',color:0x242428,x:350+i*400,y:600,scale:.4}))];
 }
 weakCanvases=[];
 Object.defineProperty(document,'createElement',{configurable:true,value:function(this:Document,...args:unknown[]){const value=Reflect.apply(create,this,args);if(args[0]==='canvas')weakCanvases.push(new WeakRef(value));return value;}});
 await prepareStickers(picture.document.surfaces.map(s=>s.kind));
 host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'0',top:'0',width:'900px',height:'640px'});document.body.append(host);
 const bridge=createEditorBridge();editor=new CanvasEditor(host,bridge,picture,p=>repository.save(p));
 const session=Reflect.get(editor,'session') as EditorSession;sessionRefs.push(new WeakRef(session));artRefs.push(new WeakRef(session.artwork));
 bridge.send({type:'set-tool',tool:'brush'});bridge.send({type:'set-brush',options:{kind:'ink',size:9,shape:'round'}});
 for(let stroke=0;stroke<5;stroke++){
  bridge.send({type:'set-color',color:[0x886699,0x448899,0xddaa66][stroke%3]!});
  const point={x:400,y:400+stroke*20};session.begin(point,1,0);
  for(let i=1;i<=24;i++)session.move({x:400+i*6,y:400+stroke*20+Math.sin(i*.3)*35},1,true,1);
  session.release({x:550,y:point.y},1,1);(Reflect.get(editor,'viewport') as CanvasViewport).render(session.artwork,session.state);await pause(25);
 }
 await session.artwork.compactPaint();await pause(50);(Reflect.get(editor,'viewport') as CanvasViewport).render(session.artwork,session.state);await pause(50);
 return state();
}
export async function closeMemoryCycle(save=true){
 const session=Reflect.get(editor!,'session') as EditorSession;
 if(save)await new Promise<void>((resolve,reject)=>session.execute({type:'save',onComplete:ok=>ok?resolve():reject(Error('Lifecycle save failed'))}));
 editor!.destroy();editor=undefined;host!.remove();host=undefined;Reflect.deleteProperty(document,'createElement');
 // Let accepted worker replies and historical checkpoint jobs finish before measuring retained memory.
 await pause(250);
}
export function memoryResources(){
 const canvases=weakCanvases.flatMap(ref=>{const value=ref.deref();return value?[value]:[];});
 return {retainedSessions:sessionRefs.filter(ref=>ref.deref()).length,retainedArtwork:artRefs.filter(ref=>ref.deref()).length,
  liveCanvases:canvases.length,canvasPixelBytes:canvases.reduce((n,c)=>n+c.width*c.height*4,0)};
}
export async function cleanupMemoryFixture(){await repository.delete('advanced-scene-profile');}
