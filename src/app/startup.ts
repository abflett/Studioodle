import blank from '../assets/blank.svg';
import coloring from '../assets/coloring.svg';

export const pictureChoices = [
  { id: 'blank', image: blank },
  { id: 'coloring', image: coloring },
] as const;
export const startupTaskCount = pictureChoices.length + 1;

export type EditorModule = typeof import('../ui/EditorPreview');

export async function prepareStudio(report: (completed: number, total: number) => void): Promise<EditorModule> {
  // Progress counts completed startup tasks, not downloaded bytes.
  const total = startupTaskCount;
  let completed = 0;
  const finishTask = () => report(++completed, total);
  report(0, total);
  const illustrations = pictureChoices.map(async ({ image }) => {
    const asset = new Image();
    asset.src = image;
    await asset.decode();
    finishTask();
  });
  const editor = import('../ui/EditorPreview').then((module) => {
    finishTask();
    return module;
  });
  const [module] = await Promise.all([editor, ...illustrations]);
  return module;
}
