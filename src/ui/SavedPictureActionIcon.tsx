import printer from '../../art/source/interface/printer.svg?raw';
import remove from '../../art/source/interface/saved-delete.svg?raw';
import download from '../../art/source/interface/saved-export.svg?raw';
import bookAdd from '../../art/source/interface/saved-book-add.svg?raw';
import bookAdded from '../../art/source/interface/saved-book-added.svg?raw';

const sources = { print: printer, delete: remove, export: download, 'book-add': bookAdd, 'book-added': bookAdded };
// These are trusted, repository-owned SVG paths. Inline them so the ink inherits
// the light/dark theme, while the small gold/teal accents retain their colors.
const bodies = Object.fromEntries(Object.entries(sources).map(([kind, svg]) => [kind, svg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')])) as Record<keyof typeof sources, string>;

export function SavedPictureActionIcon({ kind }: { kind: keyof typeof sources }) {
  return <svg className="library-action-artwork" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false" data-saved-action={kind} dangerouslySetInnerHTML={{ __html: bodies[kind] }} />;
}
