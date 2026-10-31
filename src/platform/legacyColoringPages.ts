import type { SavedPicture } from '../editor/savedPicture';
import { isSavedPicture } from '../editor/pictureValidation';
import { formatPictureTitle } from '../editor/pictureTitles';

/** Read-only source for the one-time IndexedDB import. Never writes legacy keys. */
export function readLegacyColoringPages(store: Storage): SavedPicture[] {
  const prefix = 'studioodle.v6.coloring.';
  const pictures: SavedPicture[] = [];
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const picture: unknown = JSON.parse(store.getItem(key) ?? 'null');
      if (isSavedPicture(picture) && key === prefix + picture.id)
        pictures.push({ ...picture, title: formatPictureTitle(picture.title) });
    } catch { /* A corrupt record must not hide the rest of the library. */ }
  }
  return pictures.sort((a, b) => b.updatedAt - a.updatedAt);
}
