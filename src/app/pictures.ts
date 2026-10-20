import { createLocalPictureRepository } from '../platform/localPictureRepository';

// Fresh vector-only development format; old drawing data is intentionally unsupported.
export const pictureRepository = createLocalPictureRepository('studioodle.v5.picture.');
export const coloringPageRepository = createLocalPictureRepository('studioodle.v5.coloring.');
