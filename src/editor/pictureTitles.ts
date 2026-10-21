import type { EditorSetup } from './setup';

/** Normalize display and output titles consistently. */
export function formatPictureTitle(value: string) {
  const title = value.trim().replace(/\s+/g, ' ');
  return title.replace(/(^|[\s-])([a-z])/g, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

// Give untitled drawings a stable name shared by PNG downloads and print/PDF.
export function outputTitle(picture: EditorSetup) {
  const title = formatPictureTitle(picture.title);
  if (title && !/^blank[ -]?page$/i.test(title)) return title;
  let hash = 2166136261;
  for (const character of picture.id ?? title) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `Picture ${String((hash >>> 0) % 1_000_000).padStart(6, '0')}`;
}
