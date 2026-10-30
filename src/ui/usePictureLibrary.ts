import type { SetStateAction } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { pictureRepository, pictureSaves } from '../app/pictures';
import { pictureThumbnails } from '../app/pictureThumbnails';
import type { SavedPicture } from '../editor/savedPicture';
import type { PictureSummary } from '../editor/pictureSummary';

export function usePictureLibrary() {
  const [library, setLibrary] = useState<{ pictures: PictureSummary[]; error: boolean; loading: boolean; index: number }>({ pictures: [], error: false, loading: true, index: 0 });
  const [refresh, setRefresh] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  useEffect(() => pictureSaves.subscribePictures(() => setRefresh(value => value + 1)), []);
  const setSampleIndex = (value: SetStateAction<number>) => setLibrary(previous => ({ ...previous, index: typeof value === 'function' ? value(previous.index) : value }));
  useEffect(() => {
    let active = true;
    void pictureRepository.list().then(
      pictures => { if (active) setLibrary(previous => {
        const unchanged = pictures.length === previous.pictures.length && pictures.every((picture, index) => picture.id === previous.pictures[index]?.id && picture.updatedAt === previous.pictures[index]?.updatedAt);
        if (unchanged && !previous.loading && !previous.error) return previous;
        return { pictures: unchanged ? previous.pictures : pictures, error: false, loading: false, index: Math.max(0, pictures.findIndex(picture => picture.id === previous.pictures[previous.index]?.id)) };
      }); },
      () => { if (active) setLibrary(previous => ({ ...previous, error: true, loading: false })); },
    );
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => () => pictureThumbnails.clear(), []);
  const summary = library.pictures[library.index];
  const [errorKey, setErrorKey] = useState<string>();
  const currentError = !!summary && errorKey === `${summary.id}:${summary.updatedAt}`;
  const previewFailed = useCallback((picture: PictureSummary) => setErrorKey(`${picture.id}:${picture.updatedAt}`), []);
  const [busy, setBusy] = useState(false);
  const loadCurrent = async () => {
    if (!summary) return;
    setBusy(true); setErrorKey(undefined);
    try {
      const picture = await pictureRepository.get(summary.id);
      if (!picture || picture.updatedAt !== summary.updatedAt) throw Error('Drawing changed; retry loading.');
      return picture;
    } catch (error) { setErrorKey(`${summary.id}:${summary.updatedAt}`); throw error; }
    finally { setBusy(false); }
  };
  const previewMetadata = useCallback((metadata: PictureSummary) => setLibrary(previous => {
    const existing = previous.pictures.find(item => item.id === metadata.id && item.updatedAt === metadata.updatedAt);
    if (!existing || (existing.pageLayout === metadata.pageLayout && existing.stickerCount === metadata.stickerCount)) return previous;
    const records = previous.pictures.map(item => item.id === metadata.id && item.updatedAt === metadata.updatedAt ? { ...item, pageLayout: metadata.pageLayout, stickerCount: metadata.stickerCount } : item);
    return { ...previous, pictures: records };
  }), []);
  const removePicture = async (picture: SavedPicture) => {
    await pictureRepository.delete(picture.id);
    pictureThumbnails.invalidate(picture.id);
    setLibrary(previous => {
      const pictures = previous.pictures.filter(item => item.id !== picture.id);
      const selected = pictures.findIndex(item => item.id === previous.pictures[previous.index]?.id);
      return { pictures, error: false, loading: false, index: selected >= 0 ? selected : Math.max(0, Math.min(previous.index, pictures.length - 1)) };
    });
  };
  const restorePicture = async (picture: SavedPicture) => {
    await pictureRepository.save(picture);
    pictureThumbnails.invalidate(picture.id);
    const pictures = await pictureRepository.list();
    setLibrary({ pictures, error: false, loading: false, index: Math.max(0, pictures.findIndex(item => item.id === picture.id)) });
  };
  return { library, saved: library.pictures, sampleIndex: library.index, setSampleIndex, loadCurrent, busy, previewMetadata, previewFailed, currentError,
    retry: () => { setErrorKey(undefined); if (summary) pictureThumbnails.invalidate(summary.id); setRefresh(value => value + 1); setRetryAttempt(value => value + 1); }, removePicture, restorePicture, retryAttempt };
}
