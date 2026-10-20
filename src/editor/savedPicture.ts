import type { EditorSetup } from './setup';
import type { ArtworkDocument } from './document';

export type SavedPicture = EditorSetup & {
  id: string;
  version: 5;
  updatedAt: number;
  document: ArtworkDocument;
};

export interface PictureRepository {
  load(): SavedPicture[];
  save(picture: SavedPicture): void;
  delete(id: string): void;
}
