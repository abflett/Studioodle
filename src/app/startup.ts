import blank from '../assets/blank.svg';
import coloring from '../assets/coloring.svg';
import previous from '../assets/previous.svg';

export const pictureChoices = [
  { id: 'blank', title: 'Start blank', description: 'A fresh page for your big ideas.', image: blank, note: 'Make something new' },
  { id: 'coloring', title: 'Choose a coloring page', description: 'Find a little world to make your own.', image: coloring, note: 'A place to begin' },
  { id: 'previous', title: 'Open a previous picture', description: 'Come back to something you started.', image: previous, note: 'Keep creating' },
] as const;

export type PictureChoice = typeof pictureChoices[number];
export type EditorModule = typeof import('../ui/EditorPreview');

export async function prepareStudio(report: (completed: number, total: number) => void): Promise<EditorModule> {
  // Progress counts completed startup tasks, not downloaded bytes.
  const total = pictureChoices.length + 1;
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
