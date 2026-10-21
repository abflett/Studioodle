import { useEffect, useState } from 'react';
import { pictureRepository } from '../app/pictures';
import type { SavedPicture } from '../editor/savedPicture';

/** Persistence and carousel selection for saved drawings, independent of page templates. */
export function usePictureLibrary() {
  const [library, setLibrary] = useState<{ pictures: SavedPicture[]; error: boolean }>({ pictures: [], error: false });
  const [sampleIndex, setSampleIndex] = useState(0);
  useEffect(() => {
    let active = true;
    void pictureRepository.load().then(
      pictures => { if (active) setLibrary({ pictures, error: false }); },
      () => { if (active) setLibrary({ pictures: [], error: true }); },
    );
    return () => { active = false; };
  }, []);

  const removePicture = async (picture: SavedPicture) => {
    await pictureRepository.delete(picture.id);
    const pictures = library.pictures.filter(item => item.id !== picture.id);
    setLibrary({ pictures, error: false });
    setSampleIndex(index => Math.max(0, Math.min(index, pictures.length - 1)));
  };
  const restorePicture = async (picture: SavedPicture) => {
    await pictureRepository.save(picture);
    const pictures = await pictureRepository.load();
    setLibrary({ pictures, error: false });
    setSampleIndex(Math.max(0, pictures.findIndex(item => item.id === picture.id)));
  };
  return { library, saved: library.pictures, sampleIndex, setSampleIndex, removePicture, restorePicture };
}
