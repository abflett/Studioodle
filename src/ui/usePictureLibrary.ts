import type { SetStateAction } from 'react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { pictureRepository } from '../app/pictures';
import { PictureWindow } from '../app/pictureWindow';
import type { SavedPicture } from '../editor/savedPicture';
import type { PictureSummary } from '../editor/pictureSummary';

export function usePictureLibrary() {
  const [library, setLibrary] = useState<{ pictures: PictureSummary[]; error: boolean; loading: boolean; index: number }>({ pictures: [], error: false, loading: true, index: 0 });
  const [window] = useState(() => new PictureWindow((id, signal) => pictureRepository.get(id, signal)));
  const loaded = useSyncExternalStore(window.subscribe, window.getSnapshot);
  const [refresh, setRefresh] = useState(0);
  const setSampleIndex = (value: SetStateAction<number>) => setLibrary(previous => ({ ...previous, index: typeof value === 'function' ? value(previous.index) : value }));
  useEffect(() => {
    let active = true;
    void pictureRepository.list().then(
      pictures => { if (active) setLibrary(previous => ({ pictures, error: false, loading: false, index: Math.max(0, pictures.findIndex(picture => picture.id === previous.pictures[previous.index]?.id)) })); },
      () => { if (active) setLibrary(previous => ({ ...previous, error: true, loading: false })); },
    );
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => { window.select(library.pictures, library.index); }, [window, library.pictures, library.index, refresh]);
  useEffect(() => () => window.dispose(), [window]);
  const summary = library.pictures[library.index];
  const matches = loaded.id === summary?.id && loaded.updatedAt === summary?.updatedAt;
  const current = matches ? loaded.picture : undefined;
  const currentError = matches && loaded.error;
  const removePicture = async (picture: SavedPicture) => {
    await pictureRepository.delete(picture.id);
    window.invalidate(picture.id);
    setLibrary(previous => {
      const pictures = previous.pictures.filter(item => item.id !== picture.id);
      const selected = pictures.findIndex(item => item.id === previous.pictures[previous.index]?.id);
      return { pictures, error: false, loading: false, index: selected >= 0 ? selected : Math.max(0, Math.min(previous.index, pictures.length - 1)) };
    });
  };
  const restorePicture = async (picture: SavedPicture) => {
    await pictureRepository.save(picture);
    window.invalidate(picture.id);
    const pictures = await pictureRepository.list();
    setLibrary({ pictures, error: false, loading: false, index: Math.max(0, pictures.findIndex(item => item.id === picture.id)) });
  };
  return { library, saved: library.pictures, sampleIndex: library.index, setSampleIndex, current, currentError,
    retry: () => setRefresh(value => value + 1), removePicture, restorePicture };
}
