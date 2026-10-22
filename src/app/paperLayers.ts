type PaperArtwork = {
  shape: 'portrait' | 'square' | 'landscape';
  ratio: number;
  artwork: string;
  artworkMask: string;
  backingMask: string;
};

/** All three layers use the same traced page coordinates, without inset approximations. */
export function paperLayers(paper: PaperArtwork) {
  return {
    ...paper,
    artworkStyle: { inset: '0', maskImage: `url("${paper.artworkMask}")` },
  };
}

/** A repeatable little shuffle for each saved sheet, unaffected by rendering or edits. */
export function paperRotation(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  const degrees = 2 + ((hash >>> 1) % 19) / 10;
  return `${hash & 1 ? degrees : -degrees}deg`;
}
