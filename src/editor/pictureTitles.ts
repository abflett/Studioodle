/** Keep current and older saved picture titles consistent across the app. */
export function formatPictureTitle(value: string) {
  const title = value.trim().replace(/\s+/g, ' ');
  if (/^chloe(?:'|\u2019)s spring garden$/i.test(title)) return 'Spring Garden';
  return title.replace(/(^|[\s-])([a-z])/g, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}
