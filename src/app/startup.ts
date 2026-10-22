import easelArt from '../assets/selection/easel.webp';
import coloringArt from '../assets/selection/coloring-book.webp';
import paperStackArt from '../assets/selection/paper-stack.webp';
import landscapeSheet from '../assets/selection/sheet-landscape.webp';
import squareSheet from '../assets/selection/sheet-square.webp';
import portraitSheet from '../assets/selection/sheet-portrait.webp';

export const pictureChoices = [{ id: 'blank', artwork: easelArt }, { id: 'coloring', artwork: coloringArt }] as const;
export const savedStackArtwork = paperStackArt;
export const portfolioPapers = [
  { shape: 'portrait', ratio: 1 / Math.SQRT2, artwork: portraitSheet },
  { shape: 'square', ratio: 1, artwork: squareSheet },
  { shape: 'landscape', ratio: Math.SQRT2, artwork: landscapeSheet },
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
