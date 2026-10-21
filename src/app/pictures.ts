import { createIndexedPictureRepository } from '../platform/indexedPictureRepository';
import { createLocalPictureRepository } from '../platform/localPictureRepository';

// Fresh vector-only development format; old drawing data is intentionally unsupported.
export const pictureRepository = createIndexedPictureRepository();
export const coloringPageRepository = createLocalPictureRepository('studioodle.v5.coloring.');
