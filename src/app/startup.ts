import easelArt from '../assets/selection/easel.webp';
import coloringArt from '../assets/selection/coloring-book.webp';
import paperStackArt from '../assets/selection/paper-stack.webp';
import landscapeSheet from '../assets/selection/sheet-landscape.webp';
import squareSheet from '../assets/selection/sheet-square.webp';
import portraitSheet from '../assets/selection/sheet-portrait.webp';

export const pictureChoices = [{ id: 'blank', artwork: easelArt }, { id: 'coloring', artwork: coloringArt }] as const;
export const savedStackArtwork = paperStackArt;
// Outline fractions exclude export padding; surface curves follow the face, not the folded underside.
export const portfolioPapers = [
  { shape: 'portrait', ratio: 1 / Math.SQRT2, artwork: portraitSheet, outline: { width: .9411, height: .9179 }, surface: {
    corners: [[.062, .048], [.96, .074], [.84, .955], [.06, .95]],
    top: [[.32, .06], [.74, .065]], right: [[.975, .42], [.99, .87]],
    bottom: [[.30, .963], [.70, .965]], left: [[.025, .12], [.025, .88]],
  } },
  { shape: 'square', ratio: 1, artwork: squareSheet, outline: { width: .9354, height: .9147 }, surface: {
    corners: [[.065, .055], [.955, .095], [.835, .95], [.061, .95]],
    top: [[.32, .065], [.74, .068]], right: [[.975, .43], [.99, .86]],
    bottom: [[.30, .96], [.70, .965]], left: [[.025, .12], [.025, .88]],
  } },
  { shape: 'landscape', ratio: Math.SQRT2, artwork: landscapeSheet, outline: { width: .9572, height: .8555 }, surface: {
    corners: [[.063, .078], [.965, .13], [.857, .917], [.055, .91]],
    top: [[.33, .10], [.74, .105]], right: [[.982, .52], [.995, .84]],
    bottom: [[.30, .92], [.70, .925]], left: [[.02, .13], [.02, .86]],
  } },
] as const;
/** Compare proportions symmetrically, so a tall and a wide save get equal treatment. */
export function portfolioPaper(ratio: number) {
  return portfolioPapers.reduce((best, paper) => Math.abs(Math.log(ratio / paper.ratio)) < Math.abs(Math.log(ratio / best.ratio)) ? paper : best);
}
const illustrationSources = [...pictureChoices.map(choice => choice.artwork), savedStackArtwork, ...portfolioPapers.map(paper => paper.artwork)];
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
