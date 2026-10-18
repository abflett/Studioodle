import { createLocalPictureRepository } from '../platform/localPictureRepository';

// Stable namespaces preserve existing browser and desktop saves.
export const pictureRepository = createLocalPictureRepository('studioodle.v3.picture.');
export const coloringPageRepository = createLocalPictureRepository('studioodle.v3.coloring.');
