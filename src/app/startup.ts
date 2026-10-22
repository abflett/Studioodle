import { paperLayers } from './paperLayers';
import easelArt from '../assets/selection/easel.webp';
import coloringArt from '../assets/selection/coloring-book.webp';
import paperStackArt from '../assets/selection/paper-stack.webp';
import landscapeSheet from '../assets/selection/sheet-landscape.webp';
import squareSheet from '../assets/selection/sheet-square.webp';
import portraitSheet from '../assets/selection/sheet-portrait.webp';

export const pictureChoices = [{ id: 'blank', artwork: easelArt }, { id: 'coloring', artwork: coloringArt }] as const;
export const savedStackArtwork = paperStackArt;
// Masks and transparent-center overlays are derived from the same face path and image box.
export const portfolioPapers = [
  { shape: 'portrait', ratio: 1 / Math.SQRT2, artwork: portraitSheet,
    box: { left: .045, top: .066, right: .966, bottom: .95 },
    face: 'M62 48 C320 60 740 65 960 74 C975 420 990 870 840 955 C700 965 300 963 60 950 C25 880 25 120 62 48 Z',
  },
  { shape: 'square', ratio: 1, artwork: squareSheet,
    box: { left: .048, top: .07, right: .965, bottom: .95 },
    face: 'M65 55 C320 65 740 68 955 95 C975 430 990 860 835 950 C700 965 300 960 61 950 C25 880 25 120 65 55 Z',
  },
  { shape: 'landscape', ratio: Math.SQRT2, artwork: landscapeSheet,
    box: { left: .045, top: .105, right: .97, bottom: .915 },
    face: 'M63 78 C330 100 740 105 965 130 C982 520 995 840 857 917 C700 925 300 920 55 910 C20 860 20 130 63 78 Z',
  },
].map(paper => ({ ...paper, ...paperLayers(paper.face, paper.box, paper.artwork) }));
/** Compare proportions symmetrically, so a tall and a wide save get equal treatment. */
export function portfolioPaper(ratio: number) {
  return portfolioPapers.reduce((best, paper) => Math.abs(Math.log(ratio / paper.ratio)) < Math.abs(Math.log(ratio / best.ratio)) ? paper : best);
}
const illustrationSources = [...pictureChoices.map(choice => choice.artwork), savedStackArtwork, ...portfolioPapers.flatMap(paper => [paper.artwork, paper.artworkMask, paper.overlayMask])];
export const startupTaskCount = 1 + illustrationSources.length;
export type EditorModule = typeof import('../ui/EditorPreview');

export async function prepareStudio(report: (completed: number, total: number) => void): Promise<EditorModule> {
  report(0, startupTaskCount);
  let completed = 0;
  const finish = () => report(++completed, startupTaskCount);
  const module = import('../ui/EditorPreview').then(editor => { finish(); return editor; });
  // Decode while the splash is visible, so the wordless choices arrive ready.
  const illustrations = illustrationSources.map(async artwork => {
    const image = new Image();
    image.src = artwork;
    await image.decode();
    finish();
  });
  await Promise.all([module, ...illustrations]);
  return module;
}
