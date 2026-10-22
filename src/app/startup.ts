import { paperLayers } from './paperLayers';
import easelArt from '../assets/selection/easel.webp';
import coloringArt from '../assets/selection/coloring-book.webp';
import paperStackArt from '../assets/selection/paper-stack.webp';
import landscapeSheet from '../assets/selection/sheet-landscape-overlay.svg';
import landscapeMask from '../assets/selection/sheet-landscape-mask.svg';
import landscapeSilhouette from '../assets/selection/sheet-landscape-silhouette.svg';
import squareSheet from '../assets/selection/sheet-square-overlay.svg';
import squareMask from '../assets/selection/sheet-square-mask.svg';
import squareSilhouette from '../assets/selection/sheet-square-silhouette.svg';
import portraitSheet from '../assets/selection/sheet-portrait-overlay.svg';
import portraitMask from '../assets/selection/sheet-portrait-mask.svg';
import portraitSilhouette from '../assets/selection/sheet-portrait-silhouette.svg';

export const pictureChoices = [{ id: 'blank', artwork: easelArt }, { id: 'coloring', artwork: coloringArt }] as const;
export const savedStackArtwork = paperStackArt;
// Each silhouette, face mask and overlay comes from the same traced paper outline.
export const portfolioPapers = [
  paperLayers({ shape: 'portrait', ratio: 210 / 297, artwork: portraitSheet, artworkMask: portraitMask, backingMask: portraitSilhouette }),
  paperLayers({ shape: 'square', ratio: 1, artwork: squareSheet, artworkMask: squareMask, backingMask: squareSilhouette }),
  paperLayers({ shape: 'landscape', ratio: 297 / 210, artwork: landscapeSheet, artworkMask: landscapeMask, backingMask: landscapeSilhouette }),
];
/** Compare proportions symmetrically, so a tall and a wide save get equal treatment. */
export function portfolioPaper(ratio: number) {
  return portfolioPapers.reduce((best, paper) => Math.abs(Math.log(ratio / paper.ratio)) < Math.abs(Math.log(ratio / best.ratio)) ? paper : best);
}
const illustrationSources = [...pictureChoices.map(choice => choice.artwork), savedStackArtwork, ...portfolioPapers.flatMap(paper => [paper.artwork, paper.artworkMask, paper.backingMask])];
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
