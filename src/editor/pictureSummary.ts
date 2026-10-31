import type { SavedPicture } from './savedPicture';
import { formatPictureTitle } from './pictureTitles';
import { coloringPageLayoutFingerprint } from './coloringPageLayout';

export type PictureSummary = Pick<SavedPicture, 'id' | 'title' | 'updatedAt' | 'format' | 'size' | 'background' | 'leafColor' | 'printSizeMm'> & { pageLayout?: string; stickerCount?: number };
export function pictureSummary(picture: PictureSummary): PictureSummary {
  const { id, title, updatedAt, format, size, background, leafColor, printSizeMm } = picture;
  const source = picture as SavedPicture;
  const pageLayout = source.document ? coloringPageLayoutFingerprint(source) : picture.pageLayout;
  const stickerCount = source.document ? source.document.surfaces.filter(s => s.kind !== 'canvas').length : picture.stickerCount;
  return { id, title: formatPictureTitle(title), updatedAt, format, size: size && { ...size }, background, leafColor, ...(printSizeMm ? {printSizeMm:{...printSizeMm}} : {}), ...(pageLayout !== undefined ? { pageLayout } : {}), ...(stickerCount !== undefined ? { stickerCount } : {}) };
}
