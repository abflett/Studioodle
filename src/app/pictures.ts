import { createIndexedPictureRepository } from '../platform/indexedPictureRepository';
import { createLocalTemplateRepository } from '../platform/localTemplateRepository';

// Fresh vector-only development format; old drawing data is intentionally unsupported.
export const pictureRepository = createIndexedPictureRepository();
export const coloringPageRepository = createLocalTemplateRepository();
