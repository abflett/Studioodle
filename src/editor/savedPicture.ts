import type { EditorSetup } from './setup';
import type { ArtworkDocument } from './document';

export type SavedPicture = EditorSetup & {
  id: string;
  version: 6;
  updatedAt: number;
  document: ArtworkDocument;
};
