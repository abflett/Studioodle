import type { PictureRepository, SavedPicture } from '../editor/savedPicture';
import { isSavedPicture } from '../editor/pictureValidation';
import { formatPictureTitle } from '../editor/pictureTitles';

/** Resolve storage at call time, so unavailable storage follows the caller's error path. */
export function createLocalPictureRepository(prefix: string, storage: () => Storage = () => localStorage): PictureRepository {
  return {
    save(picture) { storage().setItem(prefix + picture.id, JSON.stringify(picture)); },
    delete(id) { storage().removeItem(prefix + id); },
    load() {
      const store = storage();
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
    },
  };
}
