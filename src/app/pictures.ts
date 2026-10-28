import { createIndexedPictureRepository } from '../platform/indexedPictureRepository';
import { createLocalTemplateRepository } from '../platform/localTemplateRepository';

// Fresh vector-only development format; old drawing data is intentionally unsupported.
export const pictureRepository = createIndexedPictureRepository();
// Read-only input for consolidating existing current-format templates. New writes
// belong to workshopRepository, which owns atomic collection operations.
export const coloringPageRepository = createLocalTemplateRepository();
