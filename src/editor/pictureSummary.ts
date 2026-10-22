import type { SavedPicture } from './savedPicture';
import { formatPictureTitle } from './pictureTitles';

export type PictureSummary = Pick<SavedPicture, 'id' | 'title' | 'updatedAt' | 'format' | 'size' | 'background' | 'leafColor'>;
export function pictureSummary(picture: PictureSummary): PictureSummary {
  const { id, title, updatedAt, format, size, background, leafColor } = picture;
  return { id, title: formatPictureTitle(title), updatedAt, format, size: size && { ...size }, background, leafColor };
}
