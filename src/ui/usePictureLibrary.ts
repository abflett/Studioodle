import type { SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { pictureRepository } from '../app/pictures';
import type { SavedPicture } from '../editor/savedPicture';

/** Persistence and carousel selection for saved drawings, independent of page templates. */
export function usePictureLibrary() {
  const [library, setLibrary] = useState<{ pictures: SavedPicture[]; error: boolean; index: number }>({ pictures: [], error: false, index: 0 });
  const setSampleIndex = (value: SetStateAction<number>) => setLibrary(previous => ({ ...previous, index: typeof value === 'function' ? value(previous.index) : value }));
  useEffect(() => {
    let active = true;
    void pictureRepository.load().then(
      pictures => { if (active) setLibrary({ pictures, error: false, index: 0 }); },
      () => { if (active) setLibrary({ pictures: [], error: true, index: 0 }); },
    );
    return () => { active = false; };
  }, []);

  const removePicture = async (picture: SavedPicture) => {
    await pictureRepository.delete(picture.id);
    // Resolve against the latest state: two completed deletes must not restore
    // each other's records or leave selection beyond the remaining library.
    setLibrary(previous => {
      const pictures = previous.pictures.filter(item => item.id !== picture.id);
      return { pictures, error: false, index: Math.max(0, Math.min(previous.index, pictures.length - 1)) };
    });
  };
  const restorePicture = async (picture: SavedPicture) => {
    await pictureRepository.save(picture);
    const pictures = await pictureRepository.load();
    setLibrary({ pictures, error: false, index: Math.max(0, pictures.findIndex(item => item.id === picture.id)) });
  };
  return { library, saved: library.pictures, sampleIndex: library.index, setSampleIndex, removePicture, restorePicture };
}
