// Choice illustrations are bundled inline by SelectionScreen; no image preload is needed.
export const pictureChoices = [{ id: 'blank' }, { id: 'coloring' }] as const;
export const startupTaskCount = 1;
export type EditorModule = typeof import('../ui/EditorPreview');

export async function prepareStudio(report: (completed: number, total: number) => void): Promise<EditorModule> {
  report(0, startupTaskCount);
  const module = await import('../ui/EditorPreview');
  report(1, startupTaskCount);
  return module;
}
