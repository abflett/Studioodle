import type { SavedPicture } from '../editor/savedPicture';
import { isSavedPicture } from '../editor/pictureValidation';
import { formatPictureTitle } from '../editor/pictureTitles';

/** Structured vector documents belong in IndexedDB, not the small settings quota. */
export function createIndexedPictureRepository(name='studioodle-pictures-v5') {
  const transact=<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{
    const opening=indexedDB.open(name,1);let blocked=false;
    opening.onupgradeneeded=()=>opening.result.createObjectStore('pictures',{keyPath:'id'});
    opening.onerror=()=>reject(opening.error);
    opening.onblocked=()=>{blocked=true;reject(new Error('Picture database upgrade is blocked by another window.'));};
    opening.onsuccess=()=>{
      const db=opening.result;if(blocked){db.close();return;}
      db.onversionchange=()=>db.close();
      try{
        const tx=db.transaction('pictures',mode),request=operation(tx.objectStore('pictures'));
        tx.oncomplete=()=>{db.close();resolve(request.result);};
        tx.onabort=()=>{db.close();reject(tx.error??request.error??new Error('Picture storage transaction failed.'));};
        tx.onerror=()=>{}; // Abort reports the failed transaction once.
      }catch(error){db.close();reject(error);}
    };
  });
  return {
    async save(picture:SavedPicture){await transact('readwrite',store=>store.put(picture));},
    async delete(id:string){await transact('readwrite',store=>store.delete(id));},
    async load():Promise<SavedPicture[]>{
      const records:unknown[]=await transact('readonly',store=>store.getAll());
      return records.filter(isSavedPicture).map(p=>({...p,title:formatPictureTitle(p.title)})).sort((a,b)=>b.updatedAt-a.updatedAt);
    },
  };
}
