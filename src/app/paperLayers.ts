/** One coordinate system for the paper cutout and the transparent-center overlay. */
type PaperBox = { left: number; top: number; right: number; bottom: number };
const svgUrl = (body: string, viewBox = '0 0 1000 1000') =>
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" preserveAspectRatio="none">' + body + '</svg>');

export function paperLayers(face: string, box: PaperBox, artwork: string) {
  const sx = box.right - box.left, sy = box.bottom - box.top;
  const x = box.left * 1000, y = box.top * 1000, width = sx * 1000, height = sy * 1000;
  const artworkMask = svgUrl('<path fill="white" d="' + face + '"/>', [x, y, width, height].join(' '));
  // The overlay overlaps the image by three SVG units to hide antialiasing seams.
  const overlayMask = svgUrl('<defs><clipPath id="picture"><rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (width - 6) + '" height="' + (height - 6) + '"/></clipPath><mask id="rim" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="white"/><g clip-path="url(#picture)"><path d="' + face + '" fill="black"/></g><path d="' + face + '" fill="none" stroke="white" stroke-width="6"/></mask></defs><rect width="1000" height="1000" fill="white" mask="url(#rim)"/>');
  return {
    artworkMask, overlayMask,
    artworkStyle: {
      inset: [box.top, 1 - box.right, 1 - box.bottom, box.left].map(value => value * 100 + '%').join(' '),
      maskImage: 'url("' + artworkMask + '"), url("' + artwork + '")',
      maskSize: '100% 100%, ' + 100 / sx + '% ' + 100 / sy + '%',
      maskPosition: '0 0, ' + box.left / (1 - sx) * 100 + '% ' + box.top / (1 - sy) * 100 + '%',
      maskComposite: 'intersect' as const,
    },
    overlayStyle: { maskImage: 'url("' + overlayMask + '")' },
  };
}
