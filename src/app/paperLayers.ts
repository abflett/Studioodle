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
