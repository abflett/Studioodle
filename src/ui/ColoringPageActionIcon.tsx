import addArtwork from '../../art/source/interface/saved-book-add.svg';
import addedArtwork from '../../art/source/interface/saved-book-added.svg';

/** A shared book with the action outside its pages; completed adds keep their check. */
export function ColoringPageActionIcon({ added }: { added: boolean }) {
  return <svg className="library-action-artwork" viewBox="0 0 256 256" width="26" height="26" aria-hidden="true" focusable="false">
    <image href={added ? addedArtwork : addArtwork} width="256" height="256" />
  </svg>;
}
