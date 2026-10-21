import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import type { SavedPicture } from '../../src/editor/savedPicture';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export async function checkPictureStorage(){
 const name='studioodle-storage-test-'+crypto.randomUUID(),repository=createIndexedPictureRepository(name);
 try{
  const ring=Array.from({length:180000},(_,i)=>[16+Math.cos(i/180000*Math.PI*2)*10,12+Math.sin(i/180000*Math.PI*2)*10] as [number,number]);ring.push(ring[0]!);
  const picture:SavedPicture={id:'large',version:5,title:'Large drawing',updatedAt:1,format:'landscape',size:{width:32,height:24},background:'#ffffff',leafColor:0,
   document:{version:5,width:32,height:24,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff,vectorPaint:{version:1,regions:[{id:1,base:0xffffff,blobs:[{color:0x773399,geometry:[[ring]]}]}]}}]}};
  const bytes=JSON.stringify(picture).length;assert(bytes>5*1024*1024,'Storage regression must exceed typical localStorage quota');
  await repository.save(picture);const loaded=await repository.load();
  assert(loaded.length===1&&loaded[0]!.document.surfaces[0]!.vectorPaint!.regions[0]!.blobs[0]!.geometry[0]![0]!.length===ring.length,'Large vector geometry did not round trip');
  picture.title='Replacement';await repository.save(picture);assert((await repository.load())[0]!.title==='Replacement','Saving did not replace the existing drawing');
  await repository.delete(picture.id);assert((await repository.load()).length===0,'Deletion failed');
  return {largeDocumentBytes:bytes,roundtrip:true,replacement:true,deletion:true};
 }finally{await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});}
}
