import { SavedPictureActionIcon } from './SavedPictureActionIcon';

/** A shared book with the action outside its pages; completed adds keep their check. */
export function ColoringPageActionIcon({ added }: { added: boolean }) {
  return <SavedPictureActionIcon kind={added ? 'book-added' : 'book-add'} />;
}
