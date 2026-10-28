import { createIndexedPictureRepository } from '../../src/platform/indexedPictureRepository';
import type { SavedPicture } from '../../src/editor/savedPicture';
import { Artwork } from '../../src/editor/Artwork';
import { pictureRepository as appPictures, pictureSaves } from '../../src/app/pictures';
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export async function checkPictureStorage(){
 const name='studioodle-storage-test-'+crypto.randomUUID(),repository=createIndexedPictureRepository(name);
 try{
  const ring=Array.from({length:180000},(_,i)=>[16+Math.cos(i/180000*Math.PI*2)*10,12+Math.sin(i/180000*Math.PI*2)*10] as [number,number]);ring.push(ring[0]!);
  const picture:SavedPicture={id:'large',version:5,title:'Large drawing',updatedAt:1,format:'landscape',size:{width:32,height:24},background:'#ffffff',leafColor:0,
   document:{version:5,width:32,height:24,surfaces:[{id:'paper',kind:'canvas',x:0,y:0,color:0xffffff,vectorPaint:{version:1,regions:[{id:1,base:0xffffff,blobs:[{color:0x773399,geometry:[[ring]]}]}]}}]}};
  const bytes=JSON.stringify(picture).length;assert(bytes>5*1024*1024,'Storage regression must exceed typical localStorage quota');
  const artwork = Artwork.restore(picture.document);
  const captureStart = performance.now(), checkpoint = artwork.checkpoint(), checkpointCaptureMs = performance.now() - captureStart;
  const anotherCheckpoint = artwork.checkpoint();
  assert(checkpoint.document.surfaces[0]!.vectorPaint!.regions[0]!.blobs[0]!.geometry === anotherCheckpoint.document.surfaces[0]!.vectorPaint!.regions[0]!.blobs[0]!.geometry, 'Save checkpoints must share immutable vertices rather than cloning the drawing during input');
  artwork.dispose();
  const saveStart = performance.now();
  await repository.save(picture);const largeDocumentSaveMs = performance.now() - saveStart;
  const loaded=[(await repository.get(picture.id))!];
  const summaries=await repository.list();assert(summaries.length===1&&!('document' in summaries[0]!), 'Browsing must return summaries only');
  assert(loaded.length===1&&loaded[0]!.document.surfaces[0]!.vectorPaint!.regions[0]!.blobs[0]!.geometry[0]![0]!.length===ring.length,'Large vector geometry did not round trip');
  picture.title='Replacement';await repository.save(picture);assert((await repository.get(picture.id))!.title==='Replacement','Saving did not replace the existing drawing');
  let rejected=false;try{await repository.save({...picture,leafColor:-1});}catch{rejected=true;}
  assert(rejected&&(await repository.get(picture.id))!.title==='Replacement','Invalid replacements must fail before overwriting the valid drawing');
  const originalPut=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='pictures')throw Error('Injected document write failure');return originalPut.apply(this,args);};
  try { rejected=false;try{await repository.save({...picture,title:'Must roll back'});}catch{rejected=true;}assert(rejected,'Injected write must fail'); }
  finally {IDBObjectStore.prototype.put=originalPut;}
  assert((await repository.list())[0]!.title==='Replacement'&&(await repository.get(picture.id))!.title==='Replacement','A failed document write must roll back the summary too');
  IDBObjectStore.prototype.put=function(...args){const request=originalPut.apply(this,args);if(this.name==='pictures')this.transaction.abort();return request;};
  try { rejected=false;try{await repository.save({...picture,title:'Interrupted save'});}catch{rejected=true;}assert(rejected,'Aborted transaction must reject'); }
  finally {IDBObjectStore.prototype.put=originalPut;}
  assert((await repository.list())[0]!.title==='Replacement'&&(await repository.get(picture.id))!.title==='Replacement','Interruption during a write must preserve both previous committed records');
  const pendingPicture = { ...picture, id: 'pending-'+crypto.randomUUID(), title: 'Pending preview' };
  let finishPrepare!: () => void;
  const preparation = new Promise<void>(resolve => { finishPrepare = resolve; });
  const saving = appPictures.save(pendingPicture, async () => { await preparation; return pendingPicture; });
  try {
    assert((await appPictures.get(pendingPicture.id))!.title===pendingPicture.title,'Home must read the pending checkpoint without waiting for disk');
    assert((await appPictures.list()).some(summary=>summary.id===pendingPicture.id),'Home must list a drawing while its first save is pending');
  } finally { finishPrepare(); await saving; await pictureSaves.flush(); await appPictures.delete(pendingPicture.id); }
  const cancel=new AbortController();cancel.abort();
  let aborted=false;try{await repository.get(picture.id,cancel.signal);}catch(error){aborted=error instanceof DOMException&&error.name==='AbortError';}assert(aborted,'Cancelled reads must reject before loading');
  const pendingCancel=new AbortController(),pending=repository.get(picture.id,pendingCancel.signal);pendingCancel.abort();
  aborted=false;try{await pending;}catch(error){aborted=error instanceof DOMException&&error.name==='AbortError';}assert(aborted,'Navigation must cancel a read waiting for its database connection');
  const originalDelete=IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete=function(...args){if(this.name==='pictures')throw Error('Injected document delete failure');return originalDelete.apply(this,args);};
  try { rejected=false;try{await repository.delete(picture.id);}catch{rejected=true;}assert(rejected,'Injected delete must fail'); }
  finally {IDBObjectStore.prototype.delete=originalDelete;}
  assert((await repository.list()).length===1&&await repository.get(picture.id)!==undefined,'A failed document deletion must preserve its summary too');
  await repository.delete(picture.id);assert((await repository.list()).length===0 && await repository.get(picture.id)===undefined,'Deletion failed');
  return {largeDocumentBytes:bytes,largeDocumentSaveMs,checkpointCaptureMs,roundtrip:true,replacement:true,invalidReplacement:true,deletion:true,atomicSummaryWrites:true,interruptedWrite:true,pendingPreview:true,cancellation:true};
 }finally{await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});}
}
